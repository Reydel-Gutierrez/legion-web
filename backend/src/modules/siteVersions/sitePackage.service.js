'use strict';

/**
 * Engineering-side package workflow (LC-ARCH-002 §6 "Deployment Semantics"): Validate Project,
 * Build Site Package, Deploy to LS-100 (direct), Export Site Package. This is what the old
 * same-database "Deploy to Live" (`siteVersion.service.js:deployWorkingVersion`) evolves into —
 * Engineering no longer flips any "active" pointer itself; it produces a portable, checksummed
 * `.lspkg` and either hands it to the caller (export) or transfers it to a configured LS-100
 * (direct deploy), which alone decides whether/when to activate it.
 */

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { buildSitePackage } = require('../../lib/lspkg/builder');
const { computeChangePreview } = require('../../lib/lspkg/diff');
const { writeStagedPackage } = require('../../lib/lspkg/storage');
const { getOrCreateWorkingVersion, syncWorkingPayloadFromDb } = require('./siteVersion.service');

/**
 * Structural validation gate for "Build Site Package must require successful validation"
 * (LC-ARCH-002 §12). Blocking errors mean there is nothing coherent to package; unresolved
 * references (pending point bindings — normal before on-site commissioning, LC-ARCH-001 §12) are
 * warnings, not blockers.
 */
async function validateProjectForPackage(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new HttpError(404, 'Site not found');

  const errors = [];
  const warnings = [];

  const buildingCount = await prisma.building.count({ where: { siteId } });
  if (buildingCount === 0) errors.push('Site has no buildings — nothing to package.');

  const equipmentCount = await prisma.equipment.count({ where: { siteId } });
  if (equipmentCount === 0) errors.push('Site has no equipment — nothing to package.');

  if (errors.length === 0) {
    const preview = await buildChangePreviewOnly(siteId);
    for (const item of preview.unresolved) {
      warnings.push(`${item.collection} ${item.id}: ${item.reason}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function buildChangePreviewOnly(siteId) {
  const working = await syncWorkingPayloadFromDb(siteId);
  const engineeringPayload = working.payload?.payloadJson || {};
  const { files } = await buildSitePackage(siteId, {
    engineeringPayload,
    packageId: 'preview-only', // never persisted; this call is for the unresolved-reference scan only
  });
  return computeChangePreview(null, files);
}

/**
 * Build Site Package. Persists a `DeploymentPackageRecord` on this (Engineering) database purely
 * as the local build/export history — Engineering never activates it locally.
 */
async function buildProjectPackage(siteId, options = {}) {
  const validation = await validateProjectForPackage(siteId);
  if (!validation.ok) {
    throw new HttpError(422, `Project failed validation: ${validation.errors.join('; ')}`);
  }

  await getOrCreateWorkingVersion(siteId);
  const working = await syncWorkingPayloadFromDb(siteId);
  const engineeringPayload = working.payload?.payloadJson || {};

  const built = await buildSitePackage(siteId, {
    author: options.author,
    releaseNotes: options.releaseNotes,
    deploymentScope: options.deploymentScope,
    simulationPackage: options.simulationPackage,
    engineeringPayload,
  });

  const record = await prisma.deploymentPackageRecord.create({
    data: {
      packageId: built.manifest.packageId,
      siteId,
      siteName: built.manifest.siteName,
      packageVersion: built.manifest.projectVersion,
      schemaVersion: built.manifest.packageSchemaVersion,
      status: 'STAGED', // "built, sitting on the Engineering side" — Engineering does not activate
      source: 'DIRECT',
      filePath: '',
      checksumSha256: require('../../lib/lspkg/checksum').sha256Hex(built.buffer),
      manifestJson: built.manifest,
      changePreviewJson: built.changePreview || undefined,
    },
  });
  const filePath = writeStagedPackage(record.id, built.buffer);
  const updated = await prisma.deploymentPackageRecord.update({ where: { id: record.id }, data: { filePath } });

  await prisma.deploymentAuditEntry.create({
    data: { siteId, packageRecordId: updated.id, action: 'BUILD', result: 'SUCCESS', actor: options.author || null, detailsJson: { fileName: built.fileName, validationWarnings: validation.warnings } },
  });

  return { record: updated, fileName: built.fileName, validation };
}

async function getBuiltPackageBuffer(packageRecordId) {
  const record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  const { readStagedPackage } = require('../../lib/lspkg/storage');
  return { buffer: readStagedPackage(record.filePath), record };
}

module.exports = { validateProjectForPackage, buildProjectPackage, getBuiltPackageBuffer };
