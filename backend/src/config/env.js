require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[config] DATABASE_URL is not set. Set it in backend/.env before running migrations.'
  );
}

module.exports = {
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
};
