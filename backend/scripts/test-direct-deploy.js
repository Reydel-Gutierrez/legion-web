'use strict';

// Phase 4 focused regression check: direct deploy (Engineering -> LS-100 over HTTP) must reuse the
// exact same staging pipeline as offline import (DEP-004) — proven here by routing the stubbed
// `fetch` call into the real `deployment.service.stagePackage()` function (the identical function
// the offline-import controller calls), not a parallel/duplicated implementation.
const assert = require('assert').strict;
const path = require('path');

function stub(relative, exports) {
  const filename = require.resolve(path.join(__dirname, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

// ---- "Server" (LS-100) side: minimal real prisma stub for deployment.service.stagePackage ----
const serverTables = { deploymentPackageRecords: [], deploymentAuditEntries: [] };
// Real Prisma throws "Argument <field> must not be null. Please use undefined instead." for a
// literal `null` on a nullable Json column — a live bug this exact check caught (see
// test-deployment-pipeline.js's genericModel doc comment) — so this stub enforces it too.
function genericModel(table, jsonNullableFields = []) {
  function assertNoLiteralJsonNull(data) {
    for (const field of jsonNullableFields) {
      if (data[field] === null) throw new Error(`Argument ${field} must not be null. Please use undefined instead.`);
    }
  }
  return {
    create: async ({ data }) => { assertNoLiteralJsonNull(data); const row = { id: `id-${table.length}`, receivedAt: new Date(), ...data }; table.push(row); return { ...row }; },
    update: async ({ where, data }) => { assertNoLiteralJsonNull(data); const row = table.find((r) => r.id === where.id); Object.assign(row, data); return { ...row }; },
    findUnique: async ({ where }) => table.find((r) => r.id === where.id) || null,
  };
}
const serverPrisma = {
  deploymentPackageRecord: genericModel(serverTables.deploymentPackageRecords, ['changePreviewJson', 'validationErrorsJson']),
  deploymentAuditEntry: genericModel(serverTables.deploymentAuditEntries, ['detailsJson']),
};
stub('../src/lib/prisma', serverPrisma);
stub('../src/lib/lspkg/storage', {
  writeStagedPackage: (id, buf) => `/tmp/${id}.lspkg`,
  readStagedPackage: () => { throw new Error('not needed for this test'); },
  deleteStagedPackage: () => {},
  stagingDir: () => '/tmp',
});

const deploymentService = require('../src/modules/deployment/deployment.service');

// ---- "Client" (Engineering) side: stub the package-build step so this test isolates transfer/
// pipeline-reuse behavior, which is what Phase 4 actually adds (building is covered exhaustively
// by test-lspkg-foundation.js and test-deployment-pipeline.js). ----
const { buildZip } = require('../src/lib/lspkg/zip');
const fakeManifest = { packageSchemaVersion: 1, packageId: 'p1', siteId: 'site-x', siteName: 'Site X', projectVersion: 'v1', createdAt: new Date().toISOString(), minLs100Version: '1.0.0', deploymentScope: 'full-site', files: [], checksums: {}, signature: { signed: false } };
const fakeBuffer = buildZip([{ name: 'manifest.json', data: Buffer.from(JSON.stringify(fakeManifest)) }]);

stub('../src/modules/siteVersions/sitePackage.service', {
  buildProjectPackage: async () => ({ record: { id: 'local-pkg-1', siteId: 'site-x' }, fileName: 'Site_X_v1.lspkg', validation: { ok: true, errors: [], warnings: [] } }),
  getBuiltPackageBuffer: async () => ({ buffer: fakeBuffer, record: { id: 'local-pkg-1' } }),
});
const { deployDirect } = require('../src/modules/deployment/directDeploy.service');

async function main() {
  // ---------- Success path: fetch is routed into the real stagePackage() ----------
  let capturedRequest = null;
  global.fetch = async (url, init) => {
    capturedRequest = { url, init };
    try {
      const record = await deploymentService.stagePackage(Buffer.from(init.body), { source: 'DIRECT', actor: 'direct-deploy' });
      return { ok: true, status: 201, text: async () => JSON.stringify(record), json: async () => record };
    } catch (e) {
      const status = e.statusCode || 500;
      return { ok: false, status, text: async () => JSON.stringify({ error: e.message }), json: async () => ({ error: e.message }) };
    }
  };

  const result = await deployDirect('site-x', { targetUrl: 'http://ls100-sim.local:4100', deployToken: 'shared-secret' });
  assert.equal(result.transferred, true);
  assert.equal(capturedRequest.url, 'http://ls100-sim.local:4100/api/deployment/import?source=DIRECT');
  assert.equal(capturedRequest.init.headers.Authorization, 'Bearer shared-secret');
  assert.equal(capturedRequest.init.headers['Content-Type'], 'application/octet-stream');
  assert(Buffer.from(capturedRequest.init.body).equals(fakeBuffer), 'the exact built package bytes are transferred, not a re-encoded copy');

  assert.equal(result.remoteRecord.status, 'STAGED');
  assert.equal(result.remoteRecord.source, 'DIRECT', 'the remote record is tagged DIRECT, but was created by the identical stagePackage() offline-import also calls');
  assert.equal(serverTables.deploymentPackageRecords.length, 1);
  assert.equal(serverTables.deploymentPackageRecords[0].manifestJson.packageId, 'p1');

  // Prove pipeline identity: an OFFLINE_IMPORT of the same bytes produces the same shape of record
  // (differing only in `source` and `id`) — both paths are the same function, not two formats.
  const offlineEquivalent = await deploymentService.stagePackage(fakeBuffer, { source: 'OFFLINE_IMPORT' });
  assert.equal(offlineEquivalent.checksumSha256, result.remoteRecord.checksumSha256, 'identical bytes produce identical checksums regardless of entry path');
  assert.equal(offlineEquivalent.manifest.packageId, result.remoteRecord.manifest.packageId);

  // ---------- Failure path: a validation rejection on the LS-100 side surfaces as an HttpError ----------
  global.fetch = async () => ({ ok: false, status: 422, text: async () => JSON.stringify({ error: 'Package rejected: manifest.siteId must be a non-empty string' }), json: async () => ({ error: 'Package rejected: manifest.siteId must be a non-empty string' }) });
  await assert.rejects(
    deployDirect('site-x', { targetUrl: 'http://ls100-sim.local:4100' }),
    /LS-100 rejected the package.*manifest\.siteId/,
  );

  // ---------- targetUrl validation ----------
  await assert.rejects(deployDirect('site-x', { targetUrl: '' }), /targetUrl is required/);
  await assert.rejects(deployDirect('site-x', { targetUrl: 'not a url' }), /not a valid URL/);
  await assert.rejects(deployDirect('site-x', { targetUrl: 'ftp://host' }), /must be http or https/);

  // ---------- Network failure surfaces as a clear 502, not a raw exception ----------
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(deployDirect('site-x', { targetUrl: 'http://unreachable.local' }), /Could not reach LS-100/);

  console.log('OK: direct deploy verified (reuses the identical stagePackage() pipeline as offline import, byte-identical transfer, auth header, failure propagation, URL validation, network-error handling).');
}

main().catch((err) => { console.error(err); process.exit(1); });
