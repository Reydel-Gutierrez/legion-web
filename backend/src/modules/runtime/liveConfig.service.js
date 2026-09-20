'use strict';

/**
 * LC-ARCH-003 Phase 1.1: the release-backed boundary between Engineering-authored controller/point
 * assignments (`ControllersMapped`/`PointsMapped` — mutable, edited directly by Site Builder / Point
 * Mapping) and what Runtime is actually allowed to consume (`LiveControllerBinding`/
 * `LivePointBinding` — read-only from Runtime's perspective, written only here).
 *
 * `captureLiveConfigForSite` runs at BUILD time: it freezes the site's current
 * ControllersMapped/PointsMapped rows into plain JSON, embedded in the immutable release payload.
 * `materializeLiveConfigForSite` runs at DEPLOY/ROLLBACK time: it replaces the site's
 * LiveControllerBinding/LivePointBinding rows with exactly what the *activated release* captured —
 * never with whatever ControllersMapped/PointsMapped say at the moment of deploy. This is what
 * stops an unreleased Engineering mapping change from ever reaching Runtime.
 */

const prisma = require('../../lib/prisma');

/**
 * @param {string} siteId
 * @param {import('@prisma/client').PrismaClient} [db] - defaults to the module-level client; pass a
 *   transaction handle (`tx`) to capture rows written earlier in that same transaction (used by the
 *   LS-100 package activation pipeline, which upserts ControllersMapped/PointsMapped and then
 *   captures+materializes them into Live bindings in one atomic step).
 * @returns {Promise<{ controllerBindings: object[], pointBindings: object[] }>}
 */
async function captureLiveConfigForSite(siteId, db = prisma) {
  const controllers = await db.controllersMapped.findMany({ where: { siteId } });
  const controllerIds = controllers.map((c) => c.id);
  const pointMappings = controllerIds.length
    ? await db.pointsMapped.findMany({ where: { equipmentControllerId: { in: controllerIds } } })
    : [];

  const controllerBindings = controllers.map((c) => ({
    equipmentId: c.equipmentId,
    controllerCode: c.controllerCode,
    displayName: c.displayName,
    protocol: c.protocol,
    deviceInstance: c.deviceInstance,
    ipAddress: c.ipAddress,
    networkAddress: c.networkAddress,
    buildingId: c.buildingId,
    floorId: c.floorId,
    pollRateMs: c.pollRateMs,
    isSimulated: c.isSimulated,
    isEnabled: c.isEnabled,
  }));

  const pointBindings = pointMappings.map((m) => ({
    equipmentId: m.equipmentId,
    pointId: m.pointId,
    legionPointCode: m.legionPointCode,
    fieldPointKey: m.fieldPointKey,
    fieldPointName: m.fieldPointName,
    fieldObjectType: m.fieldObjectType,
    fieldObjectInstance: m.fieldObjectInstance,
    fieldDataType: m.fieldDataType,
    readEnabled: m.readEnabled,
    writeEnabled: m.writeEnabled,
    isBound: m.isBound,
  }));

  return { controllerBindings, pointBindings };
}

/**
 * Replace a site's LiveControllerBinding/LivePointBinding rows with exactly what an activated
 * release captured. Must run inside the same transaction as flipping `activeReleaseVersionId` so a
 * failure leaves the previous Live projection (and therefore Runtime) untouched.
 * @param {import('@prisma/client').PrismaClient} tx
 * @param {string} siteId
 * @param {string} releaseVersionId
 * @param {object[]} controllerBindings
 * @param {object[]} pointBindings
 */
async function materializeLiveConfigForSite(tx, siteId, releaseVersionId, controllerBindings, pointBindings) {
  const bindings = Array.isArray(controllerBindings) ? controllerBindings : [];
  const mappings = Array.isArray(pointBindings) ? pointBindings : [];

  // Defensive, matching the LS-100 activation pattern: a release built earlier may reference
  // equipment/points that no longer exist relationally (deleted in Engineering since the build).
  // Skip rather than fail the whole deploy — the change is real but not this function's concern.
  const equipmentIds = bindings.map((b) => b.equipmentId).filter(Boolean);
  const existingEquipment = equipmentIds.length
    ? await tx.equipment.findMany({ where: { id: { in: equipmentIds } }, select: { id: true } })
    : [];
  const existingEquipmentIds = new Set(existingEquipment.map((e) => e.id));

  const pointIds = mappings.map((m) => m.pointId).filter(Boolean);
  const existingPoints = pointIds.length
    ? await tx.point.findMany({ where: { id: { in: pointIds } }, select: { id: true } })
    : [];
  const existingPointIds = new Set(existingPoints.map((p) => p.id));

  // Wipe this site's current Live projection (cascades LivePointBinding), then rebuild it whole —
  // simpler and safer than diffing since this runs at most once per deploy/rollback, not per poll.
  await tx.liveControllerBinding.deleteMany({ where: { siteId } });

  const mappingsByEquipment = new Map();
  for (const m of mappings) {
    if (!m.equipmentId || !existingEquipmentIds.has(m.equipmentId)) continue;
    if (!m.pointId || !existingPointIds.has(m.pointId)) continue;
    if (!mappingsByEquipment.has(m.equipmentId)) mappingsByEquipment.set(m.equipmentId, []);
    mappingsByEquipment.get(m.equipmentId).push(m);
  }

  for (const b of bindings) {
    if (!b.equipmentId || !existingEquipmentIds.has(b.equipmentId)) continue;
    const created = await tx.liveControllerBinding.create({
      data: {
        siteId,
        equipmentId: b.equipmentId,
        controllerCode: b.controllerCode,
        displayName: b.displayName ?? null,
        protocol: b.protocol,
        deviceInstance: b.deviceInstance ?? null,
        ipAddress: b.ipAddress ?? null,
        networkAddress: b.networkAddress ?? null,
        buildingId: b.buildingId ?? null,
        floorId: b.floorId ?? null,
        pollRateMs: b.pollRateMs ?? 5000,
        isSimulated: Boolean(b.isSimulated),
        isEnabled: b.isEnabled !== false,
        releaseVersionId,
      },
    });

    const pointsForEquipment = mappingsByEquipment.get(b.equipmentId) || [];
    for (const m of pointsForEquipment) {
      await tx.livePointBinding.create({
        data: {
          liveControllerBindingId: created.id,
          equipmentId: m.equipmentId,
          pointId: m.pointId,
          legionPointCode: m.legionPointCode ?? null,
          fieldPointKey: m.fieldPointKey,
          fieldPointName: m.fieldPointName ?? null,
          fieldObjectType: m.fieldObjectType ?? null,
          fieldObjectInstance: m.fieldObjectInstance ?? null,
          fieldDataType: m.fieldDataType ?? null,
          readEnabled: m.readEnabled !== false,
          writeEnabled: Boolean(m.writeEnabled),
          isBound: m.isBound !== false,
        },
      });
    }
  }
}

module.exports = { captureLiveConfigForSite, materializeLiveConfigForSite };
