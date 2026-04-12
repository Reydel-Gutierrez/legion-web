'use strict';

/**
 * Ensures relational `Point` + `PointsMapped` exist for SIM equipment that uses a catalog device
 * (FCU-1, FCU-2, VAV-1, …). Engineering "Point Mapping" page only updates version payload; operator
 * live APIs read Prisma. This sync is idempotent.
 *
 * Canonical SIM identifier (single match path for runtime + operator):
 * - `Point.pointCode` = uppercase trimmed catalog `pointCode` (e.g. SPACE_TEMP)
 * - `PointsMapped.fieldPointKey` = same string
 * - `PointsMapped.legionPointCode` = same string
 *
 * Eligibility: `ControllersMapped` row for `equipmentId` with `protocol` SIM (case-insensitive).
 * `isSimulated` may be false on legacy assigns; we still sync when protocol is SIM so GET self-heal works.
 */

const prisma = require('./prisma');
const {
  getCatalogEntryByControllerCode,
  simCatalogRepairPatchForNumericControllerCode,
} = require('./simulatedControllers/catalog');

const DEV_SYNC_LOG = process.env.NODE_ENV === 'development';

/** @param {string} msg @param {object} [extra] */
function devLog(msg, extra) {
  if (!DEV_SYNC_LOG) return;
  // eslint-disable-next-line no-console
  console.log(msg, extra || {});
}

/** @param {unknown} raw */
function canonicalSimFieldKey(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

function inferFieldDataType(def) {
  const t = String(def.pointType || '').toLowerCase();
  if (t.includes('binary')) return 'boolean';
  if (t.includes('analog') || t.includes('integer')) return 'number';
  return 'string';
}

/**
 * @param {import('@prisma/client').Equipment} equipment
 * @param {Array<{ pointCode: string, pointName?: string, pointType?: string, unit?: string | null, writable?: boolean, presentValue?: string }>} fieldPoints
 * @returns {Promise<number>} upsert loop count (one per catalog field def)
 */
async function upsertPointsFromCatalogFieldDefs(equipment, fieldPoints) {
  let pointsTouched = 0;
  for (const def of fieldPoints || []) {
    const pointCode = canonicalSimFieldKey(def.pointCode);
    if (!pointCode) continue;
    await prisma.point.upsert({
      where: { equipmentId_pointCode: { equipmentId: equipment.id, pointCode } },
      update: {
        siteId: equipment.siteId,
        buildingId: equipment.buildingId,
        floorId: equipment.floorId,
        pointName: def.pointName != null ? String(def.pointName) : pointCode,
        pointType: def.pointType != null ? String(def.pointType) : 'Analog Input',
        unit: def.unit != null ? String(def.unit) : null,
        writable: Boolean(def.writable),
        presentValue: def.presentValue != null ? String(def.presentValue) : null,
        status: 'ACTIVE',
      },
      create: {
        equipmentId: equipment.id,
        siteId: equipment.siteId,
        buildingId: equipment.buildingId,
        floorId: equipment.floorId,
        pointName: def.pointName != null ? String(def.pointName) : pointCode,
        pointCode,
        pointType: def.pointType != null ? String(def.pointType) : 'Analog Input',
        unit: def.unit != null ? String(def.unit) : null,
        writable: Boolean(def.writable),
        presentValue: def.presentValue != null ? String(def.presentValue) : null,
      },
    });
    pointsTouched += 1;
  }
  return pointsTouched;
}

/**
 * @returns {Promise<number>} new PointsMapped rows created
 */
async function ensurePointsMappedForCatalog(ec, equipment, fieldPoints) {
  const points = await prisma.point.findMany({ where: { equipmentId: equipment.id } });
  const byCode = new Map(points.map((p) => [canonicalSimFieldKey(p.pointCode), p]));

  let mappingsCreated = 0;
  for (const def of fieldPoints || []) {
    const key = canonicalSimFieldKey(def.pointCode);
    if (!key) continue;
    const pt = byCode.get(key);
    if (!pt) continue;

    const existing = await prisma.pointsMapped.findFirst({
      where: {
        equipmentControllerId: ec.id,
        fieldPointKey: { equals: key, mode: 'insensitive' },
      },
    });
    if (existing) continue;

    await prisma.pointsMapped.create({
      data: {
        equipmentControllerId: ec.id,
        equipmentId: equipment.id,
        pointId: pt.id,
        legionPointCode: key,
        fieldPointKey: key,
        fieldPointName: def.pointName != null ? String(def.pointName) : null,
        fieldObjectType: def.pointType != null ? String(def.pointType) : null,
        fieldObjectInstance: key,
        fieldDataType: inferFieldDataType(def),
        readEnabled: true,
        writeEnabled: Boolean(def.writable),
        isBound: true,
      },
    });
    mappingsCreated += 1;
  }
  return mappingsCreated;
}

/**
 * @returns {Promise<{ ok: boolean, reason?: string, controllerCode?: string, fieldPointsSynced?: number, pointsUpserted?: number, mappingsCreated?: number }>}
 */
async function syncSimCatalogBindingsForEquipmentId(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) {
    devLog('[DEV] simCatalogBindingSync early return', { reason: 'no_id' });
    return { ok: false, reason: 'no_id' };
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: eid },
  });
  if (!equipment) {
    devLog('[DEV] simCatalogBindingSync early return', { reason: 'equipment_not_found', equipmentId: eid });
    return { ok: false, reason: 'equipment_not_found' };
  }

  let ec = await prisma.controllersMapped.findUnique({
    where: { equipmentId: eid },
  });
  if (!ec) {
    devLog('[DEV] simCatalogBindingSync early return', {
      reason: 'no_controllers_mapped_row',
      equipmentId: eid,
      hint: 'Assign a controller to this equipment first',
    });
    return { ok: false, reason: 'no_controller_row' };
  }

  const simRepair = simCatalogRepairPatchForNumericControllerCode(ec);
  if (simRepair) {
    devLog('[DEV] simCatalogBindingSync repaired ControllersMapped (numeric controllerCode → catalog)', {
      equipmentId: eid,
      ...simRepair,
    });
    ec = await prisma.controllersMapped.update({
      where: { id: ec.id },
      data: simRepair,
    });
    try {
      const runtimeService = require('../modules/runtime/runtime.service');
      await runtimeService.refreshInMemoryBindingForEquipmentId(eid);
    } catch (_) {
      /* ignore */
    }
  }

  if (!ec.isEnabled) {
    devLog('[DEV] simCatalogBindingSync warning: controller isEnabled=false (still attempting catalog sync)', {
      equipmentId: eid,
      controllersMappedId: ec.id,
    });
  }

  const proto = String(ec.protocol || '').trim().toUpperCase();
  if (proto !== 'SIM') {
    devLog('[DEV] simCatalogBindingSync early return', {
      reason: 'protocol_not_sim',
      equipmentId: eid,
      protocol: ec.protocol,
      controllersMappedId: ec.id,
    });
    return { ok: false, reason: 'protocol_not_sim' };
  }

  if (!ec.isSimulated) {
    devLog('[DEV] simCatalogBindingSync note: isSimulated=false but protocol is SIM; proceeding', {
      equipmentId: eid,
      controllerCode: ec.controllerCode,
    });
  }

  const cat = getCatalogEntryByControllerCode(ec.controllerCode);
  if (!cat) {
    devLog('[DEV] simCatalogBindingSync early return', {
      reason: 'controller_code_not_in_catalog',
      equipmentId: eid,
      controllerCode: ec.controllerCode,
      controllersMappedId: ec.id,
    });
    return { ok: false, reason: 'no_catalog' };
  }
  if (!Array.isArray(cat.fieldPoints) || cat.fieldPoints.length === 0) {
    devLog('[DEV] simCatalogBindingSync early return', {
      reason: 'catalog_field_points_empty',
      equipmentId: eid,
      controllerCode: ec.controllerCode,
    });
    return { ok: false, reason: 'catalog_field_points_empty' };
  }

  const pointsUpserted = await upsertPointsFromCatalogFieldDefs(equipment, cat.fieldPoints);
  const mappingsCreated = await ensurePointsMappedForCatalog(ec, equipment, cat.fieldPoints);

  const result = {
    ok: true,
    controllerCode: ec.controllerCode,
    fieldPointsSynced: cat.fieldPoints.length,
    pointsUpserted,
    mappingsCreated,
  };
  devLog('[DEV] simCatalogBindingSync success', {
    equipmentId: eid,
    ...result,
  });
  return result;
}

/**
 * @param {string} siteId
 */
async function syncSimCatalogBindingsForSiteId(siteId) {
  const sid = String(siteId || '').trim();
  if (!sid) return { siteId: sid, results: [] };

  const ecs = await prisma.controllersMapped.findMany({
    where: {
      siteId: sid,
      protocol: { equals: 'SIM', mode: 'insensitive' },
    },
  });

  const results = [];
  for (const ec of ecs) {
    const r = await syncSimCatalogBindingsForEquipmentId(ec.equipmentId);
    results.push({ equipmentId: ec.equipmentId, ...r });
  }
  return { siteId: sid, results };
}

module.exports = {
  syncSimCatalogBindingsForEquipmentId,
  syncSimCatalogBindingsForSiteId,
};
