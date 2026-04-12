'use strict';

const runtimeService = require('./runtime.service');

function listControllers(_req, res) {
  res.json(runtimeService.listControllers());
}

function getController(req, res) {
  const row = runtimeService.getController(req.params.code);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

async function fieldPoints(req, res) {
  const list = await runtimeService.listFieldPointsForController(req.params.code);
  if (list === null) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json({ points: list });
}

function setOnline(req, res) {
  const row = runtimeService.setOnline(req.params.code, true);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

function setOffline(req, res) {
  const row = runtimeService.setOnline(req.params.code, false);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

function start(req, res) {
  const row = runtimeService.setSimEnabled(req.params.code, true);
  if (!row) {
    res.status(404).json({ error: 'Controller not found' });
    return;
  }
  res.json(row);
}

function stop(req, res) {
  const row = runtimeService.setSimEnabled(req.params.code, false);
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
  discoveryDevices,
};
