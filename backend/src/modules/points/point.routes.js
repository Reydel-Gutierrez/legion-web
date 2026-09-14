const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const pointController = require('./point.controller');

const router = express.Router();

// Must be registered before '/:id' so "history" is never captured as an id param.
router.get(
  '/history',
  asyncHandler((req, res) => pointController.history(req, res))
);

router.patch(
  '/:id',
  asyncHandler((req, res) => pointController.update(req, res))
);

module.exports = router;
