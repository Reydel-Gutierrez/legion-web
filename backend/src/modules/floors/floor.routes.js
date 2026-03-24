const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const floorController = require('./floor.controller');

const router = express.Router({ mergeParams: true });

router.get(
  '/:buildingId/floors',
  asyncHandler((req, res) => floorController.listByBuilding(req, res))
);
router.post(
  '/:buildingId/floors',
  asyncHandler((req, res) => floorController.createForBuilding(req, res))
);

module.exports = router;
