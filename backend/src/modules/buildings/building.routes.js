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
router.delete(
  '/:id',
  asyncHandler((req, res) => buildingController.remove(req, res))
);

module.exports = router;
