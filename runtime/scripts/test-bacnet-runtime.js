'use strict';

// LC-ARCH-004 Phase 2 (BACnet completion): proves the standalone Runtime is the authoritative owner
// of continuous BACnet/IP field polling, reached only through the BacnetDriver boundary (never
// `node-bacnet` directly from `runtimeCore.js`, never from the backend Express process). Deterministic;
// no real network/hardware — `bacnetDriver.js` itself is stubbed (its job, calling `node-bacnet`, is
// already exercised for real by the Engineering commissioning tools; this test is about Runtime's
// OWNERSHIP and lifecycle around that driver, not BACnet wire behavior).
const assert = require('assert').strict;
const path = require('path');
const backendSrc = path.join(__dirname, '..', '..', 'backend', 'src');

const SITE_ID = 'site-bacnet';
const BAC_EQUIPMENT_ID = 'eq-bac-1';
const SIM_EQUIPMENT_ID = 'eq-sim-1';

const equipment = [
  { id: BAC_EQUIPMENT_ID, siteId: SITE_ID, code: 'AHU-1', name: 'AHU-1' },
  { id: SIM_EQUIPMENT_ID, siteId: SITE_ID, code: 'FCU-1', name: 'FCU-1' },
];
const points = [
  { id: 'pt-bac-zn-t', equipmentId: BAC_EQUIPMENT_ID, pointCode: 'ZN-T', presentValue: null, commState: 'UNKNOWN', lastSeenAt: null },
  { id: 'pt-sim-space-temp', equipmentId: SIM_EQUIPMENT_ID, pointCode: 'SPACE_TEMP', presentValue: '72', commState: 'UNKNOWN', lastSeenAt: null },
];
const liveControllerBindings = [
  {
    id: 'lcb-bac-1', siteId: SITE_ID, equipmentId: BAC_EQUIPMENT_ID, controllerCode: 'AHU-1', protocol: 'BACNET_IP',
    ipAddress: '10.0.0.5', deviceInstance: '1001', networkAddress: null, pollRateMs: 5000, isEnabled: true, status: null, lastSeenAt: null,
  },
  {
    id: 'lcb-sim-1', siteId: SITE_ID, equipmentId: SIM_EQUIPMENT_ID, controllerCode: 'FCU-1', protocol: 'SIM',
    ipAddress: null, deviceInstance: '10004', networkAddress: null, pollRateMs: 20000, isEnabled: true, status: null, lastSeenAt: null,
  },
];
const livePointBindings = [
  {
    id: 'lpb-bac-1', liveControllerBindingId: 'lcb-bac-1', equipmentId: BAC_EQUIPMENT_ID, pointId: 'pt-bac-zn-t',
    fieldPointKey: 'ZN-T', fieldObjectType: 'AI', fieldObjectInstance: '1', isBound: true, readEnabled: true, writeEnabled: true,
  },
  {
    id: 'lpb-sim-1', liveControllerBindingId: 'lcb-sim-1', equipmentId: SIM_EQUIPMENT_ID, pointId: 'pt-sim-space-temp',
    fieldPointKey: 'SPACE_TEMP', fieldObjectType: null, fieldObjectInstance: null, isBound: true, readEnabled: true, writeEnabled: false,
  },
];
const pointRuntimeStates = [];
const controllerRuntimeStates = [];

function matches(row, where = {}) {
  return Object.entries(where).every(([key, val]) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('equals' in val) {
        const a = String(row[key] ?? '');
        const b = String(val.equals ?? '');
        return val.mode === 'insensitive' ? a.toLowerCase() === b.toLowerCase() : a === b;
      }
      if ('in' in val) return val.in.includes(row[key]);
      if ('not' in val) return row[key] !== val.not;
      return false;
    }
    return row[key] === val;
  });
}
function model(rows) {
  return {
    findMany: async ({ where } = {}) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }) => rows.find((r) => matches(r, where)) || null,
    findFirst: async ({ where } = {}) => rows.find((r) => matches(r, where)) || null,
    update: async ({ where, data }) => {
      const row = rows.find((r) => matches(r, where));
      assert(row, `update: no row matches ${JSON.stringify(where)}`);
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }) => {
      const row = { id: `row-${rows.length}`, ...data };
      rows.push(row);
      return row;
    },
    upsert: async ({ where, create, update }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) {
        const created = { id: `row-${rows.length}`, ...create };
        rows.push(created);
        return created;
      }
      for (const [key, val] of Object.entries(update)) {
        row[key] = val && typeof val === 'object' && 'increment' in val ? (row[key] || 0) + val.increment : val;
      }
      return row;
    },
  };
}

const prisma = {
  equipment: model(equipment),
  point: model(points),
  liveControllerBinding: model(liveControllerBindings),
  livePointBinding: model(livePointBindings),
  pointRuntimeState: model(pointRuntimeStates),
  controllerRuntimeState: model(controllerRuntimeStates),
};
prisma.$transaction = async (operations) => Promise.all(operations);
prisma.$queryRaw = async () => [{ ok: 1 }];
prisma.$disconnect = async () => {};

function stubAbsolute(absPath, exports) {
  const filename = require.resolve(absPath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stubAbsolute(path.join(backendSrc, 'lib', 'prisma'), prisma);
stubAbsolute(path.join(backendSrc, 'modules', 'alarms', 'alarm.service'), { evaluateForPointIds: async () => {} });

// ---- Mock BacnetDriver: no real node-bacnet/network involved. Controllable success/failure and a
// call log so the test can assert Runtime actually goes THROUGH this boundary. ----
let bacnetShouldFail = false;
let bacnetReadValue = '68.5';
const bacnetReadCalls = [];
const bacnetWriteCalls = [];
stubAbsolute(path.join(__dirname, '..', 'src', 'protocols', 'bacnetDriver.js'), {
  initialize: async () => {},
  shutdown: async () => {},
  readPoints: async (target) => {
    bacnetReadCalls.push(target);
    if (bacnetShouldFail) throw new Error('simulated BACnet timeout');
    return { ok: true, presentValue: bacnetReadValue, raw: bacnetReadValue };
  },
  writePoint: async (target, value) => {
    bacnetWriteCalls.push({ target, value });
    if (bacnetShouldFail) throw new Error('simulated BACnet write timeout');
    return { ok: true, writtenAt: new Date().toISOString() };
  },
  getHealth: () => ({ protocol: 'BACNET_IP', driverLoaded: true }),
});

const runtime = require('../src/core/runtimeCore');

function liveBac() {
  return liveControllerBindings.find((r) => r.id === 'lcb-bac-1');
}
function prsForBac() {
  return pointRuntimeStates.find((r) => r.pointId === 'pt-bac-zn-t');
}
function crsForBac() {
  return controllerRuntimeStates.find((r) => r.liveControllerBindingId === 'lcb-bac-1');
}

async function main() {
  await runtime.reload();

  // ---------- A. Live BACnet controller is loaded by standalone Runtime ----------
  const controllers = runtime.listControllers();
  const bac = controllers.find((c) => c.mappedEquipmentId === BAC_EQUIPMENT_ID);
  assert(bac, 'the deployed BACnet/IP LiveControllerBinding was loaded into the Runtime store');
  assert.equal(bac.protocol, 'BACNET_IP');

  // ---------- B. Runtime invokes BacnetDriver for configured BACnet points ----------
  const callsBefore = bacnetReadCalls.length;
  await runtime.pollNow(BAC_EQUIPMENT_ID);
  assert(bacnetReadCalls.length > callsBefore, 'polling the BACnet controller called BacnetDriver.readPoints');
  assert.equal(bacnetReadCalls[bacnetReadCalls.length - 1].objectType, 'AI');
  assert.equal(bacnetReadCalls[bacnetReadCalls.length - 1].address, '10.0.0.5');

  // ---------- C. successful BACnet read updates PointRuntimeState ----------
  const prs1 = prsForBac();
  assert(prs1, 'a PointRuntimeState row exists after a successful BACnet poll');
  assert.equal(prs1.presentValue, bacnetReadValue);
  assert.equal(prs1.quality, 'GOOD');
  assert.equal(prs1.source, 'BACNET_IP', 'runtime-state records BACNET_IP as the source, distinct from SIM');
  const pointRow = points.find((p) => p.id === 'pt-bac-zn-t');
  assert.equal(pointRow.presentValue, bacnetReadValue, 'legacy Point mirror also updated (Phase 2 compatibility)');
  assert.equal(pointRow.commState, 'ONLINE');

  // ---------- D. successful BACnet read updates ControllerRuntimeState healthy state ----------
  const crs1 = crsForBac();
  assert(crs1, 'a ControllerRuntimeState row exists after a successful poll');
  assert.equal(crs1.status, 'ONLINE');
  assert.equal(crs1.quality, 'GOOD');
  assert.equal(crs1.failureCount, 0);
  assert.equal(liveBac().status, 'ONLINE', 'legacy LiveControllerBinding.status mirror also updated');

  // ---------- E. BACnet read failure preserves last known value and changes quality appropriately ----------
  bacnetShouldFail = true;
  await runtime.pollNow(BAC_EQUIPMENT_ID);
  assert.equal(pointRow.presentValue, bacnetReadValue, 'a failed read never overwrites the last known value');
  // Age the heartbeat past the STALE tier (earlyStaleThresholdMs) but not yet COMM_FAILURE, then reconcile.
  const staleAge = new Date(Date.now() - 40000); // pollRateMs=5000 -> staleThreshold=90000, earlyStale=30000
  pointRow.lastSeenAt = staleAge;
  const bacStoreCtrl = Object.values(require('../src/core/runtime.store').store.controllers).find((c) => c.mappedEquipmentId === BAC_EQUIPMENT_ID);
  bacStoreCtrl.lastSeenAt = staleAge.toISOString();
  await runtime.reconcileMappedStaleState();
  assert.equal(prsForBac().quality, 'STALE', 'a temporarily unreachable BACnet point degrades to STALE, not immediately COMM_FAILURE');
  assert.equal(pointRow.presentValue, bacnetReadValue, 'STALE still preserves the last known value');
  assert.equal(pointRow.commState, 'ONLINE', 'the binary legacy mirror only flips at the COMM_FAILURE tier');

  // ---------- F. repeated failure reaches communication-failure state ----------
  const failAge = new Date(Date.now() - 100000); // past staleThreshold (90000)
  pointRow.lastSeenAt = failAge;
  bacStoreCtrl.lastSeenAt = failAge.toISOString();
  await runtime.reconcileMappedStaleState();
  assert.equal(prsForBac().quality, 'COMM_FAILURE', 'sustained unreachability reaches COMM_FAILURE');
  assert.equal(pointRow.presentValue, bacnetReadValue, 'COMM_FAILURE still preserves the last known value — the point never disappears');
  assert.equal(pointRow.commState, 'OFFLINE');
  assert.equal(liveBac().status, 'OFFLINE');
  assert.equal(crsForBac().quality, 'COMM_FAILURE');

  // ---------- G. recovery returns quality/status to healthy ----------
  bacnetShouldFail = false;
  bacnetReadValue = '70.2';
  await runtime.pollNow(BAC_EQUIPMENT_ID);
  assert.equal(prsForBac().quality, 'GOOD', 'a successful poll after an outage immediately returns to GOOD');
  assert.equal(prsForBac().presentValue, '70.2');
  assert.equal(crsForBac().status, 'ONLINE');
  assert.equal(crsForBac().failureCount, 0, 'failureCount resets on the next successful poll');
  assert.equal(liveBac().status, 'ONLINE');

  // ---------- H. one failing BACnet controller does not stop another controller from polling ----------
  bacnetShouldFail = true;
  const simCtrl = runtime.listControllers().find((c) => c.mappedEquipmentId === SIM_EQUIPMENT_ID);
  assert(simCtrl, 'the SIM controller is also loaded');
  const simPointBefore = points.find((p) => p.id === 'pt-sim-space-temp').lastSeenAt;
  await Promise.all([
    runtime.pollController(bacStoreCtrl.runtimeId).catch(() => {}),
    runtime.pollController(simCtrl.runtimeRouteKey),
  ]);
  const simPointAfter = points.find((p) => p.id === 'pt-sim-space-temp').lastSeenAt;
  assert.notEqual(String(simPointAfter), String(simPointBefore), 'the SIM controller kept polling successfully while the BACnet controller was failing');
  bacnetShouldFail = false;

  // ---------- I. Runtime reload does not duplicate BACnet polling ----------
  const countBeforeReload = runtime.listControllers().filter((c) => c.protocol === 'BACNET_IP').length;
  await runtime.reload();
  await runtime.reload();
  const countAfterReload = runtime.listControllers().filter((c) => c.protocol === 'BACNET_IP').length;
  assert.equal(countAfterReload, countBeforeReload, 'repeated reload never duplicates a BACnet controller entry');
  assert.equal(countAfterReload, 1);

  // ---------- J. deploy changing a BACnet mapping causes Runtime to use the new mapping ----------
  liveBac().ipAddress = '10.0.0.9';
  liveBac().deviceInstance = '2002';
  livePointBindings.find((m) => m.id === 'lpb-bac-1').fieldObjectInstance = '7';
  await runtime.reload();
  bacnetReadValue = '71.0';
  await runtime.pollNow(BAC_EQUIPMENT_ID);
  const lastCall = bacnetReadCalls[bacnetReadCalls.length - 1];
  assert.equal(lastCall.address, '10.0.0.9', 'Runtime polls the NEW address after a redeploy changes the mapping');
  assert.equal(lastCall.objectInstance, '7', 'Runtime uses the NEW object instance after reload');

  // ---------- K. BACnet write path goes through Runtime/BacnetDriver ----------
  const writeCallsBefore = bacnetWriteCalls.length;
  const writeResult = await runtime.writePoint(BAC_EQUIPMENT_ID, 'ZN-T', 72, { priority: 8 });
  assert.equal(writeResult.ok, true, 'write succeeds through the driver boundary');
  assert.equal(bacnetWriteCalls.length, writeCallsBefore + 1, 'the write was dispatched through BacnetDriver.writePoint — never a direct backend/node-bacnet call');
  assert.equal(bacnetWriteCalls[bacnetWriteCalls.length - 1].value, 72);

  // A write to a non-write-enabled or unknown mapping is refused, never silently "succeeds".
  const badWrite = await runtime.writePoint(BAC_EQUIPMENT_ID, 'DOES-NOT-EXIST', 1);
  assert.equal(badWrite.ok, false);
  assert.equal(badWrite.status, 404);

  console.log('OK: BACnet/IP runtime polling verified (A-K: loaded from Live config, driver boundary invoked, PointRuntimeState/ControllerRuntimeState updated on success, quality preserves last value through STALE/COMM_FAILURE, automatic recovery, isolation from a concurrently-failing SIM/BACnet controller, reload without duplication, redeploy picks up new mapping, write path through BacnetDriver only).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
