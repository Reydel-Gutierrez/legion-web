'use strict';

// Focused regression checks: a covered trend with a missing, invalid, zero, negative, or malformed
// sampleInterval must never drive per-poll historian writes, and the operator API must reject such
// values going forward. Deterministic; no database, seed, or network access.
const assert = require('assert').strict;
const path = require('path');

function stub(relative, exports) {
  const filename = require.resolve(path.join(__dirname, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let definitions = [];
let assignments = [];
const sites = [{ id: 'site-1' }];

function nextId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}`; }

const prisma = {
  site: { findUnique: async ({ where }) => sites.find((s) => s.id === where.id) || null },
  trendDefinition: {
    create: async ({ data }) => {
      const row = { id: nextId('def'), version: 1, createdAt: new Date(), updatedAt: new Date(), ...data };
      definitions.push(row);
      return { ...row, assignments: [] };
    },
    update: async ({ where, data }) => {
      const row = definitions.find((d) => d.id === where.id);
      assert(row, `definition ${where.id} exists`);
      Object.assign(row, data);
      return { ...row, assignments: assignments.filter((a) => a.definitionId === row.id) };
    },
    findFirst: async ({ where }) => definitions.find((d) => d.id === where.id && d.siteId === where.siteId) || null,
    delete: async ({ where }) => { definitions = definitions.filter((d) => d.id !== where.id); return {}; },
  },
  trendAssignment: {
    // Mirrors the exact query shape historian.js issues: { enabled: true, definition: { enabled: true } }.
    findMany: async ({ where }) => assignments
      .filter((a) => a.enabled === where.enabled)
      .map((a) => ({ ...a, definition: definitions.find((d) => d.id === a.definitionId) }))
      .filter((a) => a.definition && a.definition.enabled === where.definition.enabled),
  },
};
prisma.$transaction = async (ops) => Promise.all(ops);

stub('../src/lib/prisma', prisma);

const historian = require('../src/lib/historian');
const operatorDefinitions = require('../src/modules/operatorDefinitions/operatorDefinitions.service');

function addCoveredPoint(pointId, sampleInterval, { enabled = true, definitionEnabled = true } = {}) {
  const definitionId = nextId('def');
  definitions.push({ id: definitionId, siteId: 'site-1', enabled: definitionEnabled, sampleInterval, retentionDays: null });
  assignments.push({ id: nextId('asn'), definitionId, siteId: 'site-1', equipmentId: 'eq-1', enabled, resolvedMappings: { [pointId]: pointId } });
}

async function main() {
  // --- normalizeSampleIntervalSeconds: pure-function boundary cases ---
  assert.equal(historian.normalizeSampleIntervalSeconds(null), 60, 'missing -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds(undefined), 60, 'undefined -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds(0), 60, 'zero -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds(-5), 60, 'negative -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds('abc'), 60, 'non-numeric string -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds(NaN), 60, 'NaN -> 60s default');
  assert.equal(historian.normalizeSampleIntervalSeconds(5), 10, 'below floor -> floored to 10s');
  assert.equal(historian.normalizeSampleIntervalSeconds(10), 10, 'at floor -> unchanged');
  assert.equal(historian.normalizeSampleIntervalSeconds(45), 45, 'valid value -> unchanged');

  // --- A covered point with a missing/zero/negative/malformed interval must throttle at the
  // 60s default, not record on every poll. ---
  addCoveredPoint('pt-missing', null);
  addCoveredPoint('pt-zero', 0);
  addCoveredPoint('pt-negative', -30);
  addCoveredPoint('pt-malformed', 'not-a-number');
  await historian.refreshHistorianConfig();

  for (const pointId of ['pt-missing', 'pt-zero', 'pt-negative', 'pt-malformed']) {
    assert(historian.isPointCovered(pointId), `${pointId} should be covered`);
    let t = 0;
    assert.equal(historian.shouldRecordSample(pointId, t), true, `${pointId} first sample always records`);
    // Simulate a fast poll loop (every 1s) for 59 more seconds: none of these may record, because a
    // missing/invalid interval must default to 60s, never "record every write".
    let recorded = 0;
    for (let i = 1; i <= 59; i += 1) {
      t += 1000;
      if (historian.shouldRecordSample(pointId, t)) recorded += 1;
    }
    assert.equal(recorded, 0, `${pointId} must not record again before the 60s default elapses`);
    t += 1000; // t = 60000ms
    assert.equal(historian.shouldRecordSample(pointId, t), true, `${pointId} records again once the 60s default elapses`);
  }

  // --- Multiple trends on the same point: the shortest VALID (normalized/floored) interval wins ---
  definitions = []; assignments = [];
  addCoveredPoint('pt-multi', 5); // below the 10s floor -> normalized to 10s
  addCoveredPoint('pt-multi', null); // missing -> normalized to 60s
  await historian.refreshHistorianConfig();
  let t = 0;
  assert.equal(historian.shouldRecordSample('pt-multi', t), true);
  t += 9000;
  assert.equal(historian.shouldRecordSample('pt-multi', t), false, 'still inside the 10s floor');
  t += 1000; // t = 10000ms
  assert.equal(historian.shouldRecordSample('pt-multi', t), true, 'records once the shortest valid interval elapses');

  // --- Disabled definition/assignment grant no coverage regardless of interval ---
  definitions = []; assignments = [];
  addCoveredPoint('pt-disabled-def', 0, { definitionEnabled: false });
  addCoveredPoint('pt-disabled-asn', 0, { enabled: false });
  await historian.refreshHistorianConfig();
  assert.equal(historian.isPointCovered('pt-disabled-def'), false);
  assert.equal(historian.isPointCovered('pt-disabled-asn'), false);

  // --- operatorDefinitions API: create/update must reject zero, negative, malformed, and
  // below-minimum sampleInterval values ---
  const bad = [0, -1, -100, 5, 9, NaN, 'abc', 1.5, true, {}];
  for (const sampleInterval of bad) {
    await assert.rejects(
      operatorDefinitions.create('site-1', 'trend', { name: 'Bad trend', sampleInterval, pointRequirements: [] }),
      /sampleInterval/,
      `create must reject sampleInterval=${JSON.stringify(sampleInterval)}`,
    );
  }

  const good = await operatorDefinitions.create('site-1', 'trend', { name: 'Good trend', sampleInterval: historian.MIN_SAMPLE_INTERVAL_SECONDS, pointRequirements: [] });
  assert.equal(good.sampleInterval, historian.MIN_SAMPLE_INTERVAL_SECONDS, 'exactly-the-minimum interval is accepted');

  for (const sampleInterval of bad) {
    await assert.rejects(
      operatorDefinitions.update('site-1', 'trend', good.id, { sampleInterval }),
      /sampleInterval/,
      `update must reject sampleInterval=${JSON.stringify(sampleInterval)}`,
    );
  }

  // --- A legacy definition already persisted with an invalid interval (written before this
  // validation existed, or edited directly in the DB) must keep working via the 60s default. ---
  definitions.push({ id: 'legacy-def', siteId: 'site-1', enabled: true, sampleInterval: -1, retentionDays: null });
  assignments.push({ id: 'legacy-asn', definitionId: 'legacy-def', siteId: 'site-1', equipmentId: 'eq-1', enabled: true, resolvedMappings: { 'pt-legacy': 'pt-legacy' } });
  await historian.refreshHistorianConfig();
  assert(historian.isPointCovered('pt-legacy'), 'legacy definition with a negative interval still grants coverage');
  const lt = 0;
  assert.equal(historian.shouldRecordSample('pt-legacy', lt), true);
  assert.equal(historian.shouldRecordSample('pt-legacy', lt + 30000), false, 'legacy negative interval throttles at the 60s default, not every poll');
  assert.equal(historian.shouldRecordSample('pt-legacy', lt + 60000), true);

  console.log('OK: historian interval safety verified (normalize boundaries, missing/zero/negative/malformed throttling, multi-trend shortest-valid-interval, disabled coverage, create/update validation, legacy fallback).');
}

main().catch((err) => { console.error(err); process.exit(1); });
