const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function getEquipmentContext(equipmentId) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: { floor: true, building: true, site: true },
  });
  if (!equipment) {
    throw new HttpError(404, 'Equipment not found');
  }
  return equipment;
}

/**
 * @param {string} equipmentId
 * @param {{ skipSelfHeal?: boolean }} [options]
 */
async function listPointsByEquipment(equipmentId, options = {}) {
  await getEquipmentContext(equipmentId);
  const skipSelfHeal = options.skipSelfHeal === true;
  let rows = await prisma.point.findMany({
    where: { equipmentId },
    orderBy: { pointName: 'asc' },
  });
  if (rows.length === 0 && !skipSelfHeal) {
    const { syncSimCatalogBindingsForEquipmentId } = require('../../lib/simCatalogBindingSync');
    const synced = await syncSimCatalogBindingsForEquipmentId(equipmentId).catch(() => null);
    if (synced?.ok) {
      rows = await prisma.point.findMany({
        where: { equipmentId },
        orderBy: { pointName: 'asc' },
      });
    }
  }
  return rows;
}

async function createPoint(equipmentId, data) {
  const equipment = await getEquipmentContext(equipmentId);
  const siteId = equipment.siteId;
  const buildingId = equipment.buildingId;
  const floorId = equipment.floorId;

  const {
    pointName,
    pointCode,
    pointType,
    unit,
    writable,
    presentValue,
    status,
  } = data;

  if (!pointName || !pointCode || !pointType) {
    throw new HttpError(400, 'pointName, pointCode, and pointType are required');
  }

  const created = await prisma.point.create({
    data: {
      equipmentId,
      siteId,
      buildingId,
      floorId,
      pointName: String(pointName).trim(),
      pointCode: String(pointCode).trim(),
      pointType: String(pointType).trim(),
      unit: unit != null ? String(unit).trim() : null,
      writable: Boolean(writable),
      presentValue:
        presentValue != null ? String(presentValue) : null,
      ...(status ? { status } : {}),
    },
  });

  try {
    const alarmService = require('../alarms/alarm.service');
    await alarmService.syncAlarmDefinitionsAfterPointWrite(created);
    await alarmService.evaluateForPointIds([created.id]);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('alarm sync after point create failed', e?.message || e);
  }

  return created;
}

async function getPointById(id) {
  const point = await prisma.point.findUnique({
    where: { id },
    include: {
      equipment: true,
      site: true,
      building: true,
      floor: true,
    },
  });
  if (!point) {
    throw new HttpError(404, 'Point not found');
  }
  return point;
}

async function updatePoint(id, data) {
  await getPointById(id);
  const allowed = [
    'pointName',
    'pointCode',
    'pointType',
    'unit',
    'writable',
    'presentValue',
    'status',
    'lastSeenAt',
    'commState',
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'writable') {
        update[key] = Boolean(data[key]);
      } else if (key === 'presentValue' || key === 'unit') {
        update[key] =
          data[key] == null ? null : String(data[key]);
      } else if (key === 'lastSeenAt') {
        const v = data.lastSeenAt;
        update.lastSeenAt =
          v == null || v === '' ? null : v instanceof Date ? v : new Date(v);
      } else if (key === 'commState') {
        update.commState =
          data.commState == null || data.commState === ''
            ? null
            : String(data.commState).trim();
      } else {
        update[key] =
          typeof data[key] === 'string' ? data[key].trim() : data[key];
      }
    }
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  const updated = await prisma.point.update({
    where: { id },
    data: update,
  });

  try {
    const alarmService = require('../alarms/alarm.service');
    if (update.pointCode !== undefined) {
      await alarmService.syncAlarmDefinitionsAfterPointWrite(updated);
    }
    if (update.presentValue !== undefined || update.pointCode !== undefined) {
      await alarmService.evaluateForPointIds([id]);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('alarm sync/evaluate after point update failed', e?.message || e);
  }

  return updated;
}

module.exports = {
  listPointsByEquipment,
  createPoint,
  getPointById,
  updatePoint,
};
