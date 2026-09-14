'use strict';

// LC-ARCH-004 Phase 2 regression: Legion Server's HTTP client to the standalone Runtime process
// must never let a Runtime outage become an uncaught exception. Points LEGION_RUNTIME_URL at a
// closed local port (nothing listens there) to deterministically simulate "Runtime unavailable"
// without needing the real process running or not running — no real database, no real network.
process.env.LEGION_RUNTIME_URL = 'http://127.0.0.1:1'; // port 1 is never a valid user listener
process.env.RUNTIME_REQUEST_TIMEOUT_MS = '1000';

const assert = require('assert').strict;

const runtimeService = require('../src/modules/runtime/runtime.service');
const { HttpError } = require('../src/lib/httpError');

async function main() {
  // N. Runtime unavailable gives a controlled error, never an uncaught exception.
  await assert.rejects(
    runtimeService.listControllers(),
    (e) => e instanceof HttpError && e.statusCode === 503,
    'listControllers() rejects with HttpError(503) when Runtime is unreachable'
  );
  await assert.rejects(
    runtimeService.getController('FCU-1'),
    (e) => e instanceof HttpError && e.statusCode === 503,
    'getController() rejects with HttpError(503) when Runtime is unreachable'
  );
  await assert.rejects(
    runtimeService.pollNow('FCU-1'),
    (e) => e instanceof HttpError && e.statusCode === 503
  );

  // Deploy/rollback must never fail (or throw) just because Runtime happens to be down — the DB
  // activation already committed by the time this runs.
  const reloadResult = await runtimeService.resyncLiveSimBindings();
  assert.equal(reloadResult.ok, false, 'resyncLiveSimBindings() reports degraded rather than throwing');

  // getRuntimeHealth() is a non-throwing probe used by the Server's own /health endpoint.
  const health = await runtimeService.getRuntimeHealth();
  assert.equal(health.reachable, false, 'getRuntimeHealth() reports unreachable rather than throwing');

  console.log('OK: runtime HTTP client degrades to controlled errors (503/HttpError, non-throwing reload/health probes) when Legion Runtime is unavailable — never an uncaught exception.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
