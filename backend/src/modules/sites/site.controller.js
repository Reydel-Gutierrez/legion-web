const siteService = require('./site.service');
const siteVersionService = require('../siteVersions/siteVersion.service');

async function list(req, res) {
  const sites = await siteService.listSites();
  res.json(sites);
}

async function getById(req, res) {
  const site = await siteService.getSiteById(req.params.id);
  res.json(site);
}

async function create(req, res) {
  const site = await siteService.createSite(req.body);
  res.status(201).json(site);
}

async function update(req, res) {
  const site = await siteService.updateSite(req.params.id, req.body);
  await siteVersionService.syncWorkingPayloadFromDb(req.params.id);
  res.json(site);
}

module.exports = {
  list,
  getById,
  create,
  update,
};
