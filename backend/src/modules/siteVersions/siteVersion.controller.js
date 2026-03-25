const siteVersionService = require('./siteVersion.service');

async function getWorking(req, res) {
  const { siteId } = req.params;
  await siteVersionService.getOrCreateWorkingVersion(siteId);
  const version = await siteVersionService.syncWorkingPayloadFromDb(siteId);
  res.json({
    workingVersion: siteVersionService.serializeVersionRow(version, true),
  });
}

async function putWorking(req, res) {
  const { siteId } = req.params;
  const version = await siteVersionService.putWorkingVersion(siteId, req.body || {});
  res.json({
    workingVersion: siteVersionService.serializeVersionRow(version, true),
  });
}

async function getActiveRelease(req, res) {
  const { siteId } = req.params;
  const version = await siteVersionService.getActiveRelease(siteId);
  if (!version) {
    res.json({ activeRelease: null });
    return;
  }
  res.json({
    activeRelease: siteVersionService.serializeVersionRow(version, true),
  });
}

async function postDeploy(req, res) {
  const { siteId } = req.params;
  const released = await siteVersionService.deployWorkingVersion(siteId);
  res.json({
    activeRelease: siteVersionService.serializeVersionRow(released, true),
  });
}

async function listVersions(req, res) {
  const { siteId } = req.params;
  const versions = await siteVersionService.listVersionHistory(siteId);
  res.json({ versions });
}

module.exports = {
  getWorking,
  putWorking,
  getActiveRelease,
  postDeploy,
  listVersions,
};
