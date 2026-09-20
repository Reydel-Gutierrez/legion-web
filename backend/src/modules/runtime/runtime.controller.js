'use strict';

const runtimeService = require('./runtime.service.ts');

async function listControllers(_req, res) {
  res.json(await runtimeService.listControllers());
}

async function getController(req, res) {
  const row = await runtimeService.getController(req.params.code);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function fieldPoints(req, res) {
  const list = await runtimeService.listFieldPointsForController(req.params.code);
  if (list === null || list === undefined) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json({ points: list });
}

async function setOnline(req, res) {
  const row = await runtimeService.setOnline(req.params.code, true);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function setOffline(req, res) {
  const row = await runtimeService.setOnline(req.params.code, false);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function start(req, res) {
  const row = await runtimeService.setSimEnabled(req.params.code, true);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function stop(req, res) {
  const row = await runtimeService.setSimEnabled(req.params.code, false);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function pollNow(req, res) {
  const row = await runtimeService.pollNow(req.params.code);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

/**
 * LC-ARCH-004: the only path a live field write reaches a device through — this call goes to
 * Runtime's internal API, which dispatches through BacnetDriver. This backend process never talks
 * to BACnet directly for a normal live write.
 */
async function writePoint(req, res) {
  const { fieldPointKey, value, priority } = req.body || {};
  const result = await runtimeService.writePoint(req.params.code, fieldPointKey, value, { priority });
  if (!result) {
    res.status(404).json({ error: 'Controller or point mapping not found' });
    return;
  }
  res.json(result);
}

async function discoveryDevices(req, res) {
  const siteId = req.query.siteId ? String(req.query.siteId) : undefined;
  const devices = await runtimeService.listDiscoveryDevices(siteId);
  res.json({ devices });
}

module.exports = {
  listControllers,
  getController,
  fieldPoints,
  setOnline,
  setOffline,
  start,
  stop,
  pollNow,
  writePoint,
  discoveryDevices,
};
