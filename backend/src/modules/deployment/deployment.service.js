'use strict';

/**
 * LS-100 commissioning/deployment pipeline (LC-ARCH-002 §5 state machine, §7 activation/rollback).
 * One pipeline serves both entry methods (LC-ARCH-002 §4/DEP-004): a direct-deploy HTTP POST and
 * an offline-import file upload both end up calling `stagePackage` with the same buffer — see
 * `deployment.controller.js`.
 */

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { parseSitePackage } = require('../../lib/lspkg/parser');
const { computeChangePreview } = require('../../lib/lspkg/diff');
const { buildZip } = require('../../lib/lspkg/zip');
const { canonicalStringify, sha256Hex } = require('../../lib/lspkg/checksum');
const { writeStagedPackage, readStagedPackage, deleteStagedPackage } = require('../../lib/lspkg/storage');
const { applyPackageFiles } = require('./activation.service');
const { resyncLiveSimBindings } = require('../runtime/runtime.service.ts');

const COMMISSIONING_ID = 'ls100';

async function getCommissioning() {
  return prisma.lsCommissioning.upsert({
    where: { id: COMMISSIONING_ID },
    create: { id: COMMISSIONING_ID },
    update: {},
  });
}

async function audit({ siteId, packageRecordId, action, result, actor, details }) {
  return prisma.deploymentAuditEntry.create({
    data: { siteId: siteId ?? null, packageRecordId: packageRecordId ?? null, action, result, actor: actor ?? null, detailsJson: details ?? undefined },
  });
}

function serializePackageRecord(record) {
  if (!record) return null;
  const { manifestJson, changePreviewJson, validationErrorsJson, ...rest } = record;
  return { ...rest, manifest: manifestJson, changePreview: changePreviewJson, validationErrors: validationErrorsJson };
}

/**
 * DEP-001 one-active-Site enforcement. Returns an error string, or null if the package's site is
 * allowed to (re)activate on this LS-100 given its current commissioning state.
 */
function checkOneActiveSitePolicy(commissioning, manifest) {
  if (!commissioning.activeSiteId) return null; // UNCOMMISSIONED / recommissioned: any Site may commission
  if (commissioning.activeSiteId === manifest.siteId) return null; // same-Site upgrade
  return (
    `This LS-100 already has an active Site (${commissioning.activeSiteId}). ` +
    `Activating a package for a different Site (${manifest.siteId}) is rejected until an explicit ` +
    `recommissioning operation archives/removes the existing Site.`
  );
}

/**
 * Stage a package (shared by direct-deploy and offline-import — LC-ARCH-002 §4).
 * @param {Buffer} buffer
 * @param {{ source: 'DIRECT'|'OFFLINE_IMPORT', actor?: string }} options
 */
async function stagePackage(buffer, options) {
  const { source, actor } = options;
  if (source !== 'DIRECT' && source !== 'OFFLINE_IMPORT') throw new HttpError(400, 'source must be DIRECT or OFFLINE_IMPORT');

  const parsed = parseSitePackage(buffer);
  const wholePackageChecksum = sha256Hex(buffer);

  if (!parsed.ok) {
    const record = await prisma.deploymentPackageRecord.create({
      data: {
        packageId: parsed.manifest?.packageId || 'unknown',
        siteId: parsed.manifest?.siteId || 'unknown',
        siteName: parsed.manifest?.siteName || 'unknown',
        packageVersion: parsed.manifest?.projectVersion || 'unknown',
        schemaVersion: parsed.manifest?.packageSchemaVersion ?? 0,
        status: 'FAILED',
        source,
        filePath: writeStagedPackage(cryptoRandomId(), buffer),
        checksumSha256: wholePackageChecksum,
        manifestJson: parsed.manifest || {},
        failureReason: parsed.errors.join('; '),
      },
    });
    await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'STAGE', result: 'FAILURE', actor, details: { errors: parsed.errors } });
    throw new HttpError(422, `Package rejected: ${parsed.errors.join('; ')}`);
  }

  const record = await prisma.deploymentPackageRecord.create({
    data: {
      packageId: parsed.manifest.packageId,
      siteId: parsed.manifest.siteId,
      siteName: parsed.manifest.siteName,
      packageVersion: parsed.manifest.projectVersion,
      schemaVersion: parsed.manifest.packageSchemaVersion,
      status: 'STAGED',
      source,
      filePath: '', // set immediately below once we know the record id
      checksumSha256: wholePackageChecksum,
      manifestJson: parsed.manifest,
    },
  });
  const filePath = writeStagedPackage(record.id, buffer);
  const updated = await prisma.deploymentPackageRecord.update({ where: { id: record.id }, data: { filePath } });

  await audit({ siteId: updated.siteId, packageRecordId: updated.id, action: 'STAGE', result: 'SUCCESS', actor, details: { source, warnings: parsed.warnings } });
  return serializePackageRecord(updated);
}

function cryptoRandomId() {
  return require('crypto').randomUUID();
}

/**
 * Validate a staged package: re-parse from disk, enforce one-active-Site policy, compute the
 * change preview, and create the pre-deployment backup (LC-ARCH-002 §7: preview and backup both
 * precede the operator's activate action).
 */
async function validatePackage(packageRecordId, { actor } = {}) {
  const record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  if (!['STAGED', 'VALIDATED', 'FAILED'].includes(record.status)) {
    throw new HttpError(409, `Package is in status ${record.status} and cannot be (re)validated`);
  }

  const buffer = readStagedPackage(record.filePath);
  const parsed = parseSitePackage(buffer);
  if (!parsed.ok) {
    const failed = await prisma.deploymentPackageRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', failureReason: parsed.errors.join('; '), validatedAt: new Date() },
    });
    await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'VALIDATE', result: 'FAILURE', actor, details: { errors: parsed.errors } });
    return serializePackageRecord(failed);
  }

  const commissioning = await getCommissioning();
  const policyError = checkOneActiveSitePolicy(commissioning, parsed.manifest);
  if (policyError) {
    const failed = await prisma.deploymentPackageRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', failureReason: policyError, validatedAt: new Date() },
    });
    await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'VALIDATE', result: 'FAILURE', actor, details: { reason: policyError } });
    return serializePackageRecord(failed);
  }

  const currentSite = await prisma.site.findUnique({
    where: { id: parsed.manifest.siteId },
    include: { activeReleaseVersion: { include: { payload: true } } },
  });
  const previousFiles = currentSite?.activeReleaseVersion?.payload?.payloadJson || null;
  const changePreview = computeChangePreview(previousFiles, parsed.files);

  // Pre-deployment backup: the previous release's own `files` bundle, so a later rollback can
  // re-apply it through the exact same activation code path (no separate "undo" logic to trust).
  const backup = await prisma.deploymentBackupRecord.create({
    data: {
      siteId: parsed.manifest.siteId,
      packageRecordId: record.id,
      reason: 'PRE_ACTIVATION',
      snapshotJson: previousFiles ? { siteVersionId: currentSite.activeReleaseVersionId, files: previousFiles } : { firstActivation: true },
    },
  });
  await audit({ siteId: parsed.manifest.siteId, packageRecordId: record.id, action: 'BACKUP', result: 'SUCCESS', actor, details: { backupId: backup.id } });

  const validated = await prisma.deploymentPackageRecord.update({
    where: { id: record.id },
    data: { status: 'VALIDATED', validatedAt: new Date(), changePreviewJson: changePreview, failureReason: null },
  });
  await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'VALIDATE', result: 'SUCCESS', actor, details: { warnings: parsed.warnings } });
  return serializePackageRecord(validated);
}

async function previewPackage(packageRecordId) {
  let record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  if (record.status === 'STAGED') {
    const validated = await validatePackage(packageRecordId);
    if (validated.status !== 'VALIDATED') return validated;
    record = validated;
  }
  return serializePackageRecord(record);
}

/**
 * Activate a VALIDATED package (LC-ARCH-002 §7 "Activation requirements"). The relational apply
 * (`applyPackageFiles`) runs inside one Prisma transaction, so a thrown error rolls back every
 * write Postgres made for this attempt automatically — "no partially created hierarchy records"
 * is a property of the transaction, not of extra bookkeeping here.
 */
async function activatePackage(packageRecordId, { actor } = {}) {
  const record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  if (record.status !== 'VALIDATED') throw new HttpError(409, `Package must be VALIDATED before activation (current status: ${record.status})`);

  const commissioning = await getCommissioning();
  const policyError = checkOneActiveSitePolicy(commissioning, { siteId: record.siteId });
  if (policyError) throw new HttpError(409, policyError);

  const buffer = readStagedPackage(record.filePath);
  const parsed = parseSitePackage(buffer);
  if (!parsed.ok) throw new HttpError(422, `Package failed re-validation at activation time: ${parsed.errors.join('; ')}`);

  await prisma.deploymentPackageRecord.update({ where: { id: record.id }, data: { status: 'ACTIVATING' } });
  await prisma.lsCommissioning.update({ where: { id: COMMISSIONING_ID }, data: { state: 'ACTIVATING' } });

  try {
    const result = await prisma.$transaction(async (tx) => {
      return applyPackageFiles(tx, record.siteId, parsed.files, {
        notes: parsed.manifest.releaseNotes,
        source: record.source,
      });
    });

    // Post-activation health check: the pointer we just set must actually resolve.
    const check = await prisma.site.findUnique({ where: { id: record.siteId }, include: { activeReleaseVersion: true } });
    if (!check?.activeReleaseVersion || check.activeReleaseVersion.id !== result.siteVersionId) {
      throw new Error('Post-activation validation failed: active release pointer did not resolve to the new version');
    }

    await prisma.deploymentPackageRecord.updateMany({
      where: { siteId: record.siteId, status: 'ACTIVE', id: { not: record.id } },
      data: { status: 'SUPERSEDED', supersededAt: new Date() },
    });
    const activated = await prisma.deploymentPackageRecord.update({
      where: { id: record.id },
      data: { status: 'ACTIVE', activatedAt: new Date(), createdSiteVersionId: result.siteVersionId },
    });
    await prisma.lsCommissioning.update({
      where: { id: COMMISSIONING_ID },
      data: { state: 'ACTIVE', activeSiteId: record.siteId, activePackageRecordId: record.id },
    });
    await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'ACTIVATE', result: 'SUCCESS', actor, details: { siteVersionId: result.siteVersionId, versionNumber: result.versionNumber } });
    await resyncLiveSimBindings().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[deployment] Runtime live-binding resync skipped:', e?.message || e);
    });
    return serializePackageRecord(activated);
  } catch (e) {
    // The transaction already rolled back every relational write for this attempt — restoring
    // LsCommissioning to what it was before this attempt is the only state left to reconcile
    // (LC-ARCH-002 §7 "Failed activation automatically returns to a known-good version when safe").
    const priorState = commissioning.activeSiteId ? 'ACTIVE' : 'UNCOMMISSIONED';
    const failed = await prisma.deploymentPackageRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', failureReason: e.message || String(e) },
    });
    await prisma.lsCommissioning.update({
      where: { id: COMMISSIONING_ID },
      data: { state: priorState, activeSiteId: commissioning.activeSiteId, activePackageRecordId: commissioning.activePackageRecordId },
    });
    await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'ACTIVATE', result: 'FAILURE', actor, details: { error: e.message || String(e) } });
    return serializePackageRecord(failed);
  }
}

/**
 * Roll back a Site's ACTIVE configuration to its previously-released version by re-applying that
 * version's own `files` bundle through the identical activation pipeline (LC-ARCH-002 §6
 * "Rollback: Reactivate the prior known-good site configuration"). History is append-only: this
 * creates a new SiteVersion carrying the old content rather than rewriting/deleting anything.
 */
async function rollbackToPreviousVersion(siteId, { actor } = {}) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { activeReleaseVersion: true } });
  if (!site?.activeReleaseVersion) throw new HttpError(404, 'Site has no active release to roll back from');
  const current = site.activeReleaseVersion;
  if (!current.parentVersionId) throw new HttpError(409, 'No prior version exists to roll back to');

  const parent = await prisma.siteVersion.findUnique({ where: { id: current.parentVersionId }, include: { payload: true } });
  if (!parent?.payload?.payloadJson) throw new HttpError(409, 'Prior version has no recoverable payload');

  await prisma.lsCommissioning.update({ where: { id: COMMISSIONING_ID }, data: { state: 'ROLLBACK' } }).catch(() => {});

  try {
    const result = await prisma.$transaction(async (tx) => applyPackageFiles(tx, siteId, parent.payload.payloadJson, { notes: `Rollback to v${parent.versionNumber}`, source: 'ROLLBACK' }));
    await prisma.lsCommissioning.update({ where: { id: COMMISSIONING_ID }, data: { state: 'ACTIVE', activeSiteId: siteId } });
    await audit({ siteId, action: 'ROLLBACK', result: 'SUCCESS', actor, details: { restoredFromVersionNumber: parent.versionNumber, newSiteVersionId: result.siteVersionId } });
    await resyncLiveSimBindings().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[deployment] Runtime live-binding resync skipped:', e?.message || e);
    });
    return { ok: true, siteVersionId: result.siteVersionId };
  } catch (e) {
    await prisma.lsCommissioning.update({ where: { id: COMMISSIONING_ID }, data: { state: 'FAILED' } }).catch(() => {});
    await audit({ siteId, action: 'ROLLBACK', result: 'FAILURE', actor, details: { error: e.message || String(e) } });
    throw e;
  }
}

/** Rebuilds a downloadable `.lspkg`-shaped archive from a stored backup snapshot. */
async function downloadBackup(backupId) {
  const backup = await prisma.deploymentBackupRecord.findUnique({ where: { id: backupId } });
  if (!backup) throw new HttpError(404, 'Backup not found');
  const files = backup.snapshotJson?.files;
  if (!files) throw new HttpError(409, 'This backup predates any activation and has nothing to export');

  const manifest = {
    packageSchemaVersion: require('../../lib/lspkg/manifest').PACKAGE_SCHEMA_VERSION,
    packageId: `backup-${backup.id}`,
    siteId: backup.siteId,
    siteName: files['site.json']?.site?.name || 'Unknown Site',
    projectVersion: `backup-${backup.createdAt.toISOString()}`,
    createdAt: backup.createdAt.toISOString(),
    author: null,
    toolVersion: require('../../../package.json').version,
    minLs100Version: '1.0.0',
    simulationPackage: false,
    deploymentScope: 'full-site',
    releaseNotes: `Pre-deployment backup captured ${backup.createdAt.toISOString()}`,
    files: Object.keys(files).sort(),
    checksums: Object.fromEntries(Object.entries(files).map(([name, obj]) => [name, sha256Hex(canonicalStringify(obj))])),
    signature: { signed: false, algorithm: 'none', signature: null, reason: 'Backup export is an unsigned development artifact.' },
  };
  const entries = [{ name: 'manifest.json', data: Buffer.from(canonicalStringify(manifest), 'utf8') }];
  for (const name of Object.keys(files).sort()) entries.push({ name, data: Buffer.from(canonicalStringify(files[name]), 'utf8') });
  return { buffer: buildZip(entries), fileName: `${manifest.siteName.replace(/[^a-zA-Z0-9_-]+/g, '_')}_backup_${backup.id}.lspkg` };
}

async function recommission({ actor, reason } = {}) {
  const commissioning = await getCommissioning();
  if (!commissioning.activeSiteId) throw new HttpError(409, 'LS-100 has no active Site to recommission away from');
  const siteId = commissioning.activeSiteId;
  await prisma.site.update({ where: { id: siteId }, data: { status: 'ARCHIVED' } });
  const updated = await prisma.lsCommissioning.update({
    where: { id: COMMISSIONING_ID },
    data: { state: 'UNCOMMISSIONED', activeSiteId: null, activePackageRecordId: null },
  });
  await audit({ siteId, action: 'RECOMMISSION', result: 'SUCCESS', actor, details: { reason: reason || null } });
  return updated;
}

async function getStatus() {
  const commissioning = await getCommissioning();
  const activePackage = commissioning.activePackageRecordId
    ? await prisma.deploymentPackageRecord.findUnique({ where: { id: commissioning.activePackageRecordId } })
    : null;
  return { commissioning, activePackage: serializePackageRecord(activePackage) };
}

async function listHistory(siteId) {
  const where = siteId ? { siteId } : {};
  const [packages, auditEntries] = await Promise.all([
    prisma.deploymentPackageRecord.findMany({ where, orderBy: { receivedAt: 'desc' } }),
    prisma.deploymentAuditEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);
  return { packages: packages.map(serializePackageRecord), auditEntries };
}

async function getPackageRecord(packageRecordId) {
  const record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  return serializePackageRecord(record);
}

async function discardPackage(packageRecordId, { actor } = {}) {
  const record = await prisma.deploymentPackageRecord.findUnique({ where: { id: packageRecordId } });
  if (!record) throw new HttpError(404, 'Package record not found');
  if (record.status === 'ACTIVE') throw new HttpError(409, 'Cannot discard the currently active package — recommission or roll back instead');
  deleteStagedPackage(record.filePath);
  const discarded = await prisma.deploymentPackageRecord.update({ where: { id: record.id }, data: { status: 'DISCARDED' } });
  await audit({ siteId: record.siteId, packageRecordId: record.id, action: 'DISCARD', result: 'SUCCESS', actor });
  return serializePackageRecord(discarded);
}

module.exports = {
  getCommissioning,
  stagePackage,
  validatePackage,
  previewPackage,
  activatePackage,
  rollbackToPreviousVersion,
  downloadBackup,
  recommission,
  getStatus,
  listHistory,
  getPackageRecord,
  discardPackage,
  checkOneActiveSitePolicy,
};
