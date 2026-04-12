'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const controller = require('./pointMappings.controller');

const router = express.Router();

router.post('/bind', asyncHandler((req, res) => controller.bind(req, res)));
router.get('/by-controller/:equipmentControllerId', asyncHandler((req, res) => controller.listByController(req, res)));
router.get('/by-equipment/:equipmentId', asyncHandler((req, res) => controller.listByEquipment(req, res)));
router.patch('/:id', asyncHandler((req, res) => controller.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => controller.remove(req, res)));

module.exports = router;
