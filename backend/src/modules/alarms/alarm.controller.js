const alarmService = require('./alarm.service');

async function listDefinitions(req, res) {
  const rows = await alarmService.listDefinitions(req.params.siteId, req.query);
  res.json(rows);
}

async function createDefinition(req, res) {
  const row = await alarmService.createDefinition(req.params.siteId, req.body);
  res.status(201).json(row);
}

async function updateDefinition(req, res) {
  const row = await alarmService.updateDefinition(
    req.params.siteId,
    req.params.definitionId,
    req.body
  );
  res.json(row);
}

async function deleteDefinition(req, res) {
  const out = await alarmService.deleteDefinition(req.params.siteId, req.params.definitionId);
  res.json(out);
}

async function listEvents(req, res) {
  const rows = await alarmService.listEvents(req.params.siteId, req.query);
  res.json(rows);
}

async function acknowledgeEvent(req, res) {
  const row = await alarmService.acknowledgeEvent(req.params.siteId, req.params.eventId);
  res.json(row);
}

async function postEvaluate(req, res) {
  const { pointIds } = req.body || {};
  if (Array.isArray(pointIds) && pointIds.length) {
    await alarmService.evaluateForPointIds(pointIds.map(String));
  } else {
    await alarmService.evaluateDefinitionsForSite(req.params.siteId, []);
  }
  res.json({ ok: true });
}

module.exports = {
  listDefinitions,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  listEvents,
  acknowledgeEvent,
  postEvaluate,
};
