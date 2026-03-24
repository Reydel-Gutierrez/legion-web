const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const equipmentController = require('./equipment.controller');

const router = express.Router({ mergeParams: true });

router.get(
  '/:floorId/equipment',
  asyncHandler((req, res) => equipmentController.listByFloor(req, res))
);
router.post(
  '/:floorId/equipment',
  asyncHandler((req, res) => equipmentController.createForFloor(req, res))
);

module.exports = router;
