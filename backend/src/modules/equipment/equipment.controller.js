const equipmentService = require('./equipment.service');
const siteVersionService = require('../siteVersions/siteVersion.service');

async function listByFloor(req, res) {
  const items = await equipmentService.listEquipmentByFloor(req.params.floorId);
  res.json(items);
}

async function createForFloor(req, res) {
  const equipment = await equipmentService.createEquipment(
    req.params.floorId,
    req.body
  );
  await siteVersionService.syncWorkingPayloadFromDb(equipment.siteId);
  res.status(201).json(equipment);
}

async function update(req, res) {
  const equipment = await equipmentService.updateEquipment(
    req.params.id,
    req.body
  );
  await siteVersionService.syncWorkingPayloadFromDb(equipment.siteId);
  res.json(equipment);
}

async function remove(req, res) {
  const existing = await equipmentService.deleteEquipment(req.params.id);
  await siteVersionService.syncWorkingPayloadFromDb(existing.siteId);
  res.status(204).send();
}

module.exports = {
  listByFloor,
  createForFloor,
  update,
  remove,
};
