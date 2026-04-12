'use strict';

const service = require('./pointMappings.service');

async function bind(req, res) {
  const row = await service.bind(req.body || {});
  res.status(201).json(row);
}

async function listByController(req, res) {
  res.json(await service.listByController(req.params.equipmentControllerId));
}

async function listByEquipment(req, res) {
  res.json(await service.listByEquipment(req.params.equipmentId));
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
