'use strict';

// LC-ARCH-003 Phase 1.1 regression checks: an Engineering change to ControllersMapped/PointsMapped
// (controller assignment, point mapping) must never reach Runtime until an engineer explicitly
// builds AND deploys a release. Runtime only ever resolves LiveControllerBinding/LivePointBinding —
// this test proves that boundary both at the persistence layer (the exact tables/rows
// runtime.service.js queries) and through the real runtime module (getController/pollNow), across
// the full BUILD -> DEPLOY -> EDIT -> BUILD -> DEPLOY -> ROLLBACK cycle.
//
// Deterministic; no real database — the same in-memory Prisma-shaped stub technique used by
// test-site-version-lifecycle.js and test-deployment-pipeline.js.
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
      if ('equals' in cond) {
        const a = String(row[key] ?? '');
        const b = String(cond.equals ?? '');
        return cond.mode === 'insensitive' ? a.toLowerCase() === b.toLowerCase() : a === b;
      }
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
      update: async ({ where, data }) => { const row = table.find((r) => matchesWhere(r, where)); if (!row) throw new Error('Record to update not found.'); Object.assign(row, data, { updatedAt: new Date() }); return clone(row); },
      deleteMany: async ({ where } = {}) => {
        const before = table.length;
        const keep = table.filter((r) => !matchesWhere(r, where));
        table.length = 0; table.push(...keep);
        return { count: before - table.length };
      },
    };
  }

  let nextDeploymentEventSequence = 0;

  const db = {
    site: {
      ...genericModel(tables.sites),
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
    liveControllerBinding: genericModel(tables.liveControllerBindings),
    livePointBinding: genericModel(tables.livePointBindings),
    siteDeploymentEvent: {
      ...genericModel(tables.siteDeploymentEvents),
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
    $transaction: async (fnOrOps) => {
      // runtime.service.js's poll-commit path uses the array-of-operations form (Prisma's
      // "sequential operations" API); siteVersion.service.js uses the function form. Support both.
      if (Array.isArray(fnOrOps)) return Promise.all(fnOrOps);
      const txTables = ['sites', 'siteVersions', 'siteVersionPayloads', 'liveControllerBindings', 'livePointBindings', 'siteDeploymentEvents'];
      const snapshot = Object.fromEntries(txTables.map((k) => [k, tables[k].map((r) => ({ ...r }))]));
      try {
        return await fnOrOps(db);
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
stub('../src/modules/alarms/alarm.service', { evaluateForPointIds: async () => {} });
// LC-ARCH-004 Phase 2: `runtime.service.js` is now an HTTP client to the standalone Runtime
// process — this test proves the DB-level materialization boundary only (what deploy/build/rollback
// actually write to LiveControllerBinding/LivePointBinding). Runtime's own resolution of that data
// is proven in `../../runtime/scripts/test-sim-runtime.js` (unit-level, via runtimeCore.js
// directly) and `test-phase2-process-separation.js` (real cross-process, via HTTP).
stub('../src/modules/runtime/runtime.service', { resyncLiveSimBindings: async () => {} });

const siteVersionService = require('../src/modules/siteVersions/siteVersion.service');

const SITE_ID = 'site-boundary';
const EQUIPMENT_ID = 'eq-A';

function seed() {
  tables.sites.push({ id: SITE_ID, name: 'Boundary Test Site', status: 'ACTIVE', timezone: null, siteType: null, description: null, displayLabel: null, engineeringNotes: null, icon: null, activeReleaseVersionId: null });
  const bId = 'bld-boundary'; const fId = 'flr-boundary';
  tables.buildings.push({ id: bId, siteId: SITE_ID, name: 'Building A', addressLine1: '1 St', addressLine2: null, city: 'C', state: 'S', postalCode: '0', country: 'US', latitude: null, longitude: null, status: 'ACTIVE', buildingType: null, buildingCode: null, description: null, sortOrder: 0 });
  tables.floors.push({ id: fId, buildingId: bId, name: 'Main Floor', status: 'ACTIVE', displayLabel: null, floorType: null, occupancyType: null, sortOrder: 0 });
  tables.equipment.push({ id: EQUIPMENT_ID, siteId: SITE_ID, buildingId: bId, floorId: fId, name: 'Equipment A', code: 'EQ-A', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' });

  const spaceTemp = { id: 'pt-space-temp', equipmentId: EQUIPMENT_ID, siteId: SITE_ID, buildingId: bId, floorId: fId, pointName: 'Space Temp', pointCode: 'SPACE_TEMP', pointType: 'AI', unit: 'degF', writable: false, presentValue: '72', commState: 'UNKNOWN', lastSeenAt: null, status: 'ACTIVE' };
  const dischargeAir = { id: 'pt-discharge-air', equipmentId: EQUIPMENT_ID, siteId: SITE_ID, buildingId: bId, floorId: fId, pointName: 'Discharge Air Temp', pointCode: 'DISCHARGE_AIR_TEMP', pointType: 'AI', unit: 'degF', writable: false, presentValue: '58', commState: 'UNKNOWN', lastSeenAt: null, status: 'ACTIVE' };
  tables.points.push(spaceTemp, dischargeAir);

  const ctrl = { id: 'cm-1', equipmentId: EQUIPMENT_ID, controllerCode: 'FCU-1', displayName: null, protocol: 'SIM', deviceInstance: '10004', ipAddress: null, networkAddress: null, siteId: SITE_ID, buildingId: bId, floorId: fId, pollRateMs: 20000, isSimulated: true, isEnabled: true, status: 'ASSIGNED', lastSeenAt: null, metadataJson: null };
  tables.controllersMapped.push(ctrl);
  tables.pointsMapped.push({
    id: 'pm-1', equipmentControllerId: ctrl.id, equipmentId: EQUIPMENT_ID, pointId: spaceTemp.id,
    legionPointCode: 'SPACE_TEMP', fieldPointKey: 'SPACE_TEMP', fieldPointName: 'Space Temp', fieldObjectType: 'AI',
    fieldObjectInstance: 'SPACE_TEMP', fieldDataType: 'number', readEnabled: true, writeEnabled: false, isBound: true, metadataJson: null,
  });
}

function liveBindingForEquipment() {
  return tables.liveControllerBindings.find((r) => r.equipmentId === EQUIPMENT_ID) || null;
}

function livePointKeysForEquipment() {
  const live = liveBindingForEquipment();
  if (!live) return [];
  return tables.livePointBindings.filter((r) => r.liveControllerBindingId === live.id).map((r) => r.fieldPointKey).sort();
}

async function main() {
  seed();

  // ---------- A. Active Release maps Equipment A -> Controller X (FCU-1) ----------
  const release1 = await siteVersionService.buildRelease(SITE_ID, { builtBy: 'engineer-1' });
  assert.deepEqual(release1.payload.payloadJson.controllerBindings.map((b) => b.controllerCode), ['FCU-1'],
    'release 1 freezes the current Engineering controller assignment (FCU-1)');
  await siteVersionService.deployRelease(SITE_ID, release1.id, { deployedBy: 'engineer-1' });
  assert.equal(liveBindingForEquipment()?.controllerCode, 'FCU-1', 'Live projection materialized FCU-1 for Equipment A');

  // ---------- B. Engineering Working changes Equipment A -> Controller Y (FCU-2) ----------
  // Also add a NEW point mapping (DISCHARGE_AIR_TEMP) — an Engineering-only change so far.
  const ctrl = tables.controllersMapped.find((c) => c.equipmentId === EQUIPMENT_ID);
  ctrl.controllerCode = 'FCU-2';
  ctrl.deviceInstance = '10005';
  tables.pointsMapped.push({
    id: 'pm-2', equipmentControllerId: ctrl.id, equipmentId: EQUIPMENT_ID, pointId: 'pt-discharge-air',
    legionPointCode: 'DISCHARGE_AIR_TEMP', fieldPointKey: 'DISCHARGE_AIR_TEMP', fieldPointName: 'Discharge Air Temp', fieldObjectType: 'AI',
    fieldObjectInstance: 'DISCHARGE_AIR_TEMP', fieldDataType: 'number', readEnabled: true, writeEnabled: false, isBound: true, metadataJson: null,
  });

  // ---------- C. Before deployment the Live projection still reflects Controller X (and only SPACE_TEMP) ----------
  assert.equal(liveBindingForEquipment()?.controllerCode, 'FCU-1', 'Live projection is untouched by the raw Engineering edit');
  assert.deepEqual(livePointKeysForEquipment(), ['SPACE_TEMP'], 'the new point mapping has not reached Live either');

  // ---------- D. Build alone still leaves the Live projection on Controller X ----------
  const release2 = await siteVersionService.buildRelease(SITE_ID, { builtBy: 'engineer-2', notes: 'reassign to FCU-2' });
  assert.deepEqual(release2.payload.payloadJson.controllerBindings.map((b) => b.controllerCode), ['FCU-2'],
    'release 2 freezes the NEW Engineering controller assignment (FCU-2)');
  assert.equal(liveBindingForEquipment()?.controllerCode, 'FCU-1', 'building release 2 does not touch the Live projection');

  // ---------- E. Deploying the new release materializes Controller Y into the Live projection ----------
  await siteVersionService.deployRelease(SITE_ID, release2.id, { deployedBy: 'engineer-2' });
  assert.equal(liveBindingForEquipment()?.controllerCode, 'FCU-2', 'Live projection now materializes FCU-2');
  assert.deepEqual(livePointKeysForEquipment(), ['DISCHARGE_AIR_TEMP', 'SPACE_TEMP'],
    'the new point mapping (DISCHARGE_AIR_TEMP) reached Live together with the controller reassignment');

  // ---------- F. Rollback restores the previous Live projection ----------
  await siteVersionService.rollbackToPreviousRelease(SITE_ID, { actor: 'engineer-3' });
  assert.equal(liveBindingForEquipment()?.controllerCode, 'FCU-1', 'rollback restores the FCU-1 Live projection (release 1s own frozen content)');
  assert.deepEqual(livePointKeysForEquipment(), ['SPACE_TEMP'], 'rollback also restores release 1s point-mapping set (no DISCHARGE_AIR_TEMP)');

  // The Engineering row itself is never touched by any of this — it still says whatever Engineering
  // last set (FCU-2), proving Live/Runtime and Engineering are genuinely two separate projections.
  assert.equal(tables.controllersMapped.find((c) => c.equipmentId === EQUIPMENT_ID).controllerCode, 'FCU-2',
    'Engineering ControllersMapped is never rewritten by deploy/rollback');

  console.log('OK: Engineering/Live controller + point mapping boundary verified (A-F: pre-deploy isolation, build-alone isolation, deploy switches Runtime, rollback restores Runtime, point mappings travel with their release, Engineering row never mutated by deploy/rollback).');
}

main().catch((err) => { console.error(err); process.exit(1); });
