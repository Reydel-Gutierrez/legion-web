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
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deployedBy =
    body.deployedBy != null && String(body.deployedBy).trim() ? String(body.deployedBy).trim() : undefined;
  const notes = body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : undefined;
  const released = await siteVersionService.deployWorkingVersion(siteId, { deployedBy, notes });
  res.json({
    activeRelease: siteVersionService.serializeVersionRow(released, true),
  });
}

/** BUILD RELEASE only — does not activate it. */
async function postBuildRelease(req, res) {
  const { siteId } = req.params;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const builtBy = body.builtBy != null && String(body.builtBy).trim() ? String(body.builtBy).trim() : undefined;
  const notes = body.notes != null && String(body.notes).trim() ? String(body.notes).trim() : undefined;
  const release = await siteVersionService.buildRelease(siteId, { builtBy, notes });
  res.json({
    release: siteVersionService.serializeVersionRow(release, true),
  });
}

/** DEPLOY a specific, already-built RELEASED version. */
async function postDeployVersion(req, res) {
  const { siteId, versionId } = req.params;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deployedBy =
    body.deployedBy != null && String(body.deployedBy).trim() ? String(body.deployedBy).trim() : undefined;
  const activated = await siteVersionService.deployRelease(siteId, versionId, { deployedBy });
  res.json({
    activeRelease: siteVersionService.serializeVersionRow(activated, true),
  });
}

/** ROLLBACK to the previously active RELEASED version (or an explicit `toVersionId`). */
async function postRollback(req, res) {
  const { siteId } = req.params;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const actor = body.actor != null && String(body.actor).trim() ? String(body.actor).trim() : undefined;
  const activated = body.toVersionId
    ? await siteVersionService.rollbackToVersion(siteId, String(body.toVersionId), { actor })
    : await siteVersionService.rollbackToPreviousRelease(siteId, { actor });
  res.json({
    activeRelease: siteVersionService.serializeVersionRow(activated, true),
  });
}

async function listVersions(req, res) {
  const { siteId } = req.params;
  const versions = await siteVersionService.listVersionHistory(siteId);
  res.json({ versions });
}

/** Append-only DEPLOY/ROLLBACK activation ledger (newest first) — history/troubleshooting only. */
async function listDeploymentEvents(req, res) {
  const { siteId } = req.params;
  const events = await siteVersionService.listDeploymentEvents(siteId);
  res.json({ events });
}

module.exports = {
  getWorking,
  putWorking,
  getActiveRelease,
  postDeploy,
  postBuildRelease,
  postDeployVersion,
  postRollback,
  listVersions,
  listDeploymentEvents,
};
