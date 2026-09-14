'use strict';

// Deterministic regression checks; no database, seed, or BACnet network access.
const assert = require('assert').strict;
const path = require('path');
const equipment = ['site-a', 'site-b'].map((siteId, i) => ({ id: `eq-${i}`, siteId, code: 'FCU-1', name: 'FCU-1' }));
const controllers = equipment.map((e, i) => ({ id: `ctrl-${i}`, equipmentId: e.id, siteId: e.siteId,
  controllerCode: 'FCU-1', protocol: 'SIM', isEnabled: true, pollRateMs: 20000, status: 'ASSIGNED' }));
const points = [];
const mappings = [];
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
const prisma = { equipment: model(equipment), controllersMapped: model(controllers), point: model(points), pointsMapped: model(mappings) };
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

async function main() {
  for (const e of equipment) await syncSimCatalogBindingsForEquipmentId(e.id);
  await runtime.refreshInMemoryBindingForEquipmentId(equipment[0].id);
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
  assert.equal(controllers[0].status, 'OFFLINE');
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
  controllers[0].isEnabled = false;
  const lastSeen = ctrl.lastSeenAt;
  await runtime.pollNow(ctrl.runtimeId);
  assert.equal(ctrl.lastSeenAt, lastSeen, 'disabled assignment stops writes');
  console.log('PASS: SIM assignment isolation, changing values, alarm evaluation, binding preservation, freshness, stop/restart, write failure, and overlapping polls');
}
// Discovery counts use the same relational point collection.
prisma.point.count = async ({ where }) => points.filter((p) => matches(p, where)).length;
main().catch((err) => { console.error(err); process.exitCode = 1; });
