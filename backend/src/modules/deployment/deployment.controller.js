'use strict';

const deploymentService = require('./deployment.service');
const { HttpError } = require('../../lib/httpError');

function actorFrom(req) {
  const a = req.body?.actor || req.query?.actor || req.get('x-legion-actor');
  return a ? String(a).trim().slice(0, 200) : null;
}

async function importPackage(req, res) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw new HttpError(400, 'Request body must be the raw .lspkg file bytes (application/octet-stream)');
  }
  const source = String(req.query.source || 'OFFLINE_IMPORT').toUpperCase();
  const record = await deploymentService.stagePackage(req.body, { source, actor: actorFrom(req) });
  res.status(201).json(record);
}

async function validatePackage(req, res) {
  const record = await deploymentService.validatePackage(req.params.id, { actor: actorFrom(req) });
  res.json(record);
}

async function previewPackage(req, res) {
  const record = await deploymentService.previewPackage(req.params.id);
  res.json(record);
}

async function activatePackage(req, res) {
  const record = await deploymentService.activatePackage(req.params.id, { actor: actorFrom(req) });
  if (record.status !== 'ACTIVE') {
    res.status(409);
  }
  res.json(record);
}

async function discardPackage(req, res) {
  const record = await deploymentService.discardPackage(req.params.id, { actor: actorFrom(req) });
  res.json(record);
}

async function getPackage(req, res) {
  const record = await deploymentService.getPackageRecord(req.params.id);
  res.json(record);
}

async function rollback(req, res) {
  const siteId = req.body?.siteId;
  if (!siteId) throw new HttpError(400, 'siteId is required');
  const result = await deploymentService.rollbackToPreviousVersion(siteId, { actor: actorFrom(req) });
  res.json(result);
}

async function downloadBackup(req, res) {
  const { buffer, fileName } = await deploymentService.downloadBackup(req.params.id);
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

async function recommission(req, res) {
  const result = await deploymentService.recommission({ actor: actorFrom(req), reason: req.body?.reason });
  res.json(result);
}

async function getStatus(req, res) {
  const status = await deploymentService.getStatus();
  res.json(status);
}

async function getHistory(req, res) {
  const history = await deploymentService.listHistory(req.query.siteId);
  res.json(history);
}

module.exports = {
  importPackage,
  validatePackage,
  previewPackage,
  activatePackage,
  discardPackage,
  getPackage,
  rollback,
  downloadBackup,
  recommission,
  getStatus,
  getHistory,
};
