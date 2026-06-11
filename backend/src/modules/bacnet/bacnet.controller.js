'use strict';

const discoveryService = require('../../services/bacnet/discovery.service');
const readPropertyService = require('../../services/bacnet/readProperty.service');
const readDevicePropertiesService = require('../../services/bacnet/readDeviceProperties.service');
const writePropertyService = require('../../services/bacnet/writeProperty.service');
const pollingService = require('../../services/bacnet/polling.service');
const discoverObjectsService = require('../../services/bacnet/discoverObjects.service');
const importDiscoveryService = require('../../services/bacnet/importDiscovery.service');
const discoveryCacheService = require('../../services/bacnet/discoveryCache.service');
const explorerService = require('../../services/bacnet/explorer.service');
const deviceHealthService = require('../../services/bacnet/deviceHealth.service');

async function listDevices(req, res) {
  const result = await discoveryCacheService.listDevices();
  res.json(result);
}

async function listDeviceObjects(req, res) {
  const result = await discoveryCacheService.listDeviceObjects(req.params.id, req.query || {});
  res.json(result);
}

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

async function discoverObjects(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await discoverObjectsService.discoverObjects(payload);
  res.json(result);
}

async function importDiscovery(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await importDiscoveryService.importDiscovery(payload);
  res.json(result);
}

async function read(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await readPropertyService.readPresentValue(payload);
  res.json(result);
}

async function readProperty(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await readPropertyService.readProperty(payload);
  res.json(result);
}

async function readDeviceProperties(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await readDevicePropertiesService.readDeviceProperties(payload);
  res.json(result);
}

async function listExplorerDevices(req, res) {
  const result = await explorerService.listExplorerDevices();
  res.json(result);
}

async function getDeviceTree(req, res) {
  const result = await explorerService.getDeviceTree(req.params.id);
  res.json(result);
}

async function getExplorerObject(req, res) {
  const result = await explorerService.getExplorerObject(req.params.id);
  res.json(result);
}

async function checkDeviceHealth(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await deviceHealthService.checkDeviceHealth(payload);
  res.json(result);
}

async function checkDevicesHealth(req, res) {
  const payload = { ...(req.body || {}), ...(req.query || {}) };
  const result = await deviceHealthService.checkDevicesHealth(payload);
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
  listDevices,
  listDeviceObjects,
  discover,
  discoverObjects,
  importDiscovery,
  read,
  readProperty,
  readDeviceProperties,
  listExplorerDevices,
  getDeviceTree,
  getExplorerObject,
  checkDeviceHealth,
  checkDevicesHealth,
  write,
  startPolling,
  stopPolling,
};
