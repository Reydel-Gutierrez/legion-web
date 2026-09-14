/**
 * Development storage separation (LC-ARCH-002 §10). `LEGION_PROFILE` selects which env file this
 * process loads — `engineering` (default, unchanged behavior: plain `backend/.env`),
 * `ls100-sim`, or `ls100-production` each load their own `backend/.env.<profile>` (see
 * `backend/docs/deployment-profiles.md`) so two profiles can run simultaneously against separate
 * databases/ports without any code change. Not setting LEGION_PROFILE at all reproduces the exact
 * existing single-process workflow — nothing breaks for anyone who does nothing differently.
 */
const path = require('path');
const fs = require('fs');

const LEGION_PROFILE = process.env.LEGION_PROFILE || 'engineering';
const profileEnvPath = path.join(__dirname, '..', '..', `.env.${LEGION_PROFILE}`);
if (LEGION_PROFILE !== 'engineering' && fs.existsSync(profileEnvPath)) {
  require('dotenv').config({ path: profileEnvPath });
} else {
  require('dotenv').config();
}

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[config] DATABASE_URL is not set. Set it in backend/.env before running migrations.'
  );
}

/** Max JSON body for PUT /api/sites/:id/working-version (graphics may embed base64). */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '50mb';

const BACNET_PORT = Number(process.env.BACNET_PORT) || 47808;
const BACNET_APDU_TIMEOUT_MS = Number(process.env.BACNET_APDU_TIMEOUT_MS) || 6000;

/** LC-ARCH-004 Phase 2: Legion Runtime is a separate process; this is its internal HTTP API. */
const LEGION_RUNTIME_URL = process.env.LEGION_RUNTIME_URL || 'http://127.0.0.1:4200';
const RUNTIME_INTERNAL_TOKEN = process.env.RUNTIME_INTERNAL_TOKEN || null;
const RUNTIME_REQUEST_TIMEOUT_MS = Number(process.env.RUNTIME_REQUEST_TIMEOUT_MS) || 5000;

module.exports = {
  LEGION_PROFILE,
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JSON_BODY_LIMIT,
  BACNET_PORT,
  BACNET_APDU_TIMEOUT_MS,
  BACNET_INTERFACE: process.env.BACNET_INTERFACE,
  BACNET_BROADCAST_ADDRESS: process.env.BACNET_BROADCAST_ADDRESS,
  LEGION_RUNTIME_URL,
  RUNTIME_INTERNAL_TOKEN,
  RUNTIME_REQUEST_TIMEOUT_MS,
};
