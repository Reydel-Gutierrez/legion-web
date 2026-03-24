require('./config/env');
const { PORT } = require('./config/env');
const app = require('./app');

app.listen(PORT, () => {
  console.log(`Legion API listening on http://localhost:${PORT}`);
});
