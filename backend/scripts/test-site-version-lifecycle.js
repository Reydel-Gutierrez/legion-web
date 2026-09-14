'use strict';

// Phase 1 (LC-ARCH-003 "Engineering / Release / Live foundation") regression checks for the
// same-database SiteVersion lifecycle in `siteVersion.service.js`: BUILD RELEASE creates a new
// immutable version instead of mutating WORKING in place, DEPLOY activates a specific built
// release, ROLLBACK reactivates a prior release without duplicating it, a failed deploy leaves the
// previous active release untouched, and Operator/Live never sees an edited-but-undeployed WORKING
// version. Deterministic; no real database — a small in-memory Prisma-shaped stub with real
// transaction rollback-on-throw semantics (same technique as `test-deployment-pipeline.js`).
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

function makeDb() {
  const tables = {
    sites: [], buildings: [], floors: [], equipment: [], points: [], controllersMapped: [],
    pointsMapped: [], siteVersions: [], siteVersionPayloads: [],
    liveControllerBindings: [], livePointBindings: [], siteDeploymentEvents: [],
  };

  function genericModel(table) {
    return {
      findMany: async ({ where } = {}) => table.filter((r) => matchesWhere(r, where)),
      findFirst: async ({ where } = {}) => table.find((r) => matchesWhere(r, where)) || null,
      count: async ({ where } = {}) => table.filter((r) => matchesWhere(r, where)).length,
      findUnique: async ({ where }) => table.find((r) => r.id === where.id) || null,
      create: async ({ data }) => { const row = { id: data.id || `id-${table.length}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date(), updatedAt: new Date(), ...data }; table.push(row); return clone(row); },
      update: async ({ where, data }) => { const row = table.find((r) => r.id === where.id); if (!row) throw new Error('Record to update not found.'); Object.assign(row, data, { updatedAt: new Date() }); return clone(row); },
    };
  }

  let nextDeploymentEventSequence = 0;

  const db = {
    site: {
      ...genericModel(tables.sites),
      update: async ({ where, data }) => {
        const row = tables.sites.find((r) => r.id === where.id);
        if (!row) throw new Error('Record to update not found.');
        Object.assign(row, data, { updatedAt: new Date() });
        return clone(row);
      },
      findUnique: async ({ where, include }) => {
        const row = tables.sites.find((r) => r.id === where.id);
        if (!row) return null;
        const out = clone(row);
        if (include?.activeReleaseVersion) {
          const ver = tables.siteVersions.find((v) => v.id === row.activeReleaseVersionId) || null;
          out.activeReleaseVersion = ver
            ? { ...clone(ver), ...(include.activeReleaseVersion.include?.payload ? { payload: clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === ver.id) || null) } : {}) }
            : null;
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
    liveControllerBinding: {
      ...genericModel(tables.liveControllerBindings),
      deleteMany: async ({ where } = {}) => {
        const before = tables.liveControllerBindings.length;
        const keep = tables.liveControllerBindings.filter((r) => !matchesWhere(r, where));
        tables.liveControllerBindings.length = 0;
        tables.liveControllerBindings.push(...keep);
        return { count: before - tables.liveControllerBindings.length };
      },
    },
    livePointBinding: genericModel(tables.livePointBindings),
    siteDeploymentEvent: {
      ...genericModel(tables.siteDeploymentEvents),
      // Real Postgres assigns `sequence` via @default(autoincrement()), which — like any SQL
      // sequence — never rewinds even if the transaction that consumed a value rolls back. A
      // length-based counter would (a failed deploy's rollback would shrink the array and let a
      // later create reuse an already-used number), so use an ever-increasing counter instead.
      create: async ({ data }) => {
        nextDeploymentEventSequence += 1;
        const row = { id: `sde-${tables.siteDeploymentEvents.length}-${Math.random().toString(36).slice(2, 6)}`, sequence: nextDeploymentEventSequence, createdAt: new Date(), updatedAt: new Date(), ...data };
        tables.siteDeploymentEvents.push(row);
        return clone(row);
      },
    },
    siteVersion: {
      ...genericModel(tables.siteVersions),
      create: async ({ data, include }) => {
        const { payload, ...rest } = data;
        const row = { id: `sv-${tables.siteVersions.length}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date(), updatedAt: new Date(), ...rest };
        tables.siteVersions.push(row);
        if (payload?.create) tables.siteVersionPayloads.push({ id: `svp-${tables.siteVersionPayloads.length}`, siteVersionId: row.id, payloadJson: payload.create.payloadJson });
        const out = clone(row);
        if (include?.payload) out.payload = clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === row.id) || null);
        return out;
      },
      update: async ({ where, data, include }) => {
        const row = tables.siteVersions.find((r) => r.id === where.id);
        if (!row) throw new Error('Record to update not found.');
        const { payload, ...rest } = data;
        Object.assign(row, rest, { updatedAt: new Date() });
        if (payload?.update) {
          let p = tables.siteVersionPayloads.find((x) => x.siteVersionId === row.id);
          if (!p) { p = { id: `svp-${tables.siteVersionPayloads.length}`, siteVersionId: row.id, payloadJson: null }; tables.siteVersionPayloads.push(p); }
          p.payloadJson = payload.update.payloadJson;
        }
        const out = clone(row);
        if (include?.payload) out.payload = clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === row.id) || null);
        return out;
      },
      findUnique: async ({ where, include }) => {
        const row = tables.siteVersions.find((r) => r.id === where.id);
        if (!row) return null;
        const out = clone(row);
        if (include?.payload) out.payload = clone(tables.siteVersionPayloads.find((p) => p.siteVersionId === row.id) || null);
        return out;
      },
      findFirst: async ({ where, include } = {}) => {
        const row = tables.siteVersions.find((r) => matchesWhere(r, where));
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
    $transaction: async (fn) => {
      const txTables = ['sites', 'siteVersions', 'siteVersionPayloads', 'liveControllerBindings', 'livePointBindings', 'siteDeploymentEvents'];
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
stub('../src/lib/siteAccess', { ensureSeedOwnerSiteAccess: async () => {} });
stub('../src/lib/simCatalogBindingSync', { syncSimCatalogBindingsForSiteId: async () => {} });
// This suite is scoped to the SiteVersion lifecycle itself; the Engineering/Live controller+point
// binding boundary (what `resyncLiveSimBindings` would actually reconcile) has its own dedicated
// coverage in test-live-config-boundary.js.
stub('../src/modules/runtime/runtime.service', { resyncLiveSimBindings: async () => {} });

const siteVersionService = require('../src/modules/siteVersions/siteVersion.service');

function seedSite(siteId) {
  tables.sites.push({ id: siteId, name: 'Test Site', status: 'ACTIVE', timezone: null, siteType: null, description: null, displayLabel: null, engineeringNotes: null, icon: null, activeReleaseVersionId: null });
  const bId = `bld-${siteId}`; const fId = `flr-${siteId}`; const eqId = `eq-${siteId}-1`;
  tables.buildings.push({ id: bId, siteId, name: 'Building A', addressLine1: '1 St', addressLine2: null, city: 'C', state: 'S', postalCode: '0', country: 'US', latitude: null, longitude: null, status: 'ACTIVE', buildingType: null, buildingCode: null, description: null, sortOrder: 0 });
  tables.floors.push({ id: fId, buildingId: bId, name: 'Main Floor', status: 'ACTIVE', displayLabel: null, floorType: null, occupancyType: null, sortOrder: 0 });
  tables.equipment.push({ id: eqId, siteId, buildingId: bId, floorId: fId, name: 'FCU-1', code: 'FCU-1', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' });
  return { siteId, bId, fId, eqId };
}

async function main() {
  const siteId = 'site-1';
  const seed = seedSite(siteId);

  // ---------- A. Editing WORKING does not alter ACTIVE/LIVE ----------
  const working0 = await siteVersionService.getOrCreateWorkingVersion(siteId);
  assert.equal(working0.status, 'WORKING');
  assert.equal(await siteVersionService.getActiveRelease(siteId), null, 'brand-new site has no active release yet');

  await siteVersionService.putWorkingVersion(siteId, { payload: { ...working0.payload.payloadJson, engineeringNotes: 'draft note' } });
  assert.equal(await siteVersionService.getActiveRelease(siteId), null, 'editing WORKING still has no effect on active release (none exists yet)');

  // ---------- B. Building a release creates a RELEASED immutable snapshot (new row, not a mutation) ----------
  const workingBeforeBuild = await siteVersionService.getOrCreateWorkingVersion(siteId);
  const release1 = await siteVersionService.buildRelease(siteId, { builtBy: 'alice' });
  assert.equal(release1.status, 'RELEASED');
  assert.notEqual(release1.id, workingBeforeBuild.id, 'build creates a NEW SiteVersion row distinct from WORKING');
  assert.equal(release1.parentVersionId, null, 'the very first release has no parent release (never points at the mutable WORKING row)');
  assert.equal(release1.sourceWorkingVersionId, workingBeforeBuild.id, 'sourceWorkingVersionId records provenance separately from lineage');

  const workingAfterBuild = tables.siteVersions.find((v) => v.id === workingBeforeBuild.id);
  assert.equal(workingAfterBuild.status, 'WORKING', 'the working row is untouched by build (still WORKING)');
  assert.equal(await siteVersionService.getActiveRelease(siteId), null, 'building a release does not activate it');

  // ---------- C. A new working copy can continue from the release (here: the same one, never disturbed) ----------
  const workingAfterC = await siteVersionService.getOrCreateWorkingVersion(siteId);
  assert.equal(workingAfterC.id, workingBeforeBuild.id, 'engineering keeps editing the very same working copy after a build');

  // ---------- D. Deploying a release makes that release active ----------
  const activatedRelease1 = await siteVersionService.deployRelease(siteId, release1.id, { deployedBy: 'alice' });
  assert.equal(activatedRelease1.id, release1.id);
  assert(activatedRelease1.deployedAt, 'deployedAt stamped on activation');
  const activeAfterD = await siteVersionService.getActiveRelease(siteId);
  assert.equal(activeAfterD.id, release1.id, 'Site.activeReleaseVersionId now points at the deployed release');

  // ---------- H. Operator/Live reads active release, not Engineering working data ----------
  await siteVersionService.putWorkingVersion(siteId, { payload: { ...workingAfterC.payload.payloadJson, engineeringNotes: 'more unsaved edits after deploy' } });
  const activeAfterEdit = await siteVersionService.getActiveRelease(siteId);
  assert.equal(activeAfterEdit.id, release1.id, 'further WORKING edits never change which release is active');
  assert.deepEqual(activeAfterEdit.payload.payloadJson.site, activatedRelease1.payload.payloadJson.site, 'active release payload content is unchanged by later working edits');

  // ---------- I. Released versions cannot be modified through the working-version editing path ----------
  const releasedRowBeforePut = clone(tables.siteVersions.find((v) => v.id === release1.id));
  await siteVersionService.putWorkingVersion(siteId, { payload: { site: null, equipment: [] } });
  const releasedRowAfterPut = clone(tables.siteVersions.find((v) => v.id === release1.id));
  assert.deepEqual(releasedRowAfterPut, releasedRowBeforePut, 'PUT working-version never touches a RELEASED row');
  // restore a sane working payload for subsequent steps
  await siteVersionService.syncWorkingPayloadFromDb(siteId);

  // ---------- Build + deploy a second release (adds equipment first, like a real edit) ----------
  tables.equipment.push({ id: `eq-${siteId}-2`, siteId, buildingId: seed.bId, floorId: seed.fId, name: 'FCU-2', code: 'FCU-2', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' });
  const release2 = await siteVersionService.buildRelease(siteId, { builtBy: 'bob', notes: 'add FCU-2' });
  assert.equal(release2.payload.payloadJson.equipment.length, 2, 'release 2 snapshot picked up the new equipment');
  assert.equal(release1.payload.payloadJson.equipment.length, 1, 'release 1 snapshot is unaffected (immutable)');
  assert.equal(release2.parentVersionId, release1.id, 'release 2 chains to the currently active release, not to any WORKING row');
  assert.equal(release2.sourceWorkingVersionId, workingBeforeBuild.id, 'both releases were built from the same continuously-edited working row');

  // ---------- E. Deploying another release changes active release ----------
  const activatedRelease2 = await siteVersionService.deployRelease(siteId, release2.id, { deployedBy: 'bob' });
  assert.equal(activatedRelease2.id, release2.id);
  const activeAfterE = await siteVersionService.getActiveRelease(siteId);
  assert.equal(activeAfterE.id, release2.id, 'active release switched to release 2');
  assert.equal(activeAfterE.payload.payloadJson.equipment.length, 2);

  // ---------- G. A failed deployment does not destroy/change the previously active release ----------
  const activeBeforeFailure = clone(await siteVersionService.getActiveRelease(siteId));
  await assert.rejects(
    siteVersionService.deployRelease(siteId, 'does-not-exist', { deployedBy: 'carol' }),
    /not found/,
    'deploying a nonexistent version is rejected'
  );
  const activeAfterFailure = await siteVersionService.getActiveRelease(siteId);
  assert.deepEqual(activeAfterFailure, activeBeforeFailure, 'failed deploy leaves the previously active release completely unchanged');

  // A release that is still WORKING (never built) cannot be deployed either.
  const workingRow = tables.siteVersions.find((v) => v.status === 'WORKING' && v.siteId === siteId);
  await assert.rejects(
    siteVersionService.deployRelease(siteId, workingRow.id, {}),
    /not a built release/,
    'a WORKING version cannot be deployed directly'
  );

  // ---------- F. Rollback reactivates the previous released version (no duplication) ----------
  const releasedCountBeforeRollback = tables.siteVersions.filter((v) => v.status === 'RELEASED').length;
  const rolledBack = await siteVersionService.rollbackToPreviousRelease(siteId, { actor: 'dave' });
  assert.equal(rolledBack.id, release1.id, 'rollback reactivates release 1 (the previously active release)');
  const releasedCountAfterRollback = tables.siteVersions.filter((v) => v.status === 'RELEASED').length;
  assert.equal(releasedCountAfterRollback, releasedCountBeforeRollback, 'rollback creates zero new SiteVersion rows — it reactivates the existing immutable row');
  const activeAfterRollback = await siteVersionService.getActiveRelease(siteId);
  assert.equal(activeAfterRollback.id, release1.id);
  assert.equal(activeAfterRollback.payload.payloadJson.equipment.length, 1, 'rolled-back payload is release 1s original content, unmodified');

  // Rolling back again should go back to release 2 (most-recently-active-before-current).
  const rolledBackAgain = await siteVersionService.rollbackToPreviousRelease(siteId, { actor: 'dave' });
  assert.equal(rolledBackAgain.id, release2.id, 'a second rollback flips back to release 2');

  // ---------- J. Existing Site hierarchy and controller/point mappings survive the lifecycle ----------
  const finalEquipmentRows = await db.equipment.findMany({ where: { siteId } });
  assert.equal(finalEquipmentRows.length, 2, 'relational hierarchy rows were never deleted/recreated by build/deploy/rollback');

  // ---------- Combined build+deploy convenience (`deployWorkingVersion`) still works end-to-end ----------
  const beforeCombinedCount = tables.siteVersions.length;
  const combined = await siteVersionService.deployWorkingVersion(siteId, { deployedBy: 'erin', notes: 'one-click deploy' });
  assert.equal(combined.status, 'RELEASED');
  assert.equal(tables.siteVersions.length, beforeCombinedCount + 1, 'combined deploy adds exactly one new released version (no mutation of an existing row)');
  const activeAfterCombined = await siteVersionService.getActiveRelease(siteId);
  assert.equal(activeAfterCombined.id, combined.id);
  assert.equal(combined.createdBy, 'erin', 'builtBy is recorded from the deploy caller for the combined convenience path');
  assert.equal(combined.deployedBy, 'erin');
  assert.notEqual(combined.payload.payloadJson.deployedBy, undefined);

  // ---------- No hardcoded personal-name default for deployedBy ----------
  const releaseNoActor = await siteVersionService.buildRelease(siteId, {});
  const activatedNoActor = await siteVersionService.deployRelease(siteId, releaseNoActor.id, {});
  assert.equal(activatedNoActor.deployedBy, null, 'omitting deployedBy leaves it null — never a hardcoded personal name');
  assert.equal(activatedNoActor.payload.payloadJson.deployedBy, null);

  // ---------- Version history lists both WORKING and RELEASED rows ----------
  const history = await siteVersionService.listVersionHistory(siteId);
  assert(history.some((v) => v.status === 'WORKING'));
  assert(history.filter((v) => v.status === 'RELEASED').length >= 4);

  // ---------- Repeated Build/Edit/Build/Edit/Build: lineage must stay a clean release-to-release
  // chain, never ambiguous, even when some builds are never deployed. ----------
  const siteId2 = 'site-2';
  seedSite(siteId2);
  const workingLineage = await siteVersionService.getOrCreateWorkingVersion(siteId2);

  const rA = await siteVersionService.buildRelease(siteId2, { builtBy: 'x' }); // not deployed
  assert.equal(rA.parentVersionId, null, 'first-ever build: no parent release exists yet');
  assert.equal(rA.sourceWorkingVersionId, workingLineage.id);

  await siteVersionService.putWorkingVersion(siteId2, { payload: rA.payload.payloadJson });
  const rB = await siteVersionService.buildRelease(siteId2, { builtBy: 'x' }); // still not deployed
  assert.equal(rB.parentVersionId, null,
    'rA was never deployed, so rB (also built before any deploy) is a sibling, not a child of rA');
  assert.notEqual(rB.id, rA.id);

  await siteVersionService.deployRelease(siteId2, rB.id, { deployedBy: 'x' }); // rB becomes active

  await siteVersionService.putWorkingVersion(siteId2, { payload: rB.payload.payloadJson });
  const rC = await siteVersionService.buildRelease(siteId2, { builtBy: 'y' });
  assert.equal(rC.parentVersionId, rB.id, 'rC chains to rB, the currently active release');

  await siteVersionService.putWorkingVersion(siteId2, { payload: rC.payload.payloadJson });
  const rD = await siteVersionService.buildRelease(siteId2, { builtBy: 'y' }); // rC never deployed
  assert.equal(rD.parentVersionId, rB.id, 'rC was never deployed, so rD is also a child of rB, not rC');

  await siteVersionService.deployRelease(siteId2, rD.id, { deployedBy: 'y' }); // rD becomes active

  await siteVersionService.putWorkingVersion(siteId2, { payload: rD.payload.payloadJson });
  const rE = await siteVersionService.buildRelease(siteId2, { builtBy: 'z' });
  assert.equal(rE.parentVersionId, rD.id, 'rE chains to rD, the currently active release');

  // Every release in this whole run was built from the SAME continuously-edited working row —
  // sourceWorkingVersionId (provenance) never gets confused with parentVersionId (lineage).
  for (const r of [rA, rB, rC, rD, rE]) {
    assert.equal(r.sourceWorkingVersionId, workingLineage.id);
  }
  // Every release has a distinct, strictly increasing version number — no ambiguity.
  const numbers = [rA, rB, rC, rD, rE].map((r) => r.versionNumber);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), 'version numbers increase monotonically');
  assert.equal(new Set(numbers).size, 5, 'every build gets its own distinct version number');

  // ---------- Deployment ledger: "previous release" must derive from actual activation history,
  // not from a mutable last-activated timestamp on the release row (which cannot distinguish
  // non-adjacent rollbacks correctly once a release has been activated more than once). ----------
  const siteId3 = 'site-3';
  seedSite(siteId3);
  const relX = await siteVersionService.deployWorkingVersion(siteId3, { deployedBy: 'p' }); // v1 active
  await siteVersionService.putWorkingVersion(siteId3, { payload: relX.payload.payloadJson });
  const relY = await siteVersionService.deployWorkingVersion(siteId3, { deployedBy: 'p' }); // v2 active
  await siteVersionService.putWorkingVersion(siteId3, { payload: relY.payload.payloadJson });
  const relZ = await siteVersionService.deployWorkingVersion(siteId3, { deployedBy: 'p' }); // v3 active

  // Explicit rollback to X (skipping Y) — a real "go back two steps" operation, not "the previous one".
  await siteVersionService.rollbackToVersion(siteId3, relX.id, { actor: 'q' });
  assert.equal((await siteVersionService.getActiveRelease(siteId3)).id, relX.id);

  // "Rollback to previous" from here must go back to Z (the release active immediately before this
  // rollback), NOT Y — a deployedAt-only view could plausibly get this wrong once a release's own
  // timestamp has been overwritten by more than one activation; the ledger cannot.
  const backToZ = await siteVersionService.rollbackToPreviousRelease(siteId3, { actor: 'q' });
  assert.equal(backToZ.id, relZ.id, 'previous-release derivation follows actual activation history, not release version order');

  const events3 = await siteVersionService.listDeploymentEvents(siteId3);
  assert.equal(events3.length, 5, 'every DEPLOY/ROLLBACK is recorded, including repeats — nothing is overwritten');
  assert.deepEqual(
    events3.map((e) => e.action),
    ['ROLLBACK', 'ROLLBACK', 'DEPLOY', 'DEPLOY', 'DEPLOY'],
    'ledger is newest-first and records every activation action in order'
  );
  assert.equal(events3[0].releaseVersionId, relZ.id);
  assert.equal(events3[0].previousReleaseVersionId, relX.id, 'each event records what was active immediately before it');
  assert.equal(events3[1].releaseVersionId, relX.id);
  assert.equal(events3[1].previousReleaseVersionId, relZ.id);

  console.log('OK: SiteVersion Engineering/Release/Live lifecycle verified (build-vs-mutate, independent deploy, rollback without duplication, failed-deploy safety, working-edit isolation from active release, released-version immutability, no hardcoded deployedBy default, stable release-to-release lineage across repeated build/edit cycles, ledger-derived previous-release rollback).');
}

main().catch((err) => { console.error(err); process.exit(1); });
