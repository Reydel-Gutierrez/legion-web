require('dotenv').config();

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

module.exports = {
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JSON_BODY_LIMIT,
  BACNET_PORT,
  BACNET_APDU_TIMEOUT_MS,
  BACNET_INTERFACE: process.env.BACNET_INTERFACE,
  BACNET_BROADCAST_ADDRESS: process.env.BACNET_BROADCAST_ADDRESS,
};
