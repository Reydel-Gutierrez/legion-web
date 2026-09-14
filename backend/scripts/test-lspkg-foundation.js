'use strict';

// Phase 2 focused regression checks for the .lspkg package foundation: deterministic build,
// manifest/schema validation, checksum verification, ZIP path-traversal rejection, package
// limits, and exclusion of live/runtime/SIM/secret data. Deterministic; no real database.
const assert = require('assert').strict;
const path = require('path');

function stub(relative, exports) {
  const filename = require.resolve(path.join(__dirname, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

// ---- Minimal in-memory Prisma-like stub, generic enough for builder.js's query shapes ----
function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('in' in cond) return cond.in.includes(row[key]);
      return false;
    }
    return row[key] === cond;
  });
}

const db = {
  sites: [],
  buildings: [],
  floors: [],
  equipment: [],
  controllersMapped: [],
  points: [],
  pointsMapped: [],
  alarmDefinitions: [],
  trendDefinitions: [],
  scheduleDefinitions: [],
};

const prisma = {
  site: {
    findUnique: async ({ where, include }) => {
      const row = db.sites.find((s) => s.id === where.id);
      if (!row) return null;
      if (include?.activeReleaseVersion) return { ...row, activeReleaseVersion: row.activeReleaseVersion || null };
      return row;
    },
  },
  building: { findMany: async ({ where }) => db.buildings.filter((b) => matchesWhere(b, where)) },
  floor: { findMany: async ({ where }) => db.floors.filter((f) => matchesWhere(f, where)) },
  equipment: {
    findMany: async ({ where, include }) =>
      db.equipment
        .filter((e) => matchesWhere(e, where))
        .map((e) => (include?.controllersMapped ? { ...e, controllersMapped: db.controllersMapped.find((c) => c.equipmentId === e.id) || null } : e)),
  },
  point: { findMany: async ({ where }) => db.points.filter((p) => matchesWhere(p, where)) },
  pointsMapped: { findMany: async ({ where }) => db.pointsMapped.filter((m) => matchesWhere(m, where)) },
  alarmDefinition: { findMany: async ({ where }) => db.alarmDefinitions.filter((a) => matchesWhere(a, where)) },
  trendDefinition: {
    findMany: async ({ where, include }) =>
      db.trendDefinitions
        .filter((t) => matchesWhere(t, where))
        .map((t) => ({ ...t, assignments: t.assignments.filter((a) => matchesWhere(a, include?.assignments?.where)) })),
  },
  scheduleDefinition: {
    findMany: async ({ where, include }) =>
      db.scheduleDefinitions
        .filter((s) => matchesWhere(s, where))
        .map((s) => ({ ...s, assignments: s.assignments.filter((a) => matchesWhere(a, include?.assignments?.where)) })),
  },
};

stub('../src/lib/prisma', prisma);

const { buildZip, readZip, ZipError } = require('../src/lib/lspkg/zip');
const { canonicalStringify, sha256Hex } = require('../src/lib/lspkg/checksum');
const { validateManifest, assertNoForbiddenKeys, PACKAGE_SCHEMA_VERSION } = require('../src/lib/lspkg/manifest');
const { buildSitePackage } = require('../src/lib/lspkg/builder');
const { parseSitePackage } = require('../src/lib/lspkg/parser');
const { computeChangePreview } = require('../src/lib/lspkg/diff');

function seedStripPlazaFixture() {
  db.sites.length = 0; db.buildings.length = 0; db.floors.length = 0; db.equipment.length = 0;
  db.controllersMapped.length = 0; db.points.length = 0; db.pointsMapped.length = 0;
  db.alarmDefinitions.length = 0; db.trendDefinitions.length = 0; db.scheduleDefinitions.length = 0;

  db.sites.push({ id: 'site-1', name: 'Strip Plaza', status: 'ACTIVE', timezone: 'America/New_York', siteType: 'Commercial', description: null, displayLabel: null, engineeringNotes: null, icon: null, activeReleaseVersion: null });
  db.buildings.push({ id: 'bld-1', siteId: 'site-1', name: 'Strip Plaza Building', addressLine1: '1 Main St', addressLine2: null, city: 'City', state: 'FL', postalCode: '00000', country: 'US', latitude: null, longitude: null, status: 'ACTIVE', buildingType: null, buildingCode: null, description: null, sortOrder: 0 });
  db.floors.push({ id: 'flr-1', buildingId: 'bld-1', name: 'Main Floor', status: 'ACTIVE', displayLabel: null, floorType: null, occupancyType: null, sortOrder: 0 });
  db.equipment.push(
    { id: 'eq-fcu1', siteId: 'site-1', buildingId: 'bld-1', floorId: 'flr-1', name: 'FCU-1', code: 'FCU-1', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' },
    { id: 'eq-fcu2', siteId: 'site-1', buildingId: 'bld-1', floorId: 'flr-1', name: 'FCU-2', code: 'FCU-2', equipmentType: 'FCU', templateName: null, address: null, instanceNumber: null, status: 'ACTIVE' },
  );
  db.controllersMapped.push(
    { id: 'ctrl-fcu1', equipmentId: 'eq-fcu1', controllerCode: 'FCU-1', displayName: 'LPC0810', protocol: 'SIM', deviceInstance: null, ipAddress: null, networkAddress: null, pollRateMs: 5000, isSimulated: true, isEnabled: true, status: 'ONLINE', lastSeenAt: new Date(), metadataJson: null },
  );
  db.points.push(
    { id: 'pt-1', equipmentId: 'eq-fcu1', pointCode: 'SPACE_TEMP', pointName: 'Space Temp', pointType: 'AI', unit: 'degF', writable: false, presentValue: '72.3', commState: 'ONLINE', lastSeenAt: new Date(), status: 'ACTIVE' },
    { id: 'pt-2', equipmentId: 'eq-fcu2', pointCode: 'SPACE_TEMP', pointName: 'Space Temp', pointType: 'AI', unit: 'degF', writable: false, presentValue: '70.1', commState: 'ONLINE', lastSeenAt: new Date(), status: 'ACTIVE' },
  );
  db.pointsMapped.push({ id: 'pm-1', equipmentControllerId: 'ctrl-fcu1', equipmentId: 'eq-fcu1', pointId: 'pt-1', legionPointCode: 'SPACE_TEMP', fieldPointKey: 'SPACE_TEMP', fieldPointName: 'Space Temp', fieldObjectType: 'AI', fieldObjectInstance: '1', fieldDataType: 'REAL', readEnabled: true, writeEnabled: false, isBound: true });
  db.alarmDefinitions.push({ id: 'alm-1', siteId: 'site-1', equipmentId: 'eq-fcu1', buildingId: null, floorId: null, pointKey: 'SPACE_TEMP', pointId: 'pt-1', name: 'High Temp', enabled: true, severity: 'WARNING', category: 'THRESHOLD', operator: 'GT', targetValue: 80, targetPointId: null, targetPointKey: null, deadband: 1, delaySeconds: 60, messageTemplate: null, autoAcknowledge: false, conditionTree: null });
  db.trendDefinitions.push({ id: 'trd-1', siteId: 'site-1', name: 'FCU Temp Trend', enabled: true, isTemplate: false, equipmentType: 'FCU', sampleInterval: 60, retentionDays: 30, pointRequirements: [{ pointKey: 'SPACE_TEMP' }], version: 1, assignments: [{ id: 'ta-1', equipmentId: 'eq-fcu1', enabled: true, resolvedMappings: { SPACE_TEMP: 'pt-1' } }] });
  db.scheduleDefinitions.push({ id: 'sch-1', siteId: 'site-1', name: 'Business Hours', enabled: true, isTemplate: false, weeklyWindows: [{ days: ['Mon'], startTime: '08:00', endTime: '18:00', action: 'Occupied' }], version: 1, assignments: [{ id: 'sa-1', equipmentId: 'eq-fcu1', enabled: true }] });
}

async function main() {
  // ---------- ZIP container: round-trip, determinism, path safety, limits, tamper detection ----------
  const entries = [
    { name: 'manifest.json', data: Buffer.from('{"a":1}') },
    { name: 'sub/dir/file.json', data: Buffer.from('{"b":2}') },
  ];
  const zip1 = buildZip(entries);
  const zip2 = buildZip(entries);
  assert(zip1.equals(zip2), 'buildZip is byte-deterministic for identical input');
  const read = readZip(zip1);
  assert.equal(read.length, 2);
  assert.equal(read[0].data.toString(), '{"a":1}');
  assert.equal(read[1].name, 'sub/dir/file.json');

  // Tamper detection: flip a byte inside the file data region and expect a CRC mismatch.
  const tampered = Buffer.from(zip1);
  const idx = tampered.indexOf(Buffer.from('{"a":1}'));
  tampered[idx + 2] = tampered[idx + 2] === 0x3a ? 0x3b : 0x3a; // mutate a byte inside the JSON text
  assert.throws(() => readZip(tampered), /CRC-32 mismatch/, 'tampered entry data is rejected via CRC-32');

  // Path traversal / zip-slip rejection.
  assert.throws(() => readZip(buildZip([{ name: '../../etc/passwd', data: Buffer.from('x') }])), /Unsafe or path-traversal/);
  assert.throws(() => readZip(buildZip([{ name: '/etc/passwd', data: Buffer.from('x') }])), /Unsafe or path-traversal/);
  assert.throws(() => readZip(buildZip([{ name: 'C:\\evil.txt', data: Buffer.from('x') }])), /Unsafe or path-traversal/);

  // File-count and size limits.
  const manyEntries = Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.json`, data: Buffer.from('{}') }));
  assert.throws(() => readZip(buildZip(manyEntries), { maxFiles: 5 }), /exceeding the limit/);
  const bigEntry = [{ name: 'big.json', data: Buffer.alloc(1000, 0x41) }];
  assert.throws(() => readZip(buildZip(bigEntry), { maxEntryBytes: 100 }), /exceeds the per-file limit/);
  assert.throws(() => readZip(buildZip(bigEntry), { maxTotalBytes: 100 }), /exceeds the total size limit/);

  // ---------- Manifest schema validation ----------
  assert.equal(validateManifest(null).ok, false);
  assert.equal(validateManifest({}).ok, false);
  const validManifestShape = { packageSchemaVersion: PACKAGE_SCHEMA_VERSION, packageId: 'p1', siteId: 's1', siteName: 'Site', projectVersion: 'v1', createdAt: new Date().toISOString(), minLs100Version: '1.0.0', deploymentScope: 'full-site', files: [], checksums: {}, signature: { signed: false } };
  assert.equal(validateManifest(validManifestShape).ok, true);
  assert.equal(validateManifest({ ...validManifestShape, packageSchemaVersion: 999 }).ok, false, 'unknown schema version is rejected');

  // Forbidden-key defense in depth.
  assert.throws(() => assertNoForbiddenKeys({ user: { password: 'x' } }), /Refusing to build package/);
  assert.throws(() => assertNoForbiddenKeys({ auth: { apiKey: 'x' } }), /forbidden key/);
  assertNoForbiddenKeys({ site: { name: 'ok' } }); // does not throw

  // ---------- Builder: deterministic content, SIM exclusion, live-data exclusion ----------
  seedStripPlazaFixture();

  const built1 = await buildSitePackage('site-1', { author: 'tester', projectVersion: 'v1', packageId: 'fixed-pkg-id', now: new Date('2026-01-01T00:00:00.000Z') });
  const built2 = await buildSitePackage('site-1', { author: 'tester', projectVersion: 'v1', packageId: 'fixed-pkg-id', now: new Date('2026-01-01T00:00:00.000Z') });
  assert.equal(canonicalStringify(built1.files), canonicalStringify(built2.files), 'identical DB input produces identical logical package content');
  assert.equal(canonicalStringify(built1.manifest.checksums), canonicalStringify(built2.manifest.checksums), 'checksums are stable across rebuilds of identical content');
  assert(built1.buffer.equals(built2.buffer), 'byte-identical .lspkg when packageId/projectVersion/createdAt are pinned identically');

  // SIM controller/points excluded by default (FCU-1's controller is protocol SIM).
  assert.equal(built1.files['mappings.json'].controllers.length, 0, 'SIM controller excluded from a non-simulation package');
  assert.equal(built1.files['mappings.json'].pointMappings.length, 0, 'SIM point mapping excluded from a non-simulation package');
  // Equipment/points/alarms/trends/schedules for that SIM-bound equipment are still real Legion
  // config and remain in the package — only the SIM controller identity/binding is excluded.
  assert.equal(built1.files['equipment.json'].equipment.length, 2, 'equipment definitions are not SIM-filtered');
  assert.equal(built1.files['alarms.json'].alarmDefinitions.length, 1);

  const simPkg = await buildSitePackage('site-1', { simulationPackage: true, packageId: 'fixed-pkg-id', now: new Date('2026-01-01T00:00:00.000Z') });
  assert.equal(simPkg.files['mappings.json'].controllers.length, 1, 'SIM controller included when simulationPackage=true');
  assert.equal(simPkg.manifest.simulationPackage, true);

  // Live/runtime/secret exclusion: presentValue/commState/lastSeenAt/status(controller) never appear.
  const packageText = canonicalStringify(built1.files);
  assert(!packageText.includes('72.3'), 'live presentValue must never appear in a package');
  assert(!packageText.includes('commState'), 'runtime commState key must never appear in a package');
  assert(!packageText.includes('password'), 'no credential-shaped content');
  assert.equal(built1.manifest.signature.signed, false, 'unsigned development packages are honestly labeled');

  // ---------- Parser: accepts a well-formed package, rejects a tampered one ----------
  const parsed = parseSitePackage(built1.buffer);
  assert.equal(parsed.ok, true, `parser accepts a well-formed package: ${JSON.stringify(parsed.errors)}`);
  assert.equal(parsed.manifest.siteId, 'site-1');
  assert.deepEqual(Object.keys(parsed.files).sort(), Object.keys(built1.files).sort());
  assert(parsed.warnings.some((w) => /unsigned/i.test(w)));

  const tamperedBuf = Buffer.from(built1.buffer);
  const marker = tamperedBuf.indexOf(Buffer.from('"FCU-1"'));
  assert(marker > -1, 'fixture marker present in built package for tamper test');
  tamperedBuf[marker + 2] = tamperedBuf[marker + 2] === 0x43 ? 0x44 : 0x43; // mutate a data byte
  const parsedTampered = parseSitePackage(tamperedBuf);
  assert.equal(parsedTampered.ok, false);
  assert(parsedTampered.errors.some((e) => /CRC-32 mismatch|Checksum mismatch/.test(e)), `expected a corruption error, got: ${JSON.stringify(parsedTampered.errors)}`);

  // Reject unknown/future schema versions outright.
  const futureManifest = { ...built1.manifest, packageSchemaVersion: 999 };
  const futureZip = buildZip([
    { name: 'manifest.json', data: Buffer.from(canonicalStringify(futureManifest)) },
    ...Object.entries(built1.files).map(([name, obj]) => ({ name, data: Buffer.from(canonicalStringify(obj)) })),
  ]);
  const parsedFuture = parseSitePackage(futureZip);
  assert.equal(parsedFuture.ok, false);
  assert(parsedFuture.errors.some((e) => /Unsupported package schema version/.test(e)));

  // ---------- Change preview ----------
  const previewFirstBuild = computeChangePreview(null, built1.files);
  assert.equal(previewFirstBuild.collections.equipment.added.length, 2, 'first-ever build: both equipment rows are additions');
  assert.deepEqual(previewFirstBuild.unresolved, [], 'a self-consistent fixture has no unresolved references');

  // Realistic unresolved case: an alarm authored against a logical pointKey that has no bound
  // Point yet (alarm.service's PENDING_BINDING state) — a dangling equipmentId FK cannot occur
  // from real relational data (Equipment has onDelete: Cascade), so this is the case that matters.
  db.alarmDefinitions.push({ id: 'alm-pending', siteId: 'site-1', equipmentId: 'eq-fcu2', buildingId: null, floorId: null, pointKey: 'FAN_STATUS', pointId: null, name: 'Fan Fault', enabled: true, severity: 'WARNING', category: 'BINARY', operator: 'IS_OFF', targetValue: null, targetPointId: null, targetPointKey: null, deadband: null, delaySeconds: null, messageTemplate: null, autoAcknowledge: false, conditionTree: null });
  const builtWithPending = await buildSitePackage('site-1', { packageId: 'p2' });
  const previewPending = computeChangePreview(built1.files, builtWithPending.files);
  assert(previewPending.unresolved.some((u) => u.id === 'alm-pending'), 'an alarm pending point binding is reported as unresolved');

  console.log('OK: lspkg foundation verified (deterministic ZIP, path-safety, limits, tamper/CRC detection, manifest validation, forbidden-key defense, deterministic builder, SIM/live-data exclusion, parser accept/reject, schema-version rejection, change preview + unresolved-reference detection).');
}

main().catch((err) => { console.error(err); process.exit(1); });
