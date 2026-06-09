'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const bacnetController = require('./bacnet.controller');

const router = express.Router();

router.post('/discover', asyncHandler((req, res) => bacnetController.discover(req, res)));
router.post('/read', asyncHandler((req, res) => bacnetController.read(req, res)));
router.post('/write', asyncHandler((req, res) => bacnetController.write(req, res)));
router.post('/start-polling', asyncHandler((req, res) => bacnetController.startPolling(req, res)));
router.post('/stop-polling', asyncHandler((req, res) => bacnetController.stopPolling(req, res)));

module.exports = router;
