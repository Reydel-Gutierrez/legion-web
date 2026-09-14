'use strict';

// Deterministic regression checks; no database, seed, or BACnet network access.
//
// LC-ARCH-003 Phase 1.1: Runtime resolves ONLY `liveControllerBinding`/`livePointBinding` (the
// deployed projection) — never `controllersMapped`/`pointsMapped` (Engineering's mutable working
// assignment) directly. This test's Engineering-side setup (`controllers`/`mappings`, populated via
// the real `syncSimCatalogBindingsForEquipmentId` helper) is deliberately kept separate from the
// Live tables Runtime actually reads; `materializeLive()` stands in for what
// `siteVersion.service.js`'s deploy transaction would do, without pulling in the whole SiteVersion
// machinery into a test that is really about poll-loop mechanics.
const assert = require('assert').strict;
const path = require('path');
const equipment = ['site-a', 'site-b'].map((siteId, i) => ({ id: `eq-${i}`, siteId, code: 'FCU-1', name: 'FCU-1' }));
const controllers = equipment.map((e, i) => ({ id: `ctrl-${i}`, equipmentId: e.id, siteId: e.siteId,
  controllerCode: 'FCU-1', protocol: 'SIM', isEnabled: true, pollRateMs: 20000, status: 'ASSIGNED' }));
const points = [];
const mappings = [];
const liveControllerBindings = [];
const livePointBindings = [];
let failWrites = false;
let alarmEvaluations = 0;

function matches(row, where = {}) {
  return Object.entries(where).every(([key, val]) => {
    if (val && typeof val === 'object') return String(row[key]).toLowerCase() === String(val.equals).toLowerCase();
    return row[key] === val;
  });
}
function model(rows) {
  return {
    findMany: async ({ where } = {}) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }) => rows.find((r) => matches(r, where)) || null,
    findFirst: async ({ where }) => rows.find((r) => matches(r, where)) || null,
    update: async ({ where, data }) => {
      if (rows === points && failWrites) throw new Error('test write failure');
      const row = rows.find((r) => matches(r, where));
      assert(row);
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }) => {
      const row = { id: `row-${rows.length}`, ...data };
      rows.push(row);
      return row;
    },
  };
}
const prisma = {
  equipment: model(equipment),
  controllersMapped: model(controllers),
  point: model(points),
  pointsMapped: model(mappings),
  liveControllerBinding: model(liveControllerBindings),
  livePointBinding: model(livePointBindings),
};
prisma.$transaction = async (operations) => Promise.all(operations);
prisma.point.upsert = async ({ where, update, create }) => {
  const row = points.find((p) => matches(p, where.equipmentId_pointCode));
  if (row) { Object.assign(row, update); return row; }
  return prisma.point.create({ data: create });
};
function stub(relative, exports) {
  const filename = require.resolve(path.join(__dirname, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('../src/lib/prisma', prisma);
stub('../src/modules/alarms/alarm.service', { evaluateForPointIds: async () => { alarmEvaluations += 1; } });
const runtime = require('../src/modules/runtime/runtime.service');
const { store } = require('../src/modules/runtime/runtime.store');
const { syncSimCatalogBindingsForEquipmentId } = require('../src/lib/simCatalogBindingSync');
const pointService = require('../src/modules/points/point.service');

/**
 * Stand-in for `siteVersion.service.js`'s deploy-time materialization: copies this equipment's
 * current Engineering ControllersMapped/PointsMapped rows into the Live projection Runtime reads.
 */
function materializeLive(equipmentId) {
  const oldLive = liveControllerBindings.find((r) => r.equipmentId === equipmentId);
  if (oldLive) {
    liveControllerBindings.splice(liveControllerBindings.indexOf(oldLive), 1);
    for (let i = livePointBindings.length - 1; i >= 0; i--) {
      if (livePointBindings[i].liveControllerBindingId === oldLive.id) livePointBindings.splice(i, 1);
    }
  }
  const ec = controllers.find((c) => c.equipmentId === equipmentId);
  if (!ec) return;
  const liveId = `live-${liveControllerBindings.length}`;
  liveControllerBindings.push({
    id: liveId, siteId: ec.siteId, equipmentId, controllerCode: ec.controllerCode, protocol: ec.protocol,
    isEnabled: ec.isEnabled, pollRateMs: ec.pollRateMs, status: null, lastSeenAt: null, releaseVersionId: 'test-release',
  });
  for (const m of mappings.filter((mp) => mp.equipmentId === equipmentId)) {
    livePointBindings.push({
      id: `lpb-${livePointBindings.length}`, liveControllerBindingId: liveId, equipmentId,
      pointId: m.pointId, fieldPointKey: m.fieldPointKey, isBound: m.isBound,
      readEnabled: m.readEnabled, writeEnabled: m.writeEnabled,
    });
  }
}

async function main() {
  for (const e of equipment) await syncSimCatalogBindingsForEquipmentId(e.id);
  // "Deploy": freeze the Engineering assignments above into the Live projection Runtime reads.
  for (const e of equipment) materializeLive(e.id);
  await runtime.resyncLiveSimBindings();
  const sims = runtime.listControllers().filter((c) => c.controllerCode === 'FCU-1' && c.equipmentId);
  assert.equal(sims.length, 2, 'both sites retain their SIM binding');
  assert(sims.every((c) => !c.online && !c.lastSeenAt), 'assignment alone is not Online');
  assert.equal(runtime.getController('FCU-1'), null, 'ambiguous controller code cannot control another site');
  for (const sim of sims) await runtime.pollNow(sim.runtimeRouteKey);
  const first = await pointService.listPointsByEquipment(equipment[0].id);
  const temp = first.find((p) => p.pointCode === 'SPACE_TEMP');
  const before = temp.presentValue;
  const seenBefore = new Date(temp.lastSeenAt).getTime();
  await syncSimCatalogBindingsForEquipmentId(equipment[0].id);
  assert.equal(temp.presentValue, before, 'binding sync preserves live values');
  await new Promise((resolve) => setTimeout(resolve, 5));
  await runtime.pollNow(equipment[0].id);
  assert.notEqual(temp.presentValue, before, 'temperature changes through normal point writes');
  assert(new Date(temp.lastSeenAt).getTime() > seenBefore);
  assert(alarmEvaluations > 0, 'normal point writes evaluate the existing alarm system');
  assert(sims.every((s) => runtime.getController(s.equipmentId).online));
  const discovered = await runtime.listDiscoveryDevices('site-a');
  assert(discovered.some((d) => d.equipmentId === 'eq-0'));
  assert(!discovered.some((d) => d.equipmentId === 'eq-1'), 'discovery does not leak another site binding');
  const newProjectDiscovery = await runtime.listDiscoveryDevices('new-site');
  assert(newProjectDiscovery.some((d) => d.controllerCode === 'FCU-1' && !d.equipmentId),
    'catalog remains discoverable from a project with no assignment');

  const ctrl = store.controllers[sims[0].runtimeRouteKey];
  runtime.setSimEnabled(ctrl.runtimeId, false);
  const stoppedAt = ctrl.lastSeenAt;
  await runtime.pollNow(ctrl.runtimeId);
  assert.equal(ctrl.lastSeenAt, stoppedAt);
  assert.equal(runtime.getController(ctrl.runtimeId).online, false);
  ctrl.lastSeenAt = new Date(Date.now() - 100000).toISOString();
  for (const p of first) p.lastSeenAt = new Date(Date.now() - 100000);
  await runtime.reconcileSimMappedStaleState();
  assert(first.every((p) => p.commState === 'OFFLINE'));
  assert.equal(liveControllerBindings.find((r) => r.equipmentId === 'eq-0').status, 'OFFLINE',
    'stale reconciliation marks the LIVE binding OFFLINE (never the Engineering ControllersMapped row)');
  assert.equal(controllers[0].status, 'ASSIGNED', 'Engineering ControllersMapped row is untouched by runtime reconciliation');
  assert.equal(runtime.getController('eq-1').online, true, 'stopping one site leaves the other running');

  runtime.setOnline(ctrl.runtimeId, true);
  runtime.setSimEnabled(ctrl.runtimeId, true);
  assert.equal(runtime.getController(ctrl.runtimeId).online, false, 'start/online cannot invent freshness');
  failWrites = true;
  const originalWarn = console.warn;
  console.warn = () => {};
  try { await runtime.pollNow(ctrl.runtimeId); } finally { console.warn = originalWarn; failWrites = false; }
  assert.equal(runtime.getController(ctrl.runtimeId).online, false, 'failed writes do not publish a heartbeat');
  await runtime.pollNow(ctrl.runtimeId);
  assert.equal(runtime.getController(ctrl.runtimeId).online, true);

  const lastCount = ctrl.stats.pollCount;
  await Promise.all([runtime.pollNow(ctrl.runtimeId), runtime.pollNow(ctrl.runtimeId)]);
  assert.equal(ctrl.stats.pollCount, lastCount + 1, 'overlapping polls coalesce');
  // Disabling only the Engineering row must NOT affect Runtime — it has to stay live until a
  // redeploy actually replaces the LIVE binding (this is the isolation boundary under test).
  controllers[0].isEnabled = false;
  const lastSeenWhileOnlyEngineeringDisabled = ctrl.lastSeenAt;
  await new Promise((resolve) => setTimeout(resolve, 5));
  await runtime.pollNow(ctrl.runtimeId);
  assert.notEqual(ctrl.lastSeenAt, lastSeenWhileOnlyEngineeringDisabled,
    'disabling the Engineering ControllersMapped row alone does not stop Runtime writes');
  // Simulate the redeploy that actually disables the LIVE binding.
  liveControllerBindings.find((r) => r.equipmentId === 'eq-0').isEnabled = false;
  const lastSeen = ctrl.lastSeenAt;
  await runtime.pollNow(ctrl.runtimeId);
  assert.equal(ctrl.lastSeenAt, lastSeen, 'a disabled LIVE binding (post-deploy) stops writes');
  console.log('PASS: SIM assignment isolation, Engineering/Live binding boundary, changing values, alarm evaluation, binding preservation, freshness, stop/restart, write failure, and overlapping polls');
}
// Discovery counts use the same relational point collection.
prisma.point.count = async ({ where }) => points.filter((p) => matches(p, where)).length;
main().catch((err) => { console.error(err); process.exitCode = 1; });
