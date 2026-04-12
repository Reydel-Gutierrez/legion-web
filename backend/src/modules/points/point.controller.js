const prisma = require('../../lib/prisma');
const { syncSimCatalogBindingsForEquipmentId } = require('../../lib/simCatalogBindingSync');
const pointService = require('./point.service');

async function listByEquipment(req, res) {
  const equipmentId = String(req.params.equipmentId || '').trim();
  const dev = process.env.NODE_ENV === 'development';
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] equipment points GET start', { equipmentId });
  }

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    if (dev) {
      // eslint-disable-next-line no-console
      console.log('[DEV] equipment points equipment not found', { equipmentId });
    }
    return res.status(404).json({ message: 'Equipment not found' });
  }

  const initialCount = await prisma.point.count({ where: { equipmentId } });
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] equipment points initial count', { equipmentId, count: initialCount });
  }

  let syncResult = null;
  if (initialCount === 0) {
    if (dev) {
      // eslint-disable-next-line no-console
      console.log('[DEV] equipment points triggering simCatalogBindingSync', { equipmentId });
    }
    try {
      syncResult = await syncSimCatalogBindingsForEquipmentId(equipmentId);
    } catch (e) {
      syncResult = { ok: false, reason: 'sync_threw', error: e?.message || String(e) };
    }
    if (dev) {
      // eslint-disable-next-line no-console
      console.log('[DEV] equipment points sync result', { equipmentId, ...syncResult });
    }
  }

  const points = await pointService.listPointsByEquipment(equipmentId, {
    skipSelfHeal: initialCount === 0,
  });
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] equipment points retry count', { equipmentId, count: points.length });
  }
  res.json(points);
}

async function createForEquipment(req, res) {
  const point = await pointService.createPoint(
    req.params.equipmentId,
    req.body
  );
  res.status(201).json(point);
}

async function update(req, res) {
  const point = await pointService.updatePoint(req.params.id, req.body);
  res.json(point);
}

module.exports = {
  listByEquipment,
  createForEquipment,
  update,
};
