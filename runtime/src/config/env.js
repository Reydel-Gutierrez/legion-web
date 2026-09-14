'use strict';

/**
 * Runtime config. Reuses the backend's `.env` for DATABASE_URL (both processes share one Postgres
 * database — see AGENTS.md) and reads its own RUNTIME_* variables on top. A `runtime/.env` (if
 * present) or already-exported process env vars take precedence for RUNTIME_* settings.
 */
const path = require('path');
const fs = require('fs');

const backendEnvPath = path.join(__dirname, '..', '..', '..', 'backend', '.env');
if (fs.existsSync(backendEnvPath)) {
  require('dotenv').config({ path: backendEnvPath });
}
// Loads runtime/.env if present; never overrides a variable already set above or in the shell.
require('dotenv').config();

const RUNTIME_PORT = Number(process.env.RUNTIME_PORT) || 4200;
/** Loopback by default — this is an internal service, not meant for browser/external access. */
const RUNTIME_HOST = process.env.RUNTIME_HOST || '127.0.0.1';
/** Optional shared-secret header check for Server->Runtime calls; unset = open on loopback (dev default). */
const RUNTIME_INTERNAL_TOKEN = process.env.RUNTIME_INTERNAL_TOKEN || null;

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[runtime] DATABASE_URL is not set — check backend/.env or runtime/.env.');
}

module.exports = {
  RUNTIME_PORT,
  RUNTIME_HOST,
  RUNTIME_INTERNAL_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
};
