require('./config/env');
const { PORT } = require('./config/env');
const app = require('./app');
const runtimeService = require('./modules/runtime/runtime.service');

runtimeService.initialize().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[runtime] initialize failed (API will still start):', err?.message || err);
});

app.listen(PORT, () => {
  console.log(`Legion API listening on http://localhost:${PORT}`);
  console.log('  Address search: GET /api/geocode/suggest?q=…  (health: GET /api/geocode/health)');
});
