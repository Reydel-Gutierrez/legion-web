'use strict';

const discoveryService = require('../../services/bacnet/discovery.service');
const readPropertyService = require('../../services/bacnet/readProperty.service');
const writePropertyService = require('../../services/bacnet/writeProperty.service');
const pollingService = require('../../services/bacnet/polling.service');

async function discover(req, res) {
  const body = req.body || {};
  const query = req.query || {};

  const result = await discoveryService.discoverDevices({
    lowLimit: body.lowLimit ?? query.lowLimit,
    highLimit: body.highLimit ?? query.highLimit,
    timeoutMs: body.timeoutMs ?? query.timeoutMs,
  });

  res.json(result);
}

async function read(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await readPropertyService.readPresentValue(payload);
  res.json(result);
}

async function write(req, res) {
  const result = await writePropertyService.writePresentValue(req.body || {});
  res.json(result);
}

async function startPolling(req, res) {
  const result = await pollingService.startPolling(req.body || {});
  res.status(201).json(result);
}

function stopPolling(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = pollingService.stopPolling(payload);
  res.json(result);
}

module.exports = {
  discover,
  read,
  write,
  startPolling,
  stopPolling,
};
