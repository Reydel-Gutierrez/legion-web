const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const geocodeController = require('./geocode.controller');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, suggest: '/api/geocode/suggest?q=…' });
});

router.get('/suggest', asyncHandler((req, res) => geocodeController.suggest(req, res)));

module.exports = router;
