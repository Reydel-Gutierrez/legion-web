const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const historian = require('../../lib/historian');

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

  // Manual/engineering point updates are a real communication event for this
  // point, so they earn a historian sample the same as the SIM poll loop does
  // (LC-ARCH-001 D-010). This path is not inside a shared $transaction, so it
  // records immediately after the point write succeeds. It goes through the same
  // per-point sample-interval throttle as the SIM poll loop (historian.shouldRecordSample),
  // so a manual update landing in the same interval window as a SIM-driven write for the
  // same point can never create a second, near-duplicate row.
  if (update.presentValue !== undefined) {
    const sampleAt = update.lastSeenAt instanceof Date ? update.lastSeenAt : new Date();
    if (historian.shouldRecordSample(id, sampleAt.getTime())) {
      try {
        await historian.recordSample({
          pointId: id,
          value: update.presentValue,
          quality: historian.normalizeQuality(update.commState || updated.commState),
          timestamp: sampleAt,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('historian sample after point update failed', e?.message || e);
      }
    }
  }

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

/**
 * Historian read path for the operator trend chart. Loads persisted samples for a set of
 * point ids within the requested range window, chronological ascending. Never fabricates
 * or backfills — a point with no samples in range simply returns an empty array for it.
 * @param {string[]} pointIds
 * @param {string} [range] - one of '1h' | '24h' | '7d' | '30d' (default '1h')
 * @returns {Promise<Record<string, Array<{ timestamp: string, value: string|null, quality: string }>>>}
 */
async function getHistoryForPointIds(pointIds, range) {
  const ids = Array.from(new Set((pointIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  const out = {};
  for (const id of ids) out[id] = [];
  if (ids.length === 0) return out;

  const windowMs = historian.windowMsForRange(range);
  const since = new Date(Date.now() - windowMs);

  const rows = await prisma.pointHistorySample.findMany({
    where: { pointId: { in: ids }, timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
  });

  const byPoint = {};
  for (const id of ids) byPoint[id] = [];
  for (const row of rows) {
    byPoint[row.pointId].push({
      timestamp: row.timestamp.toISOString(),
      value: row.value,
      quality: row.quality,
    });
  }
  // Long ranges (7d/30d) at a fast poll rate can carry tens of thousands of real rows per point —
  // decimate each series independently to a safe maximum before it goes over the wire. This drops
  // rows, never values: every kept row is a real recorded sample, and the most recent sample is
  // always kept so the chart's "now" edge is never stale.
  for (const id of ids) out[id] = historian.decimateSamples(byPoint[id]);
  return out;
}

module.exports = {
  listPointsByEquipment,
  createPoint,
  getPointById,
  updatePoint,
  getHistoryForPointIds,
};
