const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const siteVersionController = require('./siteVersion.controller');
const sitePackageController = require('./sitePackage.controller');
const { requireDeploymentAuth } = require('../deployment/deployment.auth');

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

// LC-ARCH-002 Engineering workflow: Validate Project, Build Site Package, Export Site Package,
// Deploy to LS-100 (direct). These evolve the legacy same-database `/deploy` above (kept working,
// unchanged, for backward compatibility) into the real offline-project → portable-package model.
router.post('/:siteId/package/validate', asyncHandler(sitePackageController.validateProject));
router.post('/:siteId/package/build', requireDeploymentAuth, asyncHandler(sitePackageController.buildPackage));
router.get('/:siteId/package/:packageRecordId/export', requireDeploymentAuth, asyncHandler(sitePackageController.exportPackage));
router.post('/:siteId/package/deploy-direct', requireDeploymentAuth, asyncHandler(sitePackageController.deployDirect));

module.exports = router;
