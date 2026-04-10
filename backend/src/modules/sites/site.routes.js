const express = require('express');
const { asyncHandler } = require('../../middleware/asyncHandler');
const siteController = require('./site.controller');
const userController = require('../users/user.controller');
const accessController = require('../access/access.controller');
const buildingSiteRoutes = require('../buildings/building.site.routes');
const siteVersionRoutes = require('../siteVersions/siteVersion.routes');
const alarmController = require('../alarms/alarm.controller');

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

router.get(
  '/:siteId/alarm-definitions',
  asyncHandler((req, res) => alarmController.listDefinitions(req, res))
);
router.post(
  '/:siteId/alarm-definitions',
  asyncHandler((req, res) => alarmController.createDefinition(req, res))
);
router.patch(
  '/:siteId/alarm-definitions/:definitionId',
  asyncHandler((req, res) => alarmController.updateDefinition(req, res))
);
router.delete(
  '/:siteId/alarm-definitions/:definitionId',
  asyncHandler((req, res) => alarmController.deleteDefinition(req, res))
);
router.get(
  '/:siteId/alarm-events',
  asyncHandler((req, res) => alarmController.listEvents(req, res))
);
router.patch(
  '/:siteId/alarm-events/:eventId/ack',
  asyncHandler((req, res) => alarmController.acknowledgeEvent(req, res))
);
router.post(
  '/:siteId/alarm-evaluate',
  asyncHandler((req, res) => alarmController.postEvaluate(req, res))
);

router.get('/:id', asyncHandler((req, res) => siteController.getById(req, res)));
router.patch('/:id', asyncHandler((req, res) => siteController.update(req, res)));

module.exports = router;
