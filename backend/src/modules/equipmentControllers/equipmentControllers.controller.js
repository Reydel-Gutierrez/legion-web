'use strict';

const service = require('./equipmentControllers.service');

async function assign(req, res) {
  const row = await service.assign(req.body || {});
  res.status(201).json(row);
}

async function getByEquipment(req, res) {
  const row = await service.getByEquipmentId(req.params.equipmentId);
  if (!row) {
    res.status(404).json({ error: 'No controller assigned to this equipment' });
    return;
  }
  res.json(row);
}

async function list(_req, res) {
  res.json(await service.list());
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
  assign,
  getByEquipment,
  list,
  update,
  remove,
};
