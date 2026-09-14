'use strict';

/**
 * Deterministic Legion Site Package (.lspkg) builder (LC-ARCH-002 §3, §6 "Build Site Package").
 *
 * Package entities carry the exact Prisma UUID they have in the Engineering database. That id
 * *is* the stable logical identity referenced everywhere else in this architecture ("match
 * configuration through stable logical identities rather than deleting and recreating everything
 * with new database IDs" — see the deployment activation service, which upserts by these same
 * ids). A site's first deployment to a fresh LS-100 creates rows with these ids; every later
 * version of the same site reuses them.
 *
 * Explicit exclusions enforced here (LC-ARCH-002 §3 "Explicit exclusions"):
 *  - PointHistorySample, AlarmEvent: never queried.
 *  - Point.presentValue / commState / lastSeenAt: never selected (point definitions only).
 *  - ControllersMapped.status / lastSeenAt / metadataJson: never selected.
 *  - protocol === 'SIM' rows (equipment's controller + its points/mappings): excluded entirely
 *    unless `options.simulationPackage === true`.
 *  - No User/UserSiteAccess/credential data of any kind.
 *  - `manifest.assertNoForbiddenKeys` runs over the fully assembled bundle as a last-line defense.
 */

const prisma = require('../prisma');
const { HttpError } = require('../httpError');
const { buildZip } = require('./zip');
const { canonicalStringify, sha256Hex } = require('./checksum');
const { PACKAGE_SCHEMA_VERSION, assertNoForbiddenKeys } = require('./manifest');
const { defaultSigner } = require('./signing');
const { computeChangePreview } = require('./diff');
const { sortBySortOrderThenName } = require('../hierarchySort');

const LS100_MIN_VERSION = '1.0.0';

function safePoint(p) {
  return {
    id: p.id,
    equipmentId: p.equipmentId,
    pointCode: p.pointCode,
    pointName: p.pointName,
    pointType: p.pointType,
    unit: p.unit ?? null,
    writable: p.writable,
    status: p.status,
  };
}

function safeController(c) {
  return {
    id: c.id,
    equipmentId: c.equipmentId,
    controllerCode: c.controllerCode,
    displayName: c.displayName ?? null,
    protocol: c.protocol,
    deviceInstance: c.deviceInstance ?? null,
    ipAddress: c.ipAddress ?? null,
    networkAddress: c.networkAddress ?? null,
    pollRateMs: c.pollRateMs ?? null,
    isSimulated: Boolean(c.isSimulated),
    isEnabled: c.isEnabled,
  };
}

function safePointMapping(m) {
  return {
    id: m.id,
    equipmentControllerId: m.equipmentControllerId,
    equipmentId: m.equipmentId,
    pointId: m.pointId,
    legionPointCode: m.legionPointCode ?? null,
    fieldPointKey: m.fieldPointKey,
    fieldPointName: m.fieldPointName ?? null,
    fieldObjectType: m.fieldObjectType ?? null,
    fieldObjectInstance: m.fieldObjectInstance ?? null,
    fieldDataType: m.fieldDataType ?? null,
    readEnabled: m.readEnabled,
    writeEnabled: m.writeEnabled,
    isBound: m.isBound,
  };
}

function safeAlarmDefinition(a) {
  return {
    id: a.id,
    equipmentId: a.equipmentId,
    buildingId: a.buildingId ?? null,
    floorId: a.floorId ?? null,
    pointKey: a.pointKey,
    pointId: a.pointId ?? null,
    name: a.name,
    enabled: a.enabled,
    severity: a.severity,
    category: a.category,
    operator: a.operator,
    targetValue: a.targetValue ?? null,
    targetPointId: a.targetPointId ?? null,
    targetPointKey: a.targetPointKey ?? null,
    deadband: a.deadband ?? null,
    delaySeconds: a.delaySeconds ?? null,
    messageTemplate: a.messageTemplate ?? null,
    autoAcknowledge: a.autoAcknowledge,
    conditionTree: a.conditionTree ?? null,
  };
}

function safeTrendDefinition(t) {
  return {
    id: t.id,
    name: t.name,
    enabled: t.enabled,
    isTemplate: t.isTemplate,
    equipmentType: t.equipmentType ?? null,
    sampleInterval: t.sampleInterval ?? null,
    retentionDays: t.retentionDays ?? null,
    pointRequirements: t.pointRequirements,
    version: t.version,
    assignments: (t.assignments || []).map((a) => ({
      id: a.id,
      equipmentId: a.equipmentId,
      enabled: a.enabled,
      resolvedMappings: a.resolvedMappings,
    })),
  };
}

function safeScheduleDefinition(s) {
  return {
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    isTemplate: s.isTemplate,
    weeklyWindows: s.weeklyWindows,
    version: s.version,
    assignments: (s.assignments || []).map((a) => ({
      id: a.id,
      equipmentId: a.equipmentId,
      enabled: a.enabled,
    })),
  };
}

/**
 * Pulls the full deployable configuration for a site directly from relational tables with an
 * explicit safe-field allow-list per model (never `select: undefined` / `include` a whole row).
 * @param {string} siteId
 * @param {{ simulationPackage?: boolean }} options
 */
async function collectSiteContent(siteId, options = {}) {
  const simulationPackage = Boolean(options.simulationPackage);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new HttpError(404, 'Site not found');

  const buildings = sortBySortOrderThenName(await prisma.building.findMany({ where: { siteId } }));
  const buildingIds = buildings.map((b) => b.id);
  const floors = buildingIds.length
    ? sortBySortOrderThenName(await prisma.floor.findMany({ where: { buildingId: { in: buildingIds } } }))
    : [];

  const equipmentRows = await prisma.equipment.findMany({
    where: { siteId },
    include: { controllersMapped: true },
    orderBy: { name: 'asc' },
  });

  // Equipment/point/alarm/trend/schedule definitions are real engineering config regardless of
  // what is currently driving their points in this dev environment, so they are never SIM-
  // filtered. Only the SIM controller identity/binding itself is dev-only and excluded unless
  // this is explicitly a simulation package — "Development-only SIM records unless the package is
  // explicitly marked for simulation" (LC-ARCH-002 §3) refers to the simulated controller/point
  // *binding* records, not the site design they happen to be temporarily standing in for.
  const includedEquipment = equipmentRows;
  const excludedSimEquipmentIds = equipmentRows
    .filter((eq) => !simulationPackage && eq.controllersMapped?.protocol === 'SIM')
    .map((eq) => eq.id);

  const equipment = includedEquipment.map((eq) => ({
    id: eq.id,
    siteId: eq.siteId,
    buildingId: eq.buildingId,
    floorId: eq.floorId,
    name: eq.name,
    code: eq.code,
    equipmentType: eq.equipmentType,
    templateName: eq.templateName ?? null,
    address: eq.address ?? null,
    instanceNumber: eq.instanceNumber ?? null,
    status: eq.status,
  }));

  const equipmentIds = includedEquipment.map((eq) => eq.id);
  const points = equipmentIds.length
    ? (await prisma.point.findMany({ where: { equipmentId: { in: equipmentIds } }, orderBy: { pointCode: 'asc' } })).map(safePoint)
    : [];

  const controllers = includedEquipment
    .filter((eq) => eq.controllersMapped && (simulationPackage || eq.controllersMapped.protocol !== 'SIM'))
    .map((eq) => safeController(eq.controllersMapped));
  const controllerIds = controllers.map((c) => c.id);
  const pointMappings = controllerIds.length
    ? (await prisma.pointsMapped.findMany({ where: { equipmentControllerId: { in: controllerIds } } })).map(safePointMapping)
    : [];

  const alarmDefinitions = (
    await prisma.alarmDefinition.findMany({ where: { siteId, equipmentId: { in: equipmentIds } } })
  ).map(safeAlarmDefinition);

  const trendDefinitions = (
    await prisma.trendDefinition.findMany({
      where: { siteId },
      include: { assignments: { where: { equipmentId: { in: equipmentIds } } } },
    })
  ).map(safeTrendDefinition);

  const scheduleDefinitions = (
    await prisma.scheduleDefinition.findMany({
      where: { siteId },
      include: { assignments: { where: { equipmentId: { in: equipmentIds } } } },
    })
  ).map(safeScheduleDefinition);

  // Controller-application references (LCPE boundary, LC-ARCH-002 §9): this repo has no LCPE
  // integration, so every reference is honestly NOT_APPLICABLE — never a claim of a downloaded
  // program. Present only so the deployment pipeline has a stable place to grow into.
  const controllerApplications = controllers.map((c) => ({
    controllerCode: c.controllerCode,
    equipmentId: c.equipmentId,
    applicationRef: null,
    applicationVersion: null,
    status: 'NOT_APPLICABLE',
  }));

  return {
    site: {
      id: site.id,
      name: site.name,
      status: site.status,
      timezone: site.timezone ?? null,
      siteType: site.siteType ?? null,
      description: site.description ?? null,
      displayLabel: site.displayLabel ?? null,
      engineeringNotes: site.engineeringNotes ?? null,
      icon: site.icon ?? null,
    },
    buildings: buildings.map((b) => ({
      id: b.id,
      siteId: b.siteId,
      name: b.name,
      addressLine1: b.addressLine1,
      addressLine2: b.addressLine2 ?? null,
      city: b.city,
      state: b.state,
      postalCode: b.postalCode,
      country: b.country,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      status: b.status,
      buildingType: b.buildingType ?? null,
      buildingCode: b.buildingCode ?? null,
      description: b.description ?? null,
      sortOrder: b.sortOrder,
    })),
    floors: floors.map((f) => ({
      id: f.id,
      buildingId: f.buildingId,
      name: f.name,
      status: f.status,
      displayLabel: f.displayLabel ?? null,
      floorType: f.floorType ?? null,
      occupancyType: f.occupancyType ?? null,
      sortOrder: f.sortOrder,
    })),
    equipment,
    points,
    controllers,
    pointMappings,
    alarmDefinitions,
    trendDefinitions,
    scheduleDefinitions,
    controllerApplications,
    meta: {
      simulationPackage,
      excludedSimEquipmentCount: excludedSimEquipmentIds.length,
    },
  };
}

/**
 * @param {string} siteId
 * @param {{
 *   author?: string,
 *   releaseNotes?: string,
 *   deploymentScope?: string,
 *   simulationPackage?: boolean,
 *   minLs100Version?: string,
 *   projectVersion?: string,
 *   engineeringPayload?: { templates?: object, mappings?: object, graphics?: object, siteLayoutGraphics?: object, networkConfig?: object },
 *   now?: Date,
 *   packageId?: string,
 * }} options
 * @returns {Promise<{ buffer: Buffer, manifest: object, files: Record<string, object>, fileName: string }>}
 */
async function buildSitePackage(siteId, options = {}) {
  const content = await collectSiteContent(siteId, { simulationPackage: options.simulationPackage });

  const engineering = options.engineeringPayload || {};
  const files = {
    'site.json': { site: content.site, buildings: content.buildings, floors: content.floors },
    'equipment.json': { equipment: content.equipment, points: content.points },
    'mappings.json': { controllers: content.controllers, pointMappings: content.pointMappings, designed: engineering.mappings || {} },
    'graphics.json': { graphics: engineering.graphics || {}, siteLayoutGraphics: engineering.siteLayoutGraphics || {} },
    'templates.json': engineering.templates || { equipmentTemplates: [], graphicTemplates: [] },
    'alarms.json': { alarmDefinitions: content.alarmDefinitions },
    'trends.json': { trendDefinitions: content.trendDefinitions },
    'schedules.json': { scheduleDefinitions: content.scheduleDefinitions },
    'network.json': engineering.networkConfig || {},
    'controllerApplications.json': { controllerApplications: content.controllerApplications },
  };

  assertNoForbiddenKeys(files);

  // Deterministic checksums: one per logical file, computed over its canonical (sorted-key) JSON.
  const checksums = {};
  for (const [name, obj] of Object.entries(files)) {
    checksums[name] = sha256Hex(canonicalStringify(obj));
  }

  const now = options.now || new Date();
  const crypto = require('crypto');
  const packageId = options.packageId || crypto.randomUUID();

  let releaseNotes = options.releaseNotes || '';
  let changePreview = null;
  try {
    const currentActive = await prisma.site.findUnique({
      where: { id: siteId },
      include: { activeReleaseVersion: { include: { payload: true } } },
    });
    if (currentActive?.activeReleaseVersion?.payload?.payloadJson) {
      changePreview = computeChangePreview(currentActive.activeReleaseVersion.payload.payloadJson, files);
      if (!releaseNotes) releaseNotes = summarizeChangePreview(changePreview);
    } else if (!releaseNotes) {
      releaseNotes = 'Initial package build: no previously deployed version to diff against.';
    }
  } catch (e) {
    // Release-notes generation is best-effort; a diff failure must never block a package build.
    if (!releaseNotes) releaseNotes = 'Release summary unavailable (diff failed): ' + (e?.message || e);
  }

  const manifestCore = {
    packageSchemaVersion: PACKAGE_SCHEMA_VERSION,
    packageId,
    siteId,
    siteName: content.site.name,
    projectVersion: options.projectVersion || `v${Date.now()}`,
    createdAt: now.toISOString(),
    author: options.author || null,
    toolVersion: require('../../../package.json').version,
    minLs100Version: options.minLs100Version || LS100_MIN_VERSION,
    simulationPackage: Boolean(options.simulationPackage),
    deploymentScope: options.deploymentScope || 'full-site',
    releaseNotes,
    files: Object.keys(files).sort(),
    checksums,
  };

  const signature = await defaultSigner.sign(Buffer.from(canonicalStringify(manifestCore)));
  const manifest = { ...manifestCore, signature };

  assertNoForbiddenKeys(manifest);

  const entries = [{ name: 'manifest.json', data: Buffer.from(canonicalStringify(manifest), 'utf8') }];
  for (const name of Object.keys(files).sort()) {
    entries.push({ name, data: Buffer.from(canonicalStringify(files[name]), 'utf8') });
  }

  const buffer = buildZip(entries);
  const safeSiteName = String(content.site.name || 'Site').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `${safeSiteName}_${manifestCore.projectVersion}.lspkg`;

  return { buffer, manifest, files, fileName, changePreview };
}

function summarizeChangePreview(preview) {
  const parts = [];
  for (const [collection, result] of Object.entries(preview.collections || {})) {
    const { added, changed, removed } = result;
    if (added.length || changed.length || removed.length) {
      parts.push(`${collection}: +${added.length}/~${changed.length}/-${removed.length}`);
    }
  }
  return parts.length ? `Changes vs. previously deployed version — ${parts.join(', ')}` : 'No configuration changes since the previously deployed version.';
}

module.exports = { buildSitePackage, collectSiteContent, LS100_MIN_VERSION };
