'use strict';

/**
 * Applies a parsed package's `files` bundle to the relational database inside one transaction
 * (LC-ARCH-002 §7 "Activation requirements": transactional, active-version pointer changes only
 * after success, no partially-created hierarchy). Used by BOTH a fresh activation and a rollback
 * (rollback re-applies the pre-deployment backup's own `files` bundle through this exact function
 * — there is no separate "undo" code path to keep in sync).
 *
 * Every object in `files` carries the stable Prisma UUID it was built with (see
 * `backend/docs/lspkg-format.md` "Stable identity") — this function upserts by that id rather than
 * deleting and recreating the hierarchy, and explicitly deletes whatever existed for the site but
 * is absent from the new package (a real removal, not a silent drop — the caller's change preview
 * already told the operator this would happen).
 */

const { nextVersionNumber } = require('../siteVersions/siteVersion.service');
const { captureLiveConfigForSite, materializeLiveConfigForSite } = require('../runtime/liveConfig.service');

function byId(list) {
  const map = new Map();
  for (const item of list || []) map.set(String(item.id), item);
  return map;
}

/**
 * @param {import('@prisma/client').PrismaClient} tx - an active transaction client
 * @param {string} siteId
 * @param {Record<string, object>} files - a package's parsed `files` map
 * @param {{ deployedBy?: string, notes?: string, source: 'DIRECT'|'OFFLINE_IMPORT'|'ROLLBACK' }} options
 * @returns {Promise<{ siteVersionId: string, versionNumber: number }>}
 */
async function applyPackageFiles(tx, siteId, files, options = {}) {
  const siteFile = files['site.json'] || {};
  const equipmentFile = files['equipment.json'] || {};
  const mappingsFile = files['mappings.json'] || {};
  const alarmsFile = files['alarms.json'] || {};
  const trendsFile = files['trends.json'] || {};
  const schedulesFile = files['schedules.json'] || {};

  const pkgSite = siteFile.site || {};
  const pkgBuildings = byId(siteFile.buildings);
  const pkgFloors = byId(siteFile.floors);
  const pkgEquipment = byId(equipmentFile.equipment);
  const pkgPoints = byId(equipmentFile.points);
  const pkgControllers = byId(mappingsFile.controllers);
  const pkgPointMappings = byId(mappingsFile.pointMappings);
  const pkgAlarms = byId(alarmsFile.alarmDefinitions);
  const pkgTrends = byId(trendsFile.trendDefinitions);
  const pkgSchedules = byId(schedulesFile.scheduleDefinitions);

  // ---- Site (upsert by the package's stable siteId; create on first-ever activation) ----
  await tx.site.upsert({
    where: { id: siteId },
    create: {
      id: siteId,
      name: pkgSite.name || 'Unnamed Site',
      status: pkgSite.status || 'ACTIVE',
      timezone: pkgSite.timezone ?? null,
      siteType: pkgSite.siteType ?? null,
      description: pkgSite.description ?? null,
      displayLabel: pkgSite.displayLabel ?? null,
      engineeringNotes: pkgSite.engineeringNotes ?? null,
      icon: pkgSite.icon ?? null,
    },
    update: {
      name: pkgSite.name || 'Unnamed Site',
      status: pkgSite.status || 'ACTIVE',
      timezone: pkgSite.timezone ?? null,
      siteType: pkgSite.siteType ?? null,
      description: pkgSite.description ?? null,
      displayLabel: pkgSite.displayLabel ?? null,
      engineeringNotes: pkgSite.engineeringNotes ?? null,
      icon: pkgSite.icon ?? null,
    },
  });

  // ---- Buildings: remove first (cascades floors/equipment/... beneath a removed building) ----
  const existingBuildings = await tx.building.findMany({ where: { siteId }, select: { id: true } });
  const existingBuildingIdsForSite = existingBuildings.map((b) => b.id);
  const removedBuildingIds = existingBuildingIdsForSite.filter((id) => !pkgBuildings.has(id));
  if (removedBuildingIds.length) await tx.building.deleteMany({ where: { id: { in: removedBuildingIds } } });

  for (const b of pkgBuildings.values()) {
    await tx.building.upsert({
      where: { id: b.id },
      create: { id: b.id, siteId, name: b.name, addressLine1: b.addressLine1 || '', addressLine2: b.addressLine2 ?? null, city: b.city || '', state: b.state || '', postalCode: b.postalCode || '', country: b.country || '', latitude: b.latitude ?? null, longitude: b.longitude ?? null, status: b.status || 'ACTIVE', buildingType: b.buildingType ?? null, buildingCode: b.buildingCode ?? null, description: b.description ?? null, sortOrder: b.sortOrder ?? 0 },
      update: { name: b.name, addressLine1: b.addressLine1 || '', addressLine2: b.addressLine2 ?? null, city: b.city || '', state: b.state || '', postalCode: b.postalCode || '', country: b.country || '', latitude: b.latitude ?? null, longitude: b.longitude ?? null, status: b.status || 'ACTIVE', buildingType: b.buildingType ?? null, buildingCode: b.buildingCode ?? null, description: b.description ?? null, sortOrder: b.sortOrder ?? 0 },
    });
  }

  // ---- Floors: same remove-then-upsert pattern. Scoped by the site's building ids captured
  // above (a plain FK filter, not a relational join, so this works identically against a real
  // Prisma client and the lightweight in-memory stub used by the test suite). ----
  const existingFloors = existingBuildingIdsForSite.length
    ? await tx.floor.findMany({ where: { buildingId: { in: existingBuildingIdsForSite } }, select: { id: true } })
    : [];
  const removedFloorIds = existingFloors.map((f) => f.id).filter((id) => !pkgFloors.has(id));
  if (removedFloorIds.length) await tx.floor.deleteMany({ where: { id: { in: removedFloorIds } } });

  for (const f of pkgFloors.values()) {
    await tx.floor.upsert({
      where: { id: f.id },
      create: { id: f.id, buildingId: f.buildingId, name: f.name, status: f.status || 'ACTIVE', displayLabel: f.displayLabel ?? null, floorType: f.floorType ?? null, occupancyType: f.occupancyType ?? null, sortOrder: f.sortOrder ?? 0 },
      update: { buildingId: f.buildingId, name: f.name, status: f.status || 'ACTIVE', displayLabel: f.displayLabel ?? null, floorType: f.floorType ?? null, occupancyType: f.occupancyType ?? null, sortOrder: f.sortOrder ?? 0 },
    });
  }

  // ---- Equipment ----
  const existingEquipment = await tx.equipment.findMany({ where: { siteId }, select: { id: true } });
  const removedEquipmentIds = existingEquipment.map((e) => e.id).filter((id) => !pkgEquipment.has(id));
  if (removedEquipmentIds.length) await tx.equipment.deleteMany({ where: { id: { in: removedEquipmentIds } } });

  for (const e of pkgEquipment.values()) {
    await tx.equipment.upsert({
      where: { id: e.id },
      create: { id: e.id, siteId, buildingId: e.buildingId, floorId: e.floorId, name: e.name, code: e.code, equipmentType: e.equipmentType, templateName: e.templateName ?? null, address: e.address ?? null, instanceNumber: e.instanceNumber ?? null, status: e.status || 'ACTIVE' },
      update: { buildingId: e.buildingId, floorId: e.floorId, name: e.name, code: e.code, equipmentType: e.equipmentType, templateName: e.templateName ?? null, address: e.address ?? null, instanceNumber: e.instanceNumber ?? null, status: e.status || 'ACTIVE' },
    });
  }

  // ---- Points (per equipment) ----
  const survivingEquipmentIds = Array.from(pkgEquipment.keys());
  const existingPoints = survivingEquipmentIds.length
    ? await tx.point.findMany({ where: { equipmentId: { in: survivingEquipmentIds } }, select: { id: true } })
    : [];
  const removedPointIds = existingPoints.map((p) => p.id).filter((id) => !pkgPoints.has(id));
  if (removedPointIds.length) await tx.point.deleteMany({ where: { id: { in: removedPointIds } } });

  for (const p of pkgPoints.values()) {
    const eq = pkgEquipment.get(String(p.equipmentId));
    if (!eq) continue; // unresolved reference — already reported by the change preview, never applied
    await tx.point.upsert({
      where: { id: p.id },
      create: { id: p.id, equipmentId: p.equipmentId, siteId, buildingId: eq.buildingId, floorId: eq.floorId, pointName: p.pointName, pointCode: p.pointCode, pointType: p.pointType, unit: p.unit ?? null, writable: Boolean(p.writable), status: p.status || 'ACTIVE' },
      update: { pointName: p.pointName, pointCode: p.pointCode, pointType: p.pointType, unit: p.unit ?? null, writable: Boolean(p.writable), status: p.status || 'ACTIVE' },
    });
  }

  // ---- Controllers (one per equipment) ----
  const existingControllers = survivingEquipmentIds.length
    ? await tx.controllersMapped.findMany({ where: { equipmentId: { in: survivingEquipmentIds } }, select: { id: true } })
    : [];
  const removedControllerIds = existingControllers.map((c) => c.id).filter((id) => !pkgControllers.has(id));
  if (removedControllerIds.length) await tx.controllersMapped.deleteMany({ where: { id: { in: removedControllerIds } } });

  for (const c of pkgControllers.values()) {
    const eq = pkgEquipment.get(String(c.equipmentId));
    if (!eq) continue;
    await tx.controllersMapped.upsert({
      where: { id: c.id },
      create: { id: c.id, equipmentId: c.equipmentId, controllerCode: c.controllerCode, displayName: c.displayName ?? null, protocol: c.protocol, deviceInstance: c.deviceInstance ?? null, ipAddress: c.ipAddress ?? null, networkAddress: c.networkAddress ?? null, siteId, buildingId: eq.buildingId, floorId: eq.floorId, pollRateMs: c.pollRateMs ?? 5000, isSimulated: Boolean(c.isSimulated), isEnabled: c.isEnabled !== false },
      update: { controllerCode: c.controllerCode, displayName: c.displayName ?? null, protocol: c.protocol, deviceInstance: c.deviceInstance ?? null, ipAddress: c.ipAddress ?? null, networkAddress: c.networkAddress ?? null, buildingId: eq.buildingId, floorId: eq.floorId, pollRateMs: c.pollRateMs ?? 5000, isSimulated: Boolean(c.isSimulated), isEnabled: c.isEnabled !== false },
    });
  }

  // ---- Point mappings (per controller) ----
  const survivingControllerIds = Array.from(pkgControllers.keys());
  const existingMappings = survivingControllerIds.length
    ? await tx.pointsMapped.findMany({ where: { equipmentControllerId: { in: survivingControllerIds } }, select: { id: true } })
    : [];
  const removedMappingIds = existingMappings.map((m) => m.id).filter((id) => !pkgPointMappings.has(id));
  if (removedMappingIds.length) await tx.pointsMapped.deleteMany({ where: { id: { in: removedMappingIds } } });

  for (const m of pkgPointMappings.values()) {
    if (!pkgControllers.has(String(m.equipmentControllerId)) || !pkgPoints.has(String(m.pointId))) continue;
    await tx.pointsMapped.upsert({
      where: { id: m.id },
      create: { id: m.id, equipmentControllerId: m.equipmentControllerId, equipmentId: m.equipmentId, pointId: m.pointId, legionPointCode: m.legionPointCode ?? null, fieldPointKey: m.fieldPointKey, fieldPointName: m.fieldPointName ?? null, fieldObjectType: m.fieldObjectType ?? null, fieldObjectInstance: m.fieldObjectInstance ?? null, fieldDataType: m.fieldDataType ?? null, readEnabled: m.readEnabled !== false, writeEnabled: Boolean(m.writeEnabled), isBound: m.isBound !== false },
      update: { legionPointCode: m.legionPointCode ?? null, fieldPointKey: m.fieldPointKey, fieldPointName: m.fieldPointName ?? null, fieldObjectType: m.fieldObjectType ?? null, fieldObjectInstance: m.fieldObjectInstance ?? null, fieldDataType: m.fieldDataType ?? null, readEnabled: m.readEnabled !== false, writeEnabled: Boolean(m.writeEnabled), isBound: m.isBound !== false },
    });
  }

  // ---- Alarm definitions (site-wide) ----
  const existingAlarms = await tx.alarmDefinition.findMany({ where: { siteId }, select: { id: true } });
  const removedAlarmIds = existingAlarms.map((a) => a.id).filter((id) => !pkgAlarms.has(id));
  if (removedAlarmIds.length) await tx.alarmDefinition.deleteMany({ where: { id: { in: removedAlarmIds } } });

  for (const a of pkgAlarms.values()) {
    if (!pkgEquipment.has(String(a.equipmentId))) continue;
    await tx.alarmDefinition.upsert({
      where: { id: a.id },
      create: { id: a.id, siteId, equipmentId: a.equipmentId, buildingId: a.buildingId ?? null, floorId: a.floorId ?? null, pointKey: a.pointKey, pointId: a.pointId ?? null, name: a.name, enabled: a.enabled !== false, severity: a.severity, category: a.category, operator: a.operator, targetValue: a.targetValue ?? null, targetPointId: a.targetPointId ?? null, targetPointKey: a.targetPointKey ?? null, deadband: a.deadband ?? null, delaySeconds: a.delaySeconds ?? null, messageTemplate: a.messageTemplate ?? null, autoAcknowledge: Boolean(a.autoAcknowledge), conditionTree: a.conditionTree ?? undefined },
      update: { equipmentId: a.equipmentId, buildingId: a.buildingId ?? null, floorId: a.floorId ?? null, pointKey: a.pointKey, pointId: a.pointId ?? null, name: a.name, enabled: a.enabled !== false, severity: a.severity, category: a.category, operator: a.operator, targetValue: a.targetValue ?? null, targetPointId: a.targetPointId ?? null, targetPointKey: a.targetPointKey ?? null, deadband: a.deadband ?? null, delaySeconds: a.delaySeconds ?? null, messageTemplate: a.messageTemplate ?? null, autoAcknowledge: Boolean(a.autoAcknowledge), conditionTree: a.conditionTree ?? undefined },
    });
  }

  // ---- Trend definitions + assignments ----
  const existingTrends = await tx.trendDefinition.findMany({ where: { siteId }, select: { id: true } });
  const removedTrendIds = existingTrends.map((t) => t.id).filter((id) => !pkgTrends.has(id));
  if (removedTrendIds.length) await tx.trendDefinition.deleteMany({ where: { id: { in: removedTrendIds } } });

  for (const t of pkgTrends.values()) {
    await tx.trendDefinition.upsert({
      where: { id: t.id },
      create: { id: t.id, siteId, name: t.name, enabled: t.enabled !== false, isTemplate: Boolean(t.isTemplate), equipmentType: t.equipmentType ?? null, sampleInterval: t.sampleInterval ?? null, retentionDays: t.retentionDays ?? 30, pointRequirements: t.pointRequirements || [], version: t.version || 1 },
      update: { name: t.name, enabled: t.enabled !== false, isTemplate: Boolean(t.isTemplate), equipmentType: t.equipmentType ?? null, sampleInterval: t.sampleInterval ?? null, retentionDays: t.retentionDays ?? 30, pointRequirements: t.pointRequirements || [], version: t.version || 1 },
    });
    const pkgAssignments = byId(t.assignments);
    const existingAssignments = await tx.trendAssignment.findMany({ where: { definitionId: t.id }, select: { id: true } });
    const removedAssignmentIds = existingAssignments.map((a) => a.id).filter((id) => !pkgAssignments.has(id));
    if (removedAssignmentIds.length) await tx.trendAssignment.deleteMany({ where: { id: { in: removedAssignmentIds } } });
    for (const a of pkgAssignments.values()) {
      if (!pkgEquipment.has(String(a.equipmentId))) continue;
      await tx.trendAssignment.upsert({
        where: { id: a.id },
        create: { id: a.id, definitionId: t.id, siteId, equipmentId: a.equipmentId, enabled: a.enabled !== false, resolvedMappings: a.resolvedMappings || {} },
        update: { equipmentId: a.equipmentId, enabled: a.enabled !== false, resolvedMappings: a.resolvedMappings || {} },
      });
    }
  }

  // ---- Schedule definitions + assignments ----
  const existingSchedules = await tx.scheduleDefinition.findMany({ where: { siteId }, select: { id: true } });
  const removedScheduleIds = existingSchedules.map((s) => s.id).filter((id) => !pkgSchedules.has(id));
  if (removedScheduleIds.length) await tx.scheduleDefinition.deleteMany({ where: { id: { in: removedScheduleIds } } });

  for (const s of pkgSchedules.values()) {
    await tx.scheduleDefinition.upsert({
      where: { id: s.id },
      create: { id: s.id, siteId, name: s.name, enabled: s.enabled !== false, isTemplate: Boolean(s.isTemplate), weeklyWindows: s.weeklyWindows || [], version: s.version || 1 },
      update: { name: s.name, enabled: s.enabled !== false, isTemplate: Boolean(s.isTemplate), weeklyWindows: s.weeklyWindows || [], version: s.version || 1 },
    });
    const pkgAssignments = byId(s.assignments);
    const existingAssignments = await tx.scheduleAssignment.findMany({ where: { definitionId: s.id }, select: { id: true } });
    const removedAssignmentIds = existingAssignments.map((a) => a.id).filter((id) => !pkgAssignments.has(id));
    if (removedAssignmentIds.length) await tx.scheduleAssignment.deleteMany({ where: { id: { in: removedAssignmentIds } } });
    for (const a of pkgAssignments.values()) {
      if (!pkgEquipment.has(String(a.equipmentId))) continue;
      await tx.scheduleAssignment.upsert({
        where: { id: a.id },
        create: { id: a.id, definitionId: s.id, siteId, equipmentId: a.equipmentId, enabled: a.enabled !== false },
        update: { equipmentId: a.equipmentId, enabled: a.enabled !== false },
      });
    }
  }

  // ---- New RELEASED SiteVersion carrying this exact `files` bundle, then flip the pointer ----
  const site = await tx.site.findUnique({ where: { id: siteId }, select: { activeReleaseVersionId: true } });
  const versionNumber = await nextVersionNumber(siteId);
  const siteVersion = await tx.siteVersion.create({
    data: {
      siteId,
      versionNumber,
      status: 'RELEASED',
      deployedAt: new Date(),
      parentVersionId: site?.activeReleaseVersionId || null,
      notes: options.notes || null,
      payload: { create: { payloadJson: files } },
    },
  });
  await tx.site.update({ where: { id: siteId }, data: { activeReleaseVersionId: siteVersion.id } });

  // This IS the activation event for an LS-100 (there is no separate "deploy the working state"
  // step here — applying a package already means "make this Live"), so immediately capture the
  // ControllersMapped/PointsMapped rows just upserted above and materialize them into the same
  // LiveControllerBinding/LivePointBinding projection `siteVersion.service.js`'s same-database
  // deploy path uses — Runtime must resolve identically regardless of which pipeline activated it.
  const { controllerBindings, pointBindings } = await captureLiveConfigForSite(siteId, tx);
  await materializeLiveConfigForSite(tx, siteId, siteVersion.id, controllerBindings, pointBindings);

  return { siteVersionId: siteVersion.id, versionNumber };
}

module.exports = { applyPackageFiles };
