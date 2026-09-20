'use strict';

const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requireDeploymentAuth } = require('./deployment.auth');
const controller = require('./deployment.controller');

const router = express.Router();

// Never cache LS-100 commissioning/deployment state — it changes on every stage/validate/activate.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

router.get('/status', asyncHandler(controller.getStatus));
router.get('/history', asyncHandler(controller.getHistory));

router.use(requireDeploymentAuth);

// Raw binary body for the package itself — the shared entry point for both direct deploy and
// offline import (LC-ARCH-002 §4/DEP-004); ?source=DIRECT|OFFLINE_IMPORT distinguishes them only
// for audit/UI purposes, never for a different validation/activation path.
router.post('/import', express.raw({ type: '*/*', limit: '150mb' }), asyncHandler(controller.importPackage));

router.get('/packages/:id', asyncHandler(controller.getPackage));
router.post('/packages/:id/validate', asyncHandler(controller.validatePackage));
router.get('/packages/:id/preview', asyncHandler(controller.previewPackage));
router.post('/packages/:id/activate', asyncHandler(controller.activatePackage));
router.post('/packages/:id/discard', asyncHandler(controller.discardPackage));

router.post('/rollback', asyncHandler(controller.rollback));
router.get('/backups/:id/download', asyncHandler(controller.downloadBackup));
router.post('/recommission', asyncHandler(controller.recommission));

module.exports = router;
