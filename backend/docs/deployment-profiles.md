# Development storage separation & profiles (LC-ARCH-002 §10)

Three profiles share one codebase and one Prisma schema. `LEGION_PROFILE` (env var) selects which
`backend/.env.<profile>` file a process loads (see `backend/src/config/env.js`); the database
boundary itself is just "point `DATABASE_URL` at a different Postgres database." Nothing here
requires Docker or a second codebase, and not setting `LEGION_PROFILE` at all reproduces the
existing single-process workflow exactly — this is additive, not a breaking migration.

| Profile | Purpose | Env file | Default port |
|---|---|---|---|
| `engineering` (default) | Offline project authoring — the existing dev workflow, unchanged | `backend/.env` | 4000 |
| `ls100-sim` | A local backend that behaves like a commissioned LS-100, for testing the deployment pipeline end-to-end without real hardware | `backend/.env.ls100-sim` | 4100 |
| `ls100-production` | Template for a real device-local LS-100 | `backend/.env.ls100-production` | 4000 |

## Setup

```bash
cd backend
cp .env.example .env                              # engineering — unchanged from before this work
cp .env.ls100-sim.example .env.ls100-sim           # edit DATABASE_URL to a second, empty database
createdb legion_ls100_sim                          # (or your Postgres tool of choice)
npx prisma migrate deploy                          # applies migrations to whichever DATABASE_URL is active
```

`prisma migrate deploy`/`dev` reads `DATABASE_URL` from whatever `.env*` file is currently active in
your shell — Prisma's own CLI does not know about `LEGION_PROFILE`, so when preparing the
`ls100-sim` database specifically, either export `DATABASE_URL` for that database directly, or
`cp .env.ls100-sim .env.ls100-sim.local && DATABASE_URL=$(grep DATABASE_URL .env.ls100-sim | cut -d= -f2- | tr -d '"') npx prisma migrate deploy`.

## Running both profiles simultaneously

```bash
# Terminal 1 — Engineering (existing workflow, nothing changes)
cd backend && npm run dev

# Terminal 2 — LS-100 simulation, its own database and port
cd backend && LEGION_PROFILE=ls100-sim npm run dev
```

Both processes share the same Node code; only `DATABASE_URL`/`PORT`/`LEGION_PROFILE` differ. The
frontend talks to whichever backend `REACT_APP_API_BASE_URL` points at — run two frontend dev
servers (different ports) or switch the URL when you want to look at the LS-100 simulation's
Operator Mode instead of Engineering.

## What `LEGION_PROFILE` actually changes

- **Env file loaded** (`backend/src/config/env.js`).
- **`prisma/seed.js`** refuses outright under `ls100-production`, and forces `SEED_DEMO_SITES` off
  under any `ls100-*` profile regardless of the env var (an LS-100's Site comes only from a
  deployed package).
- **`npm run project:strip-plaza`** refuses outright under any `ls100-*` profile (see below).
- **`deployment.auth.js`** requires `LS100_DEPLOY_TOKEN` and rejects every deployment request with
  HTTP 501 under `ls100-production` when it is not set; under `engineering`/`ls100-sim` a missing
  token is allowed through with a one-time console warning (development only).

Everything else (routes, schema, business logic) is identical across profiles — there is one
Express app and one Prisma schema, not a forked implementation.

## Strip Plaza reference project

`npm run project:strip-plaza` (run under the `engineering` profile) creates the Strip Plaza site in
the **Engineering** database only — see `backend/scripts/project-strip-plaza.js`. It is idempotent
(fixed ids; safe to re-run) and deliberately refuses to run under an `ls100-*` profile. To get
Strip Plaza onto an LS-100 (simulation or otherwise), build and deploy/import its package — see
`backend/docs/lspkg-format.md` and the exact commands in the top-level completion report.

## Production limitations (honest gaps)

This repo has no production-grade: authentication/identity system (the whole backend has none —
`deployment.auth.js` is a shared-secret stopgap, not real auth), package signing (checksums only —
see `backend/src/lib/lspkg/signing.js`), device provisioning/certificate issuance, or LCPE/firmware
integration. `ls100-production` is a documented *profile shape*, not a hardened product.
