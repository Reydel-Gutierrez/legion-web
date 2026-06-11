'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const bacnetController = require('./bacnet.controller');

const router = express.Router();

router.get('/devices', asyncHandler((req, res) => bacnetController.listDevices(req, res)));
router.get('/devices/:id/objects', asyncHandler((req, res) => bacnetController.listDeviceObjects(req, res)));
router.post('/discover', asyncHandler((req, res) => bacnetController.discover(req, res)));
router.post('/discover-objects', asyncHandler((req, res) => bacnetController.discoverObjects(req, res)));
router.post('/import-discovery', asyncHandler((req, res) => bacnetController.importDiscovery(req, res)));
router.post('/read', asyncHandler((req, res) => bacnetController.read(req, res)));
router.post('/read-property', asyncHandler((req, res) => bacnetController.readProperty(req, res)));
router.post('/read-device-properties', asyncHandler((req, res) => bacnetController.readDeviceProperties(req, res)));
router.get('/explorer/devices', asyncHandler((req, res) => bacnetController.listExplorerDevices(req, res)));
router.get('/explorer/devices/:id/tree', asyncHandler((req, res) => bacnetController.getDeviceTree(req, res)));
router.get('/explorer/objects/:id', asyncHandler((req, res) => bacnetController.getExplorerObject(req, res)));
router.post('/check-device-health', asyncHandler((req, res) => bacnetController.checkDeviceHealth(req, res)));
router.post('/check-devices-health', asyncHandler((req, res) => bacnetController.checkDevicesHealth(req, res)));
router.post('/write', asyncHandler((req, res) => bacnetController.write(req, res)));
router.post('/start-polling', asyncHandler((req, res) => bacnetController.startPolling(req, res)));
router.post('/stop-polling', asyncHandler((req, res) => bacnetController.stopPolling(req, res)));

module.exports = router;
