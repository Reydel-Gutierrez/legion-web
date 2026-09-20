'use strict';

/**
 * Legion BACnet Commissioning service — a standalone entry point, separate OS process from the
 * full Legion Express Server (server.js/app.js). Mounts ONLY the existing BACnet
 * discovery/read/write/explorer/health/polling routes (modules/bacnet) — no sites, equipment,
 * users, alarms, deployment, or any other Express module is loaded here.
 *
 * Per Phase 4's cutover decision: BACnet commissioning/discovery stays on the proven, working
 * `node-bacnet` implementation rather than being rewritten in Java for language purity, but it no
 * longer needs the full multi-domain Express Server kept alive as a production dependency — this
 * file *is* that isolation. Legion Server (Spring) is the only intended caller in production,
 * proxying `/api/runtime/bacnet/**` to this process exactly the way it already proxies to the
 * Legion Runtime process (see server/.../bacnet/BacnetCommissioningClient.java) — same 502/503
 * degradation semantics, so an unreachable commissioning service never crashes Spring.
 *
 * Still uses the same Postgres database (via backend's own Prisma client) because commissioning
 * genuinely needs schema knowledge — discovery caching and "import discovered device as
 * Equipment/Controller/Points" both read/write real hierarchy tables. Process/failure-domain
 * isolation (a separate OS process, a separate port, no other Express routes loaded) is the
 * property that matters here, not filesystem independence.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const bacnetRoutes = require('./modules/bacnet/bacnet.routes');
const prisma = require('./lib/prisma');

const app = express();

console.log('NODE_ENV:', process.env.NODE_ENV);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/** LIVE: this process is running. Never depends on the database. */
app.get('/live', (req, res) => {
  res.json({ ok: true });
});

/** READY: this process can perform its role (serve BACnet commissioning backed by the database). */
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, dbReachable: true });
  } catch (e) {
    res.status(503).json({ ok: false, dbReachable: false, error: e?.message || String(e) });
  }
});

app.get('/health', async (req, res) => {
  let dbReachable = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (_) {
    dbReachable = false;
  }
  res.json({ ok: true, service: 'bacnet-commissioning', dbReachable });
});

// Same route surface bacnet.routes.js has always exposed (previously reached via Express at
// /api/runtime/bacnet/*) — mounted here at the process root since this service has no other
// domain to namespace against.
app.use('/', bacnetRoutes);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.BACNET_COMMISSIONING_PORT || 4300);
app.listen(port, () => {
  console.log(`Legion BACnet Commissioning service listening on port ${port}`);
  console.log('  Discovery:        POST /discover');
  console.log('  Explorer:         GET  /explorer/devices');
  console.log('  Health (own):     GET  /health');
});

module.exports = app;
