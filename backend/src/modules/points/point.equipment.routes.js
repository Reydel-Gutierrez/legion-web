const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const pointController = require('./point.controller');

const router = express.Router({ mergeParams: true });

router.get(
  '/:equipmentId/points',
  asyncHandler((req, res) => pointController.listByEquipment(req, res))
);
router.post(
  '/:equipmentId/points',
  asyncHandler((req, res) => pointController.createForEquipment(req, res))
);

module.exports = router;
