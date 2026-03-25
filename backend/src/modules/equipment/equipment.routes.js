const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const equipmentController = require('./equipment.controller');

const router = express.Router();

router.patch(
  '/:id',
  asyncHandler((req, res) => equipmentController.update(req, res))
);
router.delete(
  '/:id',
  asyncHandler((req, res) => equipmentController.remove(req, res))
);

module.exports = router;
