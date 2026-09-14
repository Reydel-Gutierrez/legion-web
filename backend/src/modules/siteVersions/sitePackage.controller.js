'use strict';

const sitePackageService = require('./sitePackage.service');
const { deployDirect: deployDirectService } = require('../deployment/directDeploy.service');

async function validateProject(req, res) {
  const result = await sitePackageService.validateProjectForPackage(req.params.siteId);
  res.json(result);
}

async function buildPackage(req, res) {
  const body = req.body || {};
  const { record, fileName, validation } = await sitePackageService.buildProjectPackage(req.params.siteId, {
    author: body.author,
    releaseNotes: body.releaseNotes,
    deploymentScope: body.deploymentScope,
    simulationPackage: Boolean(body.simulationPackage),
  });
  res.status(201).json({
    packageRecord: record,
    fileName,
    validation,
    exportUrl: `/api/sites/${req.params.siteId}/package/${record.id}/export`,
  });
}

async function exportPackage(req, res) {
  const { buffer, record } = await sitePackageService.getBuiltPackageBuffer(req.params.packageRecordId);
  const fileName = `${String(record.siteName || 'Site').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${record.packageVersion}.lspkg`;
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

async function deployDirect(req, res) {
  const body = req.body || {};
  const result = await deployDirectService(req.params.siteId, {
    targetUrl: body.targetUrl,
    actor: body.author,
    buildOptions: { author: body.author, releaseNotes: body.releaseNotes, simulationPackage: Boolean(body.simulationPackage) },
  });
  res.json(result);
}

module.exports = { validateProject, buildPackage, exportPackage, deployDirect };
