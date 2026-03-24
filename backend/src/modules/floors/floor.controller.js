const floorService = require('./floor.service');

async function listByBuilding(req, res) {
  const floors = await floorService.listFloorsByBuilding(
    req.params.buildingId
  );
  res.json(floors);
}

async function createForBuilding(req, res) {
  const floor = await floorService.createFloor(
    req.params.buildingId,
    req.body
  );
  res.status(201).json(floor);
}

module.exports = {
  listByBuilding,
  createForBuilding,
};
