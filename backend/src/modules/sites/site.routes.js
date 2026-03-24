const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const siteController = require('./site.controller');
const userController = require('../users/user.controller');
const accessController = require('../access/access.controller');
const buildingSiteRoutes = require('../buildings/building.site.routes');
const siteVersionRoutes = require('../siteVersions/siteVersion.routes');

const router = express.Router();

router.get('/', asyncHandler((req, res) => siteController.list(req, res)));
router.post('/', asyncHandler((req, res) => siteController.create(req, res)));

router.use(siteVersionRoutes);

router.get(
  '/:siteId/users',
  asyncHandler((req, res) => userController.listBySite(req, res))
);
router.post(
  '/:siteId/users/access',
  asyncHandler((req, res) => accessController.grantAccess(req, res))
);

router.use('/:siteId/buildings', buildingSiteRoutes);

router.get('/:id', asyncHandler((req, res) => siteController.getById(req, res)));
router.patch('/:id', asyncHandler((req, res) => siteController.update(req, res)));

module.exports = router;
