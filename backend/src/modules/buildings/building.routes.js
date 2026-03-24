const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const buildingController = require('./building.controller');

const router = express.Router();

router.get(
  '/:id',
  asyncHandler((req, res) => buildingController.getById(req, res))
);
router.patch(
  '/:id',
  asyncHandler((req, res) => buildingController.update(req, res))
);

module.exports = router;
