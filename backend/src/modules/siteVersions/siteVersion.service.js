const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const {
  createDefaultWorkingPayload,
  cloneJson,
  buildDeploymentSnapshotFromWorking,
  deploymentSnapshotToWorkingPayload,
  validateWorkingPayloadForDeploy,
  isPlainObject,
} = require('./siteVersion.payload');
const { buildWorkingSiteEquipmentFromDb } = require('../siteHierarchy/siteHierarchy.service');
const { ensureSeedOwnerSiteAccess } = require('../../lib/siteAccess');
const { syncSimCatalogBindingsForSiteId } = require('../../lib/simCatalogBindingSync');
const { captureLiveConfigForSite, materializeLiveConfigForSite } = require('../runtime/liveConfig.service');
const { resyncLiveSimBindings } = require('../runtime/runtime.service.ts');

/**
 * Operator / active-release snapshot uses a slightly flatter site tree than engineering working state.
 * @param {{ site: object | null, equipment: object[] }} dbMerged
 */
function operatorReleaseSiteEquipmentFromDbMerge(dbMerged) {
  const { site, equipment } = dbMerged;
  if (!site) {
    return { site: null, equipment: Array.isArray(equipment) ? equipment : [] };
  }
  const buildings = (site.buildings || []).map((b) => ({
    id: b.id,
    name: b.name,
    buildingType: b.buildingType || '',
    buildingCode: b.buildingCode || '',
    description: b.description != null ? String(b.description) : '',
    address: b.address,
    city: b.city,
    state: b.state,
    lat: b.lat,
    lng: b.lng,
    status: b.layoutStatus || b.status || 'normal',
    hasFloors: b.hasFloors,
    floors: (b.floors || []).map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder ?? 0,
      floorType: f.floorType || 'Standard Floor',
    })),
  }));
  return {
    site: {
      id: site.id,
      name: site.name,
      siteType: 'Site',
      timezone: site.timezone || '',
      description: site.description != null ? String(site.description) : '',
      buildings,
    },
    equipment: Array.isArray(equipment) ? equipment : [],
  };
}

const versionInclude = {
  payload: true,
};

async function assertSiteExists(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  return site;
}

async function nextVersionNumber(siteId) {
  const agg = await prisma.siteVersion.aggregate({
    where: { siteId },
    _max: { versionNumber: true },
  });
  return (agg._max.versionNumber ?? 0) + 1;
}

function serializeVersionRow(version, includePayload = true) {
  const row = {
    id: version.id,
    siteId: version.siteId,
    versionNumber: version.versionNumber,
    status: version.status,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    createdBy: version.createdBy ?? null,
    deployedAt: version.deployedAt,
    deployedBy: version.deployedBy ?? null,
    parentVersionId: version.parentVersionId,
    sourceWorkingVersionId: version.sourceWorkingVersionId ?? null,
    notes: version.notes,
  };
  if (includePayload) {
    row.payload = version.payload?.payloadJson ?? null;
  }
  return row;
}

/**
 * Find current WORKING version or create one (clone from active release or empty default).
 */
async function getOrCreateWorkingVersion(siteId) {
  await assertSiteExists(siteId);

  const existing = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });
  if (existing) return existing;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      activeReleaseVersion: { include: { payload: true } },
    },
  });

  const vn = await nextVersionNumber(siteId);

  let initialPayload = createDefaultWorkingPayload();
  let parentVersionId = null;

  if (site?.activeReleaseVersionId && site.activeReleaseVersion?.payload) {
    const snap = site.activeReleaseVersion.payload.payloadJson;
    initialPayload = deploymentSnapshotToWorkingPayload(
      typeof snap === 'object' && snap !== null ? snap : {}
    );
    parentVersionId = site.activeReleaseVersion.id;
  }

  initialPayload.templates =
    initialPayload.templates && typeof initialPayload.templates === 'object'
      ? initialPayload.templates
      : { equipmentTemplates: [], graphicTemplates: [] };
  initialPayload.templates.equipmentTemplates = Array.isArray(initialPayload.templates.equipmentTemplates)
    ? initialPayload.templates.equipmentTemplates
    : [];
  initialPayload.templates.graphicTemplates = Array.isArray(initialPayload.templates.graphicTemplates)
    ? initialPayload.templates.graphicTemplates
    : [];

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.siteVersion.create({
        data: {
          siteId,
          versionNumber: vn,
          status: 'WORKING',
          parentVersionId,
          notes: null,
          payload: {
            create: {
              payloadJson: initialPayload,
            },
          },
        },
        include: versionInclude,
      });
      return created;
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await prisma.siteVersion.findFirst({
        where: { siteId, status: 'WORKING' },
        include: versionInclude,
      });
      if (again) return again;
    }
    throw e;
  }
}

/**
 * Merge relational hierarchy into the WORKING payload so Site Builder and deploy see DB truth.
 * Preserves templates, mappings, graphics, networkConfig, etc.
 */
async function syncWorkingPayloadFromDb(siteId) {
  await assertSiteExists(siteId);
  let working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });
  if (!working) {
    working = await getOrCreateWorkingVersion(siteId);
  }
  const payloadJson = working.payload?.payloadJson || createDefaultWorkingPayload();
  const { site, equipment } = await buildWorkingSiteEquipmentFromDb(siteId);
  const merged = { ...cloneJson(payloadJson), site, equipment };
  merged.templates =
    merged.templates && typeof merged.templates === 'object'
      ? merged.templates
      : { equipmentTemplates: [], graphicTemplates: [] };
  merged.templates.equipmentTemplates = Array.isArray(merged.templates.equipmentTemplates)
    ? merged.templates.equipmentTemplates
    : [];
  merged.templates.graphicTemplates = Array.isArray(merged.templates.graphicTemplates)
    ? merged.templates.graphicTemplates
    : [];
  return prisma.siteVersion.update({
    where: { id: working.id },
    data: {
      payload: {
        update: { payloadJson: merged },
      },
    },
    include: versionInclude,
  });
}

/**
 * PUT body: { payload: object, notes?: string }
 */
async function putWorkingVersion(siteId, body) {
  await assertSiteExists(siteId);

  if (!body || !isPlainObject(body.payload)) {
    throw new HttpError(400, 'payload is required and must be a JSON object');
  }

  const notes = body.notes !== undefined ? (body.notes === null ? null : String(body.notes)) : undefined;

  let working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });

  if (!working) {
    working = await getOrCreateWorkingVersion(siteId);
  }

  await prisma.siteVersion.update({
    where: { id: working.id },
    data: {
      ...(notes !== undefined ? { notes } : {}),
      payload: {
        update: {
          payloadJson: cloneJson(body.payload),
        },
      },
    },
    include: versionInclude,
  });

  return syncWorkingPayloadFromDb(siteId);
}

async function getActiveRelease(siteId) {
  await assertSiteExists(siteId);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      activeReleaseVersion: { include: { payload: true } },
    },
  });

  if (!site?.activeReleaseVersion) {
    return null;
  }
  return site.activeReleaseVersion;
}

/**
 * BUILD RELEASE: validate the current WORKING version and freeze it into a brand-new, immutable
 * RELEASED SiteVersion (its own row/versionNumber/payload). The WORKING version itself is left
 * completely untouched — Engineering keeps editing the same working copy without needing to
 * "obtain a new one" — and nothing about the Live/active release changes yet. See DEPLOY below for
 * the separate activation step.
 *
 * Lineage: `parentVersionId` chains to the site's *current active RELEASED version* (null for a
 * site's first-ever release) — never to the mutable WORKING row, so release ancestry stays a clean
 * release-to-release chain no matter how many times WORKING is built from in between deploys.
 * `sourceWorkingVersionId` separately records which WORKING draft produced this release — useful
 * provenance, but not lineage, since that WORKING row keeps evolving afterward.
 *
 * Also freezes the site's current ControllersMapped/PointsMapped assignments into the release
 * payload as `controllerBindings`/`pointBindings` (LC-ARCH-003 Phase 1.1) — this is what lets DEPLOY
 * later materialize Runtime's Live projection from what was true at BUILD time, not from whatever
 * Engineering has changed those tables to since.
 */
async function buildRelease(siteId, options = {}) {
  const site = await assertSiteExists(siteId);

  await syncWorkingPayloadFromDb(siteId);

  const working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: { payload: true },
  });

  if (!working) {
    throw new HttpError(404, 'No working version to build');
  }

  const payloadJson = working.payload?.payloadJson;
  const err = validateWorkingPayloadForDeploy(payloadJson);
  if (err) {
    throw new HttpError(400, err);
  }

  const versionNumber = await nextVersionNumber(siteId);
  const builtBy =
    options.builtBy != null && String(options.builtBy).trim() ? String(options.builtBy).trim() : null;
  const notes = options.notes != null && String(options.notes).trim() ? String(options.notes).trim() : null;

  const snapshot = buildDeploymentSnapshotFromWorking(payloadJson, {
    version: `v${versionNumber}`,
    lastDeployedAt: null,
    deployedBy: null,
    systemStatus: 'Built',
  });

  const dbMerged = await buildWorkingSiteEquipmentFromDb(siteId);
  const { site: opSite, equipment: opEquipment } = operatorReleaseSiteEquipmentFromDbMerge(dbMerged);
  snapshot.site = opSite;
  snapshot.equipment = opEquipment;

  const { controllerBindings, pointBindings } = await captureLiveConfigForSite(siteId);
  snapshot.controllerBindings = controllerBindings;
  snapshot.pointBindings = pointBindings;

  await ensureSeedOwnerSiteAccess(siteId);

  const release = await prisma.siteVersion.create({
    data: {
      siteId,
      versionNumber,
      status: 'RELEASED',
      parentVersionId: site.activeReleaseVersionId || null,
      sourceWorkingVersionId: working.id,
      createdBy: builtBy,
      notes,
      payload: {
        create: { payloadJson: snapshot },
      },
    },
    include: { payload: true },
  });

  return release;
}

/**
 * DEPLOY: activate an existing, already-built RELEASED version for a site. Never mutates the
 * released version's engineering configuration (site/equipment/mappings/templates/etc.) — only the
 * deploy-lifecycle stamps (`deployedAt`/`deployedBy` and the display-only snapshot fields mirrored
 * for the Operator UI) change. Everything below — the active-pointer flip, materializing Runtime's
 * Live projection from this release's own frozen bindings, and recording the activation event —
 * happens in one transaction, so a failure leaves the previously active release (and the Live
 * projection Runtime is reading) completely untouched.
 * @param {{ deployedBy?: string, action?: 'DEPLOY'|'ROLLBACK' }} [options]
 */
async function deployRelease(siteId, releaseVersionId, options = {}) {
  await assertSiteExists(siteId);

  const release = await prisma.siteVersion.findUnique({
    where: { id: releaseVersionId },
    include: { payload: true },
  });
  if (!release || release.siteId !== siteId) {
    throw new HttpError(404, 'Release version not found for this site');
  }
  if (release.status !== 'RELEASED') {
    throw new HttpError(409, `Version v${release.versionNumber} is not a built release and cannot be deployed`);
  }

  const deployedBy =
    options.deployedBy != null && String(options.deployedBy).trim() ? String(options.deployedBy).trim() : null;
  const action = options.action === 'ROLLBACK' ? 'ROLLBACK' : 'DEPLOY';
  const deployedAt = new Date();

  const basePayload = release.payload?.payloadJson;
  const displayPayload = isPlainObject(basePayload)
    ? {
        ...cloneJson(basePayload),
        lastDeployedAt: deployedAt.toISOString(),
        deployedBy,
        systemStatus: 'Running',
      }
    : basePayload;
  const controllerBindings = isPlainObject(basePayload) ? basePayload.controllerBindings : undefined;
  const pointBindings = isPlainObject(basePayload) ? basePayload.pointBindings : undefined;

  const activated = await prisma.$transaction(async (tx) => {
    const siteBefore = await tx.site.findUnique({ where: { id: siteId }, select: { activeReleaseVersionId: true } });
    const previousReleaseVersionId = siteBefore?.activeReleaseVersionId || null;

    const updatedVersion = await tx.siteVersion.update({
      where: { id: release.id },
      data: {
        deployedAt,
        deployedBy,
        ...(displayPayload !== basePayload ? { payload: { update: { payloadJson: displayPayload } } } : {}),
      },
      include: { payload: true },
    });

    await tx.site.update({
      where: { id: siteId },
      data: { activeReleaseVersionId: release.id },
    });

    // Materialize Runtime's Live projection from THIS release's own frozen bindings — never from
    // whatever ControllersMapped/PointsMapped say right now (LC-ARCH-003 Phase 1.1).
    await materializeLiveConfigForSite(tx, siteId, release.id, controllerBindings, pointBindings);

    await tx.siteDeploymentEvent.create({
      data: {
        siteId,
        releaseVersionId: release.id,
        previousReleaseVersionId,
        action,
        activatedAt: deployedAt,
        activatedBy: deployedBy,
      },
    });

    return updatedVersion;
  });

  // Best-effort, outside the transaction (matches the existing Engineering self-heal semantics):
  // repair ControllersMapped/PointsMapped for SIM catalog equipment so the NEXT build captures
  // complete bindings. Never affects the release/Live projection just activated above.
  await syncSimCatalogBindingsForSiteId(siteId).catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[deploy] SIM catalog binding sync skipped:', e?.message || e);
  });

  // Re-sync Runtime's in-memory SIM store against the Live projection we just replaced.
  await resyncLiveSimBindings().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[deploy] Runtime live-binding resync skipped:', e?.message || e);
  });

  return activated;
}

/**
 * Combined "Deploy version" convenience (matches the existing single-button Engineering UX):
 * BUILD RELEASE followed immediately by DEPLOY of the release it just built. The two remain
 * independently callable (see `buildRelease` / `deployRelease`) for a future UI that separates them.
 */
async function deployWorkingVersion(siteId, options = {}) {
  const release = await buildRelease(siteId, { notes: options.notes, builtBy: options.deployedBy });
  return deployRelease(siteId, release.id, { deployedBy: options.deployedBy });
}

/**
 * ROLLBACK: reactivate a previously RELEASED version as-is (no duplication/edit of its content —
 * the same immutable row simply becomes the active release again via `deployRelease`).
 */
async function rollbackToVersion(siteId, releaseVersionId, options = {}) {
  return deployRelease(siteId, releaseVersionId, { deployedBy: options.actor, action: 'ROLLBACK' });
}

/**
 * Convenience rollback: reactivate whichever RELEASED version was active immediately before the
 * current one, without the caller needing to look it up first.
 *
 * Derives "previous" from the append-only `SiteDeploymentEvent` ledger — the most recent event
 * whose `releaseVersionId` differs from the currently active release. A mutable `deployedAt` cache
 * on the release row cannot answer this reliably once a release has been (re)activated more than
 * once (it only remembers its own latest activation, not the full sequence), so this never uses it.
 */
async function rollbackToPreviousRelease(siteId, options = {}) {
  await assertSiteExists(siteId);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site?.activeReleaseVersionId) {
    throw new HttpError(409, 'Site has no active release to roll back from');
  }

  const events = await prisma.siteDeploymentEvent.findMany({ where: { siteId } });
  const history = events.slice().sort((a, b) => b.sequence - a.sequence);

  const previousEvent = history.find((e) => e.releaseVersionId !== site.activeReleaseVersionId);
  if (!previousEvent) {
    throw new HttpError(409, 'No prior released version exists to roll back to');
  }

  return rollbackToVersion(siteId, previousEvent.releaseVersionId, options);
}

/**
 * Deployment/activation history for a site (append-only, includes every DEPLOY/ROLLBACK), newest
 * first — the source of truth for "previous release" derivation, version history display, and
 * future troubleshooting. Ordered by `sequence` (monotonic append order), not `activatedAt`: two
 * activations can land in the same millisecond, which would otherwise make ordering ambiguous.
 */
async function listDeploymentEvents(siteId) {
  await assertSiteExists(siteId);
  const rows = await prisma.siteDeploymentEvent.findMany({ where: { siteId } });
  return rows.slice().sort((a, b) => b.sequence - a.sequence);
}

async function listVersionHistory(siteId) {
  await assertSiteExists(siteId);

  const rows = await prisma.siteVersion.findMany({
    where: { siteId },
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      siteId: true,
      versionNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
      deployedAt: true,
      deployedBy: true,
      parentVersionId: true,
      sourceWorkingVersionId: true,
      notes: true,
    },
  });

  return rows;
}

module.exports = {
  getOrCreateWorkingVersion,
  syncWorkingPayloadFromDb,
  putWorkingVersion,
  getActiveRelease,
  buildRelease,
  deployRelease,
  deployWorkingVersion,
  rollbackToVersion,
  rollbackToPreviousRelease,
  listVersionHistory,
  listDeploymentEvents,
  serializeVersionRow,
  nextVersionNumber,
};
