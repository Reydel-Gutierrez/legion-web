const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const userController = require('./user.controller');

const router = express.Router();

router.get('/', asyncHandler((req, res) => userController.list(req, res)));
router.post('/', asyncHandler((req, res) => userController.create(req, res)));

module.exports = router;
