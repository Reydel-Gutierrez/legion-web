const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const siteVersionController = require('./siteVersion.controller');

const router = express.Router();

router.get(
  '/:siteId/working-version',
  asyncHandler((req, res) => siteVersionController.getWorking(req, res))
);
router.put(
  '/:siteId/working-version',
  asyncHandler((req, res) => siteVersionController.putWorking(req, res))
);
router.get(
  '/:siteId/active-release',
  asyncHandler((req, res) => siteVersionController.getActiveRelease(req, res))
);
router.post(
  '/:siteId/deploy',
  asyncHandler((req, res) => siteVersionController.postDeploy(req, res))
);
router.get(
  '/:siteId/versions',
  asyncHandler((req, res) => siteVersionController.listVersions(req, res))
);

module.exports = router;
