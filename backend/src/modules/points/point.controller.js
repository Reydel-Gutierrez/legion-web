const pointService = require('./point.service');

async function listByEquipment(req, res) {
  const points = await pointService.listPointsByEquipment(
    req.params.equipmentId
  );
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
