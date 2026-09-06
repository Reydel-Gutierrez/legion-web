require('./config/env');
const { PORT } = require('./config/env');
const app = require('./app');
const runtimeService = require('./modules/runtime/runtime.service');
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

runtimeService.initialize().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[runtime] initialize failed (API will still start):', err?.message || err);
});

app.listen(PORT, () => {
  console.log(`Legion API listening on http://localhost:${PORT}`);
  console.log('  Address search: GET /api/geocode/suggest?q=…  (health: GET /api/geocode/health)');
  console.log('  BACnet: GET /api/runtime/bacnet/explorer/devices');
});
