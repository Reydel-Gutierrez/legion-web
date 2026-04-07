require('./config/env');
const { PORT } = require('./config/env');
const app = require('./app');

app.listen(PORT, () => {
  console.log(`Legion API listening on http://localhost:${PORT}`);
  console.log('  Address search: GET /api/geocode/suggest?q=…  (health: GET /api/geocode/health)');
});
