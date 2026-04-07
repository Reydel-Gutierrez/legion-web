require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[config] DATABASE_URL is not set. Set it in backend/.env before running migrations.'
  );
}

/** Max JSON body for PUT /api/sites/:id/working-version (graphics may embed base64). */
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '50mb';

module.exports = {
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JSON_BODY_LIMIT,
};
