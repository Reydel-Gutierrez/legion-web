/**
 * Development storage separation (LC-ARCH-002 §10). `LEGION_PROFILE` selects which env file this
 * process loads — `engineering` (default, unchanged behavior: plain `backend/.env`),
 * `ls100-sim`, or `ls100-production` each load their own `backend/.env.<profile>` (see
 * `backend/docs/deployment-profiles.md`) so two profiles can run simultaneously against separate
 * databases/ports without any code change. Not setting LEGION_PROFILE at all reproduces the exact
 * existing single-process workflow — nothing breaks for anyone who does nothing differently.
 *
 * Executed directly by Node's native TypeScript type-stripping (Node >=22.6, no build step) — see
 * backend/tsconfig.json for the type-checking-only config used by `npm run typecheck`. Keep this
 * file to erasable syntax only (interfaces/type aliases/annotations — no `enum`, no parameter
 * properties) since nothing compiles it before Node runs it.
 */
import type * as PathModule from "path";
import type * as FsModule from "fs";

const path: typeof PathModule = require("path");
const fs: typeof FsModule = require("fs");
const dotenv = require("dotenv");

export interface LegionEnv {
  LEGION_PROFILE: string;
  PORT: number;
  DATABASE_URL: string | undefined;
  JSON_BODY_LIMIT: string;
  BACNET_PORT: number;
  BACNET_APDU_TIMEOUT_MS: number;
  BACNET_INTERFACE: string | undefined;
  BACNET_BROADCAST_ADDRESS: string | undefined;
  LEGION_RUNTIME_URL: string;
  RUNTIME_INTERNAL_TOKEN: string | null;
  RUNTIME_REQUEST_TIMEOUT_MS: number;
}

const LEGION_PROFILE: string = process.env.LEGION_PROFILE || "engineering";
const profileEnvPath = path.join(__dirname, "..", "..", `.env.${LEGION_PROFILE}`);
if (LEGION_PROFILE !== "engineering" && fs.existsSync(profileEnvPath)) {
  dotenv.config({ path: profileEnvPath });
} else {
  dotenv.config();
}

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[config] DATABASE_URL is not set. Set it in backend/.env before running migrations."
  );
}

/** Max JSON body for PUT /api/sites/:id/working-version (graphics may embed base64). */
const JSON_BODY_LIMIT: string = process.env.JSON_BODY_LIMIT || "50mb";

const BACNET_PORT = Number(process.env.BACNET_PORT) || 47808;
const BACNET_APDU_TIMEOUT_MS = Number(process.env.BACNET_APDU_TIMEOUT_MS) || 6000;

/** LC-ARCH-004 Phase 2: Legion Runtime is a separate process; this is its internal HTTP API. */
const LEGION_RUNTIME_URL: string = process.env.LEGION_RUNTIME_URL || "http://127.0.0.1:4200";
const RUNTIME_INTERNAL_TOKEN: string | null = process.env.RUNTIME_INTERNAL_TOKEN || null;
const RUNTIME_REQUEST_TIMEOUT_MS = Number(process.env.RUNTIME_REQUEST_TIMEOUT_MS) || 5000;

const env: LegionEnv = {
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

module.exports = env;
