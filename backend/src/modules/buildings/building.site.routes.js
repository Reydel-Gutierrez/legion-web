const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const buildingController = require('./building.controller');

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler((req, res) => buildingController.listBySite(req, res))
);
router.post(
  '/',
  asyncHandler((req, res) => buildingController.createForSite(req, res))
);

module.exports = router;
