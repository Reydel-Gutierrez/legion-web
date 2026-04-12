'use strict';

const prisma = require('../../lib/prisma');
const { syncSimCatalogBindingsForEquipmentId } = require('../../lib/simCatalogBindingSync');
const service = require('./pointMappings.service');

async function bind(req, res) {
  const row = await service.bind(req.body || {});
  res.status(201).json(row);
}

async function listByController(req, res) {
  res.json(await service.listByController(req.params.equipmentControllerId));
}

async function listByEquipment(req, res) {
  const equipmentId = String(req.params.equipmentId || '').trim();
  const dev = process.env.NODE_ENV === 'development';
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] point-mappings GET start', { equipmentId });
  }
  const initialCount = await prisma.pointsMapped.count({ where: { equipmentId } });
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] point-mappings initial count', { equipmentId, count: initialCount });
  }

  let syncResult = null;
  if (initialCount === 0) {
    if (dev) {
      // eslint-disable-next-line no-console
      console.log('[DEV] point-mappings triggering simCatalogBindingSync', { equipmentId });
    }
    try {
      syncResult = await syncSimCatalogBindingsForEquipmentId(equipmentId);
    } catch (e) {
      syncResult = { ok: false, reason: 'sync_threw', error: e?.message || String(e) };
    }
    if (dev) {
      // eslint-disable-next-line no-console
      console.log('[DEV] point-mappings sync result', { equipmentId, ...syncResult });
    }
  }

  const rows = await service.listByEquipment(equipmentId, {
    skipSelfHeal: initialCount === 0,
  });
  if (dev) {
    // eslint-disable-next-line no-console
    console.log('[DEV] point-mappings retry count', { equipmentId, count: rows.length });
  }
  res.json(rows);
}

async function update(req, res) {
  const row = await service.update(req.params.id, req.body || {});
  res.json(row);
}

async function remove(req, res) {
  await service.remove(req.params.id);
  res.status(204).send();
}

module.exports = {
  bind,
  listByController,
  listByEquipment,
  update,
  remove,
};
