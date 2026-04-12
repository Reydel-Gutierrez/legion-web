'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const controller = require('./equipmentControllers.controller');

const router = express.Router();

router.post('/assign', asyncHandler((req, res) => controller.assign(req, res)));
router.get('/', asyncHandler((req, res) => controller.list(req, res)));
router.get('/by-equipment/:equipmentId', asyncHandler((req, res) => controller.getByEquipment(req, res)));
router.patch('/:id', asyncHandler((req, res) => controller.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => controller.remove(req, res)));

module.exports = router;
