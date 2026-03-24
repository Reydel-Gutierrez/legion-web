const buildingService = require('./building.service');

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
  const building = await buildingService.createBuilding(
    req.params.siteId,
    req.body
  );
  res.status(201).json(building);
}

async function update(req, res) {
  const building = await buildingService.updateBuilding(
    req.params.id,
    req.body
  );
  res.json(building);
}

module.exports = {
  listBySite,
  getById,
  createForSite,
  update,
};
