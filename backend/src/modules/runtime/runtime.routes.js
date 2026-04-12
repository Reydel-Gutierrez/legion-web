'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const runtimeController = require('./runtime.controller');

const router = express.Router();

router.get('/controllers', asyncHandler((req, res) => runtimeController.listControllers(req, res)));
router.get(
  '/controllers/:code/field-points',
  asyncHandler((req, res) => runtimeController.fieldPoints(req, res))
);
router.get('/controllers/:code', asyncHandler((req, res) => runtimeController.getController(req, res)));
router.post('/controllers/:code/online', asyncHandler((req, res) => runtimeController.setOnline(req, res)));
router.post('/controllers/:code/offline', asyncHandler((req, res) => runtimeController.setOffline(req, res)));
router.post('/controllers/:code/start', asyncHandler((req, res) => runtimeController.start(req, res)));
router.post('/controllers/:code/stop', asyncHandler((req, res) => runtimeController.stop(req, res)));
router.post('/controllers/:code/poll-now', asyncHandler((req, res) => runtimeController.pollNow(req, res)));

router.get('/discovery-devices', asyncHandler((req, res) => runtimeController.discoveryDevices(req, res)));

module.exports = router;
