const buildingService = require('./building.service');
const siteVersionService = require('../siteVersions/siteVersion.service');

async function listBySite(req, res) {
  const buildings = await buildingService.listBuildingsBySite(
    req.params.siteId
  );
  res.json(buildings);
}

async function getById(req, res) {
  const building = await buildingService.getBuildingById(req.params.id);
  res.json(building);
}

async function createForSite(req, res) {
  const siteId = req.params.siteId;
  const building = await buildingService.createBuilding(siteId, req.body);
  await siteVersionService.syncWorkingPayloadFromDb(siteId);
  res.status(201).json(building);
}

async function update(req, res) {
  const building = await buildingService.updateBuilding(req.params.id, req.body);
  await siteVersionService.syncWorkingPayloadFromDb(building.siteId);
  res.json(building);
}

async function remove(req, res) {
  const deleted = await buildingService.deleteBuilding(req.params.id);
  await siteVersionService.syncWorkingPayloadFromDb(deleted.siteId);
  res.status(204).send();
}

module.exports = {
  listBySite,
  getById,
  createForSite,
  update,
  remove,
};
