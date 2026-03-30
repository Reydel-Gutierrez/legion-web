const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const controller = require('./globalTemplateLibrary.controller');

const router = express.Router();

router.get('/equipment-templates', asyncHandler((req, res) => controller.listEquipment(req, res)));
router.post('/equipment-templates', asyncHandler((req, res) => controller.postEquipment(req, res)));
router.get('/equipment-templates/:id', asyncHandler((req, res) => controller.getEquipment(req, res)));
router.patch('/equipment-templates/:id', asyncHandler((req, res) => controller.patchEquipment(req, res)));
router.delete('/equipment-templates/:id', asyncHandler((req, res) => controller.deleteEquipment(req, res)));

router.get('/graphic-templates', asyncHandler((req, res) => controller.listGraphic(req, res)));
router.post('/graphic-templates', asyncHandler((req, res) => controller.postGraphic(req, res)));
router.get('/graphic-templates/:id', asyncHandler((req, res) => controller.getGraphic(req, res)));
router.patch('/graphic-templates/:id', asyncHandler((req, res) => controller.patchGraphic(req, res)));
router.delete('/graphic-templates/:id', asyncHandler((req, res) => controller.deleteGraphic(req, res)));

module.exports = router;
