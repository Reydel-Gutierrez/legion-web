'use strict';

const { RUNTIME_PORT, RUNTIME_HOST } = require('./config/env');
const runtimeCore = require('./core/runtimeCore');
const { createServer } = require('./http/server');

let httpServer = null;
let shuttingDown = false;

async function main() {
  // Initialize the poll loop/state BEFORE accepting HTTP traffic so /ready is meaningful from the
  // first request — but never let init failure crash the process; report degraded via /ready instead.
  try {
    await runtimeCore.initialize();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[runtime] initialize failed (HTTP API still starts; /ready will report degraded):', e?.message || e);
  }

  httpServer = createServer();
  httpServer.listen(RUNTIME_PORT, RUNTIME_HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Legion Runtime listening on http://${RUNTIME_HOST}:${RUNTIME_PORT}`);
    // eslint-disable-next-line no-console
    console.log('  GET  /live, /ready, /health, /runtime/status');
    // eslint-disable-next-line no-console
    console.log('  POST /runtime/reload');
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[runtime] ${signal} received — shutting down gracefully`);
  const closeHttp = new Promise((resolve) => {
    if (!httpServer) return resolve();
    httpServer.close(() => resolve());
    // Stop accepting new connections but don't hang forever on a stuck keep-alive socket.
    setTimeout(resolve, 5000).unref();
  });
  await closeHttp;
  await runtimeCore.shutdown();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[runtime] fatal startup error:', e?.message || e);
  process.exit(1);
});
