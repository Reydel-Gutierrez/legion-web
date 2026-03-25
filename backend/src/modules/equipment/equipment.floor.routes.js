const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const equipmentController = require('./equipment.controller');
const floorController = require('../floors/floor.controller');

const router = express.Router({ mergeParams: true });

router.get(
  '/:floorId/equipment',
  asyncHandler((req, res) => equipmentController.listByFloor(req, res))
);
router.post(
  '/:floorId/equipment',
  asyncHandler((req, res) => equipmentController.createForFloor(req, res))
);
router.patch(
  '/:floorId',
  asyncHandler((req, res) => floorController.updateById(req, res))
);
router.delete(
  '/:floorId',
  asyncHandler((req, res) => floorController.deleteById(req, res))
);

module.exports = router;
