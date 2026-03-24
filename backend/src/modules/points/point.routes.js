const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const pointController = require('./point.controller');

const router = express.Router();

router.patch(
  '/:id',
  asyncHandler((req, res) => pointController.update(req, res))
);

module.exports = router;
