require('./config/env');
const { PORT, LEGION_PROFILE } = require('./config/env');
const app = require('./app');
const prisma = require('./lib/prisma');
const { reconnectSimCatalogToExistingEquipment } = require('./lib/simCatalogBindingSync');
const { runStartupChecks } = require('./lib/startupChecks');

try {
  const startupResults = runStartupChecks();
  for (const message of startupResults) {
    // eslint-disable-next-line no-console
    console.log(`[startup] ${message}`);
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[startup] check failed:', err?.message || err);
  process.exit(1);
}

// LC-ARCH-004 Phase 2: the API process no longer owns polling/runtime execution — that is Legion
// Runtime's job now (see `runtime/`), a separate OS process reached only over HTTP (see
// `src/lib/runtimeClient.js`). This Engineering-side self-heal (auto-binding SIM catalog demo
// equipment to ControllersMapped rows) stays here because it only ever touches Engineering tables,
// never Live/runtime state.
reconnectSimCatalogToExistingEquipment()
  .then((result) => console.log('[startup] SIM catalog reconnect', result))
  .catch((err) => console.warn('[startup] SIM catalog reconnect failed:', err?.message || err));

const server = app.listen(PORT, () => {
  console.log(`Legion API [profile=${LEGION_PROFILE}] listening on http://localhost:${PORT}`);
  console.log('  Address search: GET /api/geocode/suggest?q=…  (health: GET /api/geocode/health)');
  console.log('  BACnet: GET /api/runtime/bacnet/explorer/devices');
  console.log('  Runtime: proxied via /api/runtime/* — see LEGION_RUNTIME_URL');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received — shutting down gracefully`);
  await new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 5000).unref();
  });
  try {
    await prisma.$disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
