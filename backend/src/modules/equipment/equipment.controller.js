const equipmentService = require('./equipment.service');

async function listByFloor(req, res) {
  const items = await equipmentService.listEquipmentByFloor(req.params.floorId);
  res.json(items);
}

async function createForFloor(req, res) {
  const equipment = await equipmentService.createEquipment(
    req.params.floorId,
    req.body
  );
  res.status(201).json(equipment);
}

async function update(req, res) {
  const equipment = await equipmentService.updateEquipment(
    req.params.id,
    req.body
  );
  res.json(equipment);
}

module.exports = {
  listByFloor,
  createForFloor,
  update,
};
