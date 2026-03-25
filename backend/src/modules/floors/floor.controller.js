const floorService = require('./floor.service');
const siteVersionService = require('../siteVersions/siteVersion.service');

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
  const siteId = floor.building?.siteId;
  if (siteId) {
    await siteVersionService.syncWorkingPayloadFromDb(siteId);
  }
  res.status(201).json(floor);
}

async function updateById(req, res) {
  const floor = await floorService.updateFloor(req.params.floorId, req.body);
  const siteId = floor.building?.siteId;
  if (siteId) {
    await siteVersionService.syncWorkingPayloadFromDb(siteId);
  }
  res.json(floor);
}

async function deleteById(req, res) {
  const existing = await floorService.deleteFloor(req.params.floorId);
  const siteId = existing.building?.siteId;
  if (siteId) {
    await siteVersionService.syncWorkingPayloadFromDb(siteId);
  }
  res.status(204).send();
}

module.exports = {
  listByBuilding,
  createForBuilding,
  updateById,
  deleteById,
};
