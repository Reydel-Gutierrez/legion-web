'use strict';

// Phase 3 focused regression checks for the LS-100 staging/activation pipeline: one active Site
// enforcement, same-Site upgrade vs different-Site rejection, change-preview accuracy, stable-id
// upsert (not delete+recreate), explicit removal, failed-activation rollback with no partial
// state, users/audit/history preservation, offline import, and direct-deploy reusing the same
// pipeline. Deterministic; no real database — a small in-memory Prisma-shaped stub with real
// transaction rollback-on-throw semantics (see `makeDb` below).
const assert = require('assert').strict;
const path = require('path');

function stub(relative, exports) {
  const filename = require.resolve(path.join(__dirname, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('in' in cond) return cond.in.includes(row[key]);
      if ('not' in cond) return row[key] !== cond.not;
      return false;
    }
    return row[key] === cond;
  });
}

// ---- Minimal in-memory, transactional Prisma-shaped stub ----
function makeDb() {
  const tables = {
    sites: [], buildings: [], floors: [], equipment: [], points: [], controllersMapped: [],
    pointsMapped: [], alarmDefinitions: [], trendDefinitions: [], trendAssignments: [],
    scheduleDefinitions: [], scheduleAssignments: [], siteVersions: [], siteVersionPayloads: [],
    users: [], lsCommissioning: [], deploymentPackageRecords: [], deploymentBackupRecords: [],
    deploymentAuditEntries: [], liveControllerBindings: [], livePointBindings: [],
  };

  /**
   * @param {string[]} [jsonNullableFields] - Json? columns for this model. Real Prisma throws
   * "Argument <field> must not be null. Please use undefined instead." for a literal `null` on a
   * nullable Json field (an already-caught live bug — see `backend/prisma/schema.prisma`'s
   * `changePreviewJson`/`validationErrorsJson`/`detailsJson`) — the earlier version of this stub
   * silently accepted `null` and missed it, so every JSON-bearing model must pass its nullable
   * Json field names here to keep this stub honest.
   */
  function genericModel(table, jsonNullableFields = []) {
    function assertNoLiteralJsonNull(data) {
      for (const field of jsonNullableFields) {
        if (data[field] === null) {
          throw new Error(`Argument ${field} must not be null. Please use undefined instead.`);
        }
      }
    }
    return {
      findMany: async ({ where } = {}) => table.filter((r) => matchesWhere(r, where)),
      findFirst: async ({ where } = {}) => table.find((r) => matchesWhere(r, where)) || null,
      count: async ({ where } = {}) => table.filter((r) => matchesWhere(r, where)).length,
      findUnique: async ({ where }) => table.find((r) => r.id === where.id) || null,
      create: async ({ data }) => { assertNoLiteralJsonNull(data); const row = { id: data.id || `id-${table.length}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date(), updatedAt: new Date(), ...data }; table.push(row); return clone(row); },
      update: async ({ where, data }) => { assertNoLiteralJsonNull(data); const row = table.find((r) => r.id === where.id); if (!row) throw new Error('Record to update not found.'); Object.assign(row, data, { updatedAt: new Date() }); return clone(row); },
      updateMany: async ({ where, data }) => { assertNoLiteralJsonNull(data); const rows = table.filter((r) => matchesWhere(r, where)); rows.forEach((r) => Object.assign(r, data, { updatedAt: new Date() })); return { count: rows.length }; },
      upsert: async ({ where, create, update }) => {
        assertNoLiteralJsonNull(create); assertNoLiteralJsonNull(update);
        const row = table.find((r) => r.id === where.id);
        if (row) { Object.assign(row, update, { updatedAt: new Date() }); return clone(row); }
        const created = { id: where.id, createdAt: new Date(), updatedAt: new Date(), ...create };
        table.push(created);
        return clone(created);
      },
      deleteMany: async ({ where } = {}) => {
        const before = table.length;
        const keep = table.filter((r) => !matchesWhere(r, where));
        table.length = 0; table.push(...keep);
        return { count: before - table.length };
      },
    };
  }

  const db = {
    site: {
      ...genericModel(tables.sites),
      findUnique: async ({ where, include }) => {
        const row = tables.sites.find((r) => r.id === where.id);
        if (!row) return null;
        const out = clone(row);
        if (include?.activeReleaseVersion) {
          const ver = tables.siteVersions.find((v) => v.id === row.activeReleaseVersionId) || null;
          out.activeReleaseVersion = ver ? { ...clone(ver), ...(include.activeReleaseVersion.include?.payload ? { payload: clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === ver.id) || null) } : {}) } : null;
        }
        return out;
      },
    },
    building: genericModel(tables.buildings),
    floor: genericModel(tables.floors),
    equipment: genericModel(tables.equipment),
    point: genericModel(tables.points),
    controllersMapped: genericModel(tables.controllersMapped),
    pointsMapped: genericModel(tables.pointsMapped),
    liveControllerBinding: genericModel(tables.liveControllerBindings),
    livePointBinding: genericModel(tables.livePointBindings),
    alarmDefinition: genericModel(tables.alarmDefinitions, ['conditionTree']),
    trendDefinition: genericModel(tables.trendDefinitions),
    trendAssignment: genericModel(tables.trendAssignments),
    scheduleDefinition: genericModel(tables.scheduleDefinitions),
    scheduleAssignment: genericModel(tables.scheduleAssignments),
    user: genericModel(tables.users),
    lsCommissioning: genericModel(tables.lsCommissioning),
    deploymentPackageRecord: genericModel(tables.deploymentPackageRecords, ['changePreviewJson', 'validationErrorsJson']),
    deploymentBackupRecord: genericModel(tables.deploymentBackupRecords),
    deploymentAuditEntry: genericModel(tables.deploymentAuditEntries, ['detailsJson']),
    siteVersion: {
      ...genericModel(tables.siteVersions),
      create: async ({ data }) => {
        const { payload, ...rest } = data;
        const row = { id: `sv-${tables.siteVersions.length}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date(), updatedAt: new Date(), ...rest };
        tables.siteVersions.push(row);
        if (payload?.create) tables.siteVersionPayloads.push({ id: `svp-${tables.siteVersionPayloads.length}`, siteVersionId: row.id, payloadJson: payload.create.payloadJson });
        return clone(row);
      },
      findUnique: async ({ where, include }) => {
        const row = tables.siteVersions.find((r) => r.id === where.id);
        if (!row) return null;
        const out = clone(row);
        if (include?.payload) out.payload = clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === row.id) || null);
        return out;
      },
      aggregate: async ({ where, _max }) => {
        const rows = tables.siteVersions.filter((r) => matchesWhere(r, where));
        const max = rows.reduce((m, r) => Math.max(m, r.versionNumber || 0), 0);
        return { _max: { versionNumber: rows.length ? max : null } };
      },
    },
    // Only the relational hierarchy tables `activation.service.js` actually writes inside a real
    // `prisma.$transaction` are snapshotted/restored here — package/backup/audit/commissioning
    // bookkeeping deliberately happens OUTSIDE that transaction in deployment.service.js (a real
    // Postgres transaction only ever affects the statements run against it, never unrelated rows).
    $transaction: async (fn) => {
      const txTables = ['sites', 'buildings', 'floors', 'equipment', 'points', 'controllersMapped', 'pointsMapped', 'liveControllerBindings', 'livePointBindings', 'alarmDefinitions', 'trendDefinitions', 'trendAssignments', 'scheduleDefinitions', 'scheduleAssignments', 'siteVersions', 'siteVersionPayloads'];
      const snapshot = Object.fromEntries(txTables.map((k) => [k, tables[k].map((r) => ({ ...r }))]));
      try {
        return await fn(db);
      } catch (e) {
        for (const k of txTables) { tables[k].length = 0; tables[k].push(...snapshot[k]); }
        throw e;
      }
    },
  };

  return { db, tables };
}

const { db, tables } = makeDb();
stub('../src/lib/prisma', db);
// LC-ARCH-004 Phase 2: avoid an incidental real network call to whatever LEGION_RUNTIME_URL happens
// to resolve to in this shell — this suite is a hermetic, no-real-database/no-network unit test.
stub('../src/modules/runtime/runtime.service', { resyncLiveSimBindings: async () => {} });

const deploymentService = require('../src/modules/deployment/deployment.service');
const { buildSitePackage } = require('../src/lib/lspkg/builder');
const { parseSitePackage } = require('../src/lib/lspkg/parser');

function seedSite(siteId, name, equipmentPrefix) {
  tables.sites.push({ id: siteId, name, status: 'ACTIVE', timezone: null, siteType: null, description: null, displayLabel: null, engineeringNotes: null, icon: null, activeReleaseVersionId: null });
  const bId = `bld-${siteId}`; const fId = `flr-${siteId}`;
  tables.buildings.push({ id: bId, siteId, name: `${name} Building`, addressLine1: '1 St', addressLine2: null, city: 'C', state: 'S', postalCode: '0', country: 'US', latitude: null, longitude: null, status: 'ACTIVE', buildingType: null, buildingCode: null, description: null, sortOrder: 0 });
  tables.floors.push({ id: fId, buildingId: bId, name: 'Main Floor', status: 'ACTIVE', displayLabel: null, floorType: null, occupancyType: null, sortOrder: 0 });
  const eqId = `${equipmentPrefix}-1`;
  tables.equipment.push({ id: eqId, siteId, buildingId: bId, floorId: fId, name: equipmentPrefix, code: equipmentPrefix, equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' });
  tables.points.push({ id: `${eqId}-pt1`, equipmentId: eqId, pointCode: 'SPACE_TEMP', pointName: 'Space Temp', pointType: 'AI', unit: 'degF', writable: false, presentValue: null, commState: 'ONLINE', lastSeenAt: null, status: 'ACTIVE' });
  return { siteId, bId, fId, eqId };
}

async function buildPackageFor(siteId) {
  const built = await buildSitePackage(siteId, { packageId: `pkg-${siteId}-${Date.now()}-${Math.random()}` });
  return built;
}

async function main() {
  // ---------- Offline import: stage → validate → preview → activate (first-ever commissioning) ----------
  const siteA = seedSite('site-a', 'Site A', 'FCU-A');
  const builtA = await buildPackageFor(siteA.siteId);

  const staged = await deploymentService.stagePackage(builtA.buffer, { source: 'OFFLINE_IMPORT', actor: 'tester' });
  assert.equal(staged.status, 'STAGED');
  assert.equal(staged.source, 'OFFLINE_IMPORT');

  const validated = await deploymentService.validatePackage(staged.id, { actor: 'tester' });
  assert.equal(validated.status, 'VALIDATED', JSON.stringify(validated));
  assert(validated.changePreview, 'validate computes a change preview');
  assert.equal(validated.changePreview.collections.equipment.added.length, 1, 'first activation: equipment is all-added');

  const previewed = await deploymentService.previewPackage(staged.id);
  assert.equal(previewed.status, 'VALIDATED');
  assert.deepEqual(previewed.changePreview, validated.changePreview, 'preview matches what validate computed');

  const activated = await deploymentService.activatePackage(staged.id, { actor: 'tester' });
  assert.equal(activated.status, 'ACTIVE', JSON.stringify(activated));
  assert(activated.createdSiteVersionId);

  const statusAfterFirst = await deploymentService.getStatus();
  assert.equal(statusAfterFirst.commissioning.state, 'ACTIVE');
  assert.equal(statusAfterFirst.commissioning.activeSiteId, 'site-a');

  // Operator Mode reads only Site.activeReleaseVersion.payload — confirm activation actually set it,
  // and that it holds exactly the package's own file bundle (what Operator would read).
  const siteAAfter = await db.site.findUnique({ where: { id: 'site-a' }, include: { activeReleaseVersion: { include: { payload: true } } } });
  assert.deepEqual(siteAAfter.activeReleaseVersion.payload.payloadJson, builtA.files, 'active release payload is exactly the activated package content');

  // ---------- Different-Site rejection (DEP-001) ----------
  const siteB = seedSite('site-b', 'Site B', 'FCU-B');
  const builtB = await buildPackageFor(siteB.siteId);
  const stagedB = await deploymentService.stagePackage(builtB.buffer, { source: 'OFFLINE_IMPORT' });
  const validatedB = await deploymentService.validatePackage(stagedB.id);
  assert.equal(validatedB.status, 'FAILED', 'a different Site is rejected while one is already active');
  assert.match(validatedB.failureReason, /already has an active Site/);
  await assert.rejects(deploymentService.activatePackage(stagedB.id), /must be VALIDATED before activation/, 'a FAILED (rejected) package can never be activated');

  // Site B must not have been touched at all.
  const siteBRow = tables.sites.find((s) => s.id === 'site-b');
  assert.equal(siteBRow.activeReleaseVersionId, null, 'rejected different-Site package never activates');

  // ---------- Same-Site version upgrade: stable ids preserved, explicit removal honored ----------
  tables.equipment.push({ id: 'FCU-A-2', siteId: 'site-a', buildingId: siteA.bId, floorId: siteA.fId, name: 'FCU-A-2', code: 'FCU-A-2', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' });
  const upgradedBuilt = await buildSitePackage('site-a', { packageId: `pkg-upgrade-${Date.now()}` });
  assert.equal(upgradedBuilt.files['equipment.json'].equipment.length, 2, 'new equipment picked up by rebuild');

  const stagedUpgrade = await deploymentService.stagePackage(upgradedBuilt.buffer, { source: 'DIRECT' });
  const validatedUpgrade = await deploymentService.validatePackage(stagedUpgrade.id);
  assert.equal(validatedUpgrade.status, 'VALIDATED');
  assert.equal(validatedUpgrade.changePreview.collections.equipment.added.length, 1, 'exactly one equipment addition detected');
  assert.equal(validatedUpgrade.changePreview.collections.equipment.preserved.length, 1, 'the original equipment row is preserved, not recreated');

  const activatedUpgrade = await deploymentService.activatePackage(stagedUpgrade.id);
  assert.equal(activatedUpgrade.status, 'ACTIVE');
  const eqRow = tables.equipment.find((e) => e.id === siteA.eqId);
  assert(eqRow, 'original equipment id survives the upgrade (upsert by stable id, not delete+recreate)');
  assert.equal(tables.equipment.filter((e) => e.siteId === 'site-a').length, 2);

  // The previously-ACTIVE package record for this site is now SUPERSEDED, not deleted.
  const supersededCheck = await deploymentService.getPackageRecord(staged.id);
  assert.equal(supersededCheck.status, 'SUPERSEDED');

  // Now remove FCU-A-2 in the next package version — confirm explicit removal is applied. A
  // package always reflects real DB content (builder.js queries relationally), so the realistic
  // way to produce a package "missing" a row is to delete it from the DB, build, then restore the
  // DB row — the activation itself is what must apply the removal, not this test's fixture setup.
  const removalIdx = tables.equipment.findIndex((e) => e.id === 'FCU-A-2');
  const removedRow = tables.equipment.splice(removalIdx, 1)[0];
  const removalBuilt = await buildSitePackage('site-a', { packageId: `pkg-removal-${Date.now()}` });
  tables.equipment.push(removedRow); // restore in the DB; the package itself no longer references it

  const stagedRemoval = await deploymentService.stagePackage(removalBuilt.buffer, { source: 'DIRECT' });
  const validatedRemoval = await deploymentService.validatePackage(stagedRemoval.id);
  assert.equal(validatedRemoval.changePreview.collections.equipment.removed.length, 1, 'removal is detected in the change preview before activation');
  const activatedRemoval = await deploymentService.activatePackage(stagedRemoval.id);
  assert.equal(activatedRemoval.status, 'ACTIVE');
  assert.equal(tables.equipment.filter((e) => e.siteId === 'site-a').length, 1, 'removed equipment is actually deleted on activation');
  assert(!tables.points.some((p) => p.equipmentId === 'FCU-A-2'), 'points under removed equipment are gone too (cascade)');

  // ---------- Failed activation: no partial state, commissioning state restored ----------
  const beforeFailureEquipmentCount = tables.equipment.filter((e) => e.siteId === 'site-a').length;
  const beforeFailureCommissioning = { ...(await deploymentService.getCommissioning()) };
  const builtForFailure = await buildSitePackage('site-a', { packageId: `pkg-fail-${Date.now()}` });
  // Corrupt the package's own equipment.json content post-build so activation's relational apply
  // will attempt to write bad data — the point.equipmentId will reference nothing in the package's
  // equipment map, which is intentionally skipped rather than failing (defensive), so instead force
  // a real failure by making the Equipment upsert throw: give it a status value that trips a runtime
  // error path (missing required field) — simulate by deleting a required field.
  builtForFailure.files['equipment.json'].equipment[0].siteId = undefined; // still required at write-time in a real Prisma client
  const stagedFail = await deploymentService.stagePackage(builtForFailure.buffer, { source: 'DIRECT' });
  const validatedFail = await deploymentService.validatePackage(stagedFail.id);
  assert.equal(validatedFail.status, 'VALIDATED');

  // Force an activation failure deterministically by making the stub's equipment.upsert throw once.
  const originalUpsert = db.equipment.upsert;
  db.equipment.upsert = async () => { throw new Error('simulated write failure'); };
  const failedActivation = await deploymentService.activatePackage(stagedFail.id);
  db.equipment.upsert = originalUpsert;

  assert.equal(failedActivation.status, 'FAILED', JSON.stringify(failedActivation));
  assert.match(failedActivation.failureReason, /simulated write failure/);
  assert.equal(tables.equipment.filter((e) => e.siteId === 'site-a').length, beforeFailureEquipmentCount, 'failed activation leaves zero equipment-count change — no partial hierarchy');
  const commissioningAfterFailure = await deploymentService.getCommissioning();
  assert.equal(commissioningAfterFailure.state, 'ACTIVE', 'commissioning state returns to ACTIVE (the known-good prior state), not stuck in ACTIVATING');
  assert.equal(commissioningAfterFailure.activeSiteId, beforeFailureCommissioning.activeSiteId);
  // The still-ACTIVE package record must be unchanged (not superseded by a failed attempt).
  const stillActiveRecord = await deploymentService.getPackageRecord(activatedRemoval.id);
  assert.equal(stillActiveRecord.status, 'ACTIVE');

  // ---------- Rollback: restores the prior version's relational content ----------
  const beforeRollbackCount = tables.equipment.filter((e) => e.siteId === 'site-a').length;
  const rollbackResult = await deploymentService.rollbackToPreviousVersion('site-a', { actor: 'tester' });
  assert(rollbackResult.ok);
  // Rolling back from "removal" activation restores FCU-A-2 (the version before removal had 2).
  assert.equal(tables.equipment.filter((e) => e.siteId === 'site-a').length, beforeRollbackCount + 1, 'rollback restores the previously-removed equipment row');
  const commissioningAfterRollback = await deploymentService.getCommissioning();
  assert.equal(commissioningAfterRollback.state, 'ACTIVE');

  // ---------- Users / audit / history are never touched by activation ----------
  tables.users.push({ id: 'user-1', email: 'op@example.com', name: 'Operator', status: 'ACTIVE' });
  const usersBefore = clone(tables.users);
  await buildSitePackage('site-a', { packageId: 'pkg-noop-users' }).then((b) =>
    deploymentService.stagePackage(b.buffer, { source: 'DIRECT' }).then((r) => deploymentService.validatePackage(r.id).then(() => deploymentService.activatePackage(r.id)))
  );
  assert.deepEqual(tables.users, usersBefore, 'User rows are never created/modified/deleted by activation');

  const history = await deploymentService.listHistory('site-a');
  assert(history.packages.length >= 5, 'package history accumulates across builds (never deleted)');
  assert(history.auditEntries.length > 0, 'audit trail recorded for stage/validate/backup/activate/rollback');
  assert(history.auditEntries.some((e) => e.action === 'ROLLBACK' && e.result === 'SUCCESS'));
  assert(history.auditEntries.some((e) => e.action === 'ACTIVATE' && e.result === 'FAILURE'));

  // ---------- Backup download produces a re-importable package ----------
  const anyBackup = tables.deploymentBackupRecords.find((b) => b.siteId === 'site-a' && b.snapshotJson?.files);
  assert(anyBackup, 'a real (non-first-activation) backup exists');
  const backupExport = await deploymentService.downloadBackup(anyBackup.id);
  const parsedBackup = parseSitePackage(backupExport.buffer);
  assert.equal(parsedBackup.ok, true, `backup re-parses as a valid package: ${JSON.stringify(parsedBackup.errors)}`);

  // ---------- Recommissioning: required before a different Site may activate ----------
  const recommissioned = await deploymentService.recommission({ actor: 'tester', reason: 'test recommission' });
  assert.equal(recommissioned.state, 'UNCOMMISSIONED');
  assert.equal(recommissioned.activeSiteId, null);
  assert.equal(tables.sites.find((s) => s.id === 'site-a').status, 'ARCHIVED', 'recommissioning archives the outgoing Site rather than deleting it');

  const validatedBAfterRecommission = await deploymentService.validatePackage(stagedB.id);
  assert.equal(validatedBAfterRecommission.status, 'VALIDATED', 'Site B may now activate after Site A was explicitly recommissioned');
  const activatedB = await deploymentService.activatePackage(stagedB.id);
  assert.equal(activatedB.status, 'ACTIVE');
  const statusFinal = await deploymentService.getStatus();
  assert.equal(statusFinal.commissioning.activeSiteId, 'site-b');

  console.log('OK: deployment pipeline verified (offline import, one-active-Site enforcement, same-Site stable-id upgrade, explicit removal, failed-activation rollback with no partial state, users/audit/history preservation, rollback-to-prior-version, backup re-export, recommissioning).');
}

main().catch((err) => { console.error(err); process.exit(1); });
