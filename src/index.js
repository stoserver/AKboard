const env = require('./config/env');
const { initSchema } = require('./db');

initSchema();

const app = require('./app');

app.listen(env.port, () => {
  console.log(`AKBoard engine listening on http://localhost:${env.port}`);
});
