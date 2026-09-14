# Legion Web

Legion Web is the frontend application for Legion Controls’ Building Automation Systems (BAS) platform. It provides two primary workspaces: **Operator Mode** for day-to-day building operations and **Engineering Mode** for configuration, validation, and deployment.

## Operator Mode

- **Dashboard** — Site summary, alarms, recent events, equipment health, weather
- **Site Layout** — Building and floor views
- **Equipment** — Tree view and workspace points
- **Alarms** — Filterable alarm list
- **Trends** — Historical trend lines (mock data, 14-day cap)
- **Schedules** — Weekly schedules for equipment
- **Events** — Event log with filters
- **Users** — User list and roles
- **Settings** — Profile and system settings

## Engineering Mode

- **Site Builder** — Buildings, floors, equipment hierarchy
- **Network Discovery** — BACnet device discovery
- **Point Mapping** — Template points to BACnet object mapping
- **Graphics Manager** — Equipment graphics and bindings
- **Template Library** — Equipment and graphic templates
- **Validation Center** — Draft validation and readiness
- **Deployment** — Deploy configuration and view history

## Current Frontend Status

- Identity and routing are Legion-focused; Operator and Engineering flows are active.
- Data is served from a **canonical data-access layer** (`src/lib/data`) with a mock/API toggle. Pages use repository functions only; they do not import raw mock files directly.
- Backend and database integration is **live**. Sites/buildings/floors/equipment/points, alarms, and BACnet discovery/read/write are served by the Express/Prisma/PostgreSQL API in `backend/`. Some operator surfaces still fall back to `adapters/api/operatorApi.js` stubs until their HTTP wiring is finished; check that adapter and `src/lib/data/config.js` (`USE_MOCK_DATA`, `USE_HIERARCHY_API`) before assuming a given page is mock or live.
- A SIM controller catalog (`backend/src/lib/simulatedControllers/catalog.js` — FCU-1, FCU-2, VAV-1) currently exercises the full point/stale-status/alarm/trend pipeline end-to-end. The real BACnet/IP polling service (`backend/src/services/bacnet/`) exists, but its integration into that same persistent runtime pipeline is not yet verified or complete.

## Stack

- React 17, React Router 5, React Bootstrap (Themesberg)
- SASS (Volt-derived theme under `src/scss/volt`)
- Express + Prisma + PostgreSQL backend (`backend/`); frontend runs against it via `REACT_APP_API_BASE_URL`

## Folder Structure (high level)

```
src/
  app/           layout, router, providers
  modules/       operator/ (dashboard, site, equipment, alarms, trends, schedules, events, users, settings)
                 engineering/ (site-builder, network-discovery, point-mapping, graphics-manager, template-library, validation-center, deployment)
  components/    legion/ (shared UI), ui/
  lib/           data/ (repositories, adapters, contracts), utils, activeDeploymentUtils, sites
  hooks/         useEngineeringDraft, useTablePagination, etc.
  assets/        img, svgs, scss
```

## Run Locally

```bash
npm install
npm start
```

- App runs at `http://localhost:3000` (or the port CRA assigns).
- Use **Operator** vs **Engineering** mode via the layout/sidebar; site selector drives context for both.

## Backend / Database

Integrated. The backend lives in `backend/` (Express + Prisma + PostgreSQL) — see `backend/README` equivalents in `AGENTS.md` for commands (`npm run dev`, `npm run prisma:migrate`, `npm run smoke:bacnet`). Set `REACT_APP_API_BASE_URL` in `.env.local` to point the frontend at a running API (see `.env.example`); when unset, pages fall back to their mock adapters under `src/lib/data/adapters/mock/`.

BACnet/IP discovery, read/write, polling, and device-health services live under `backend/src/services/bacnet/` using `node-bacnet`. BACnet MS/TP and the Sentry G1 edge gateway are not implemented yet — see the Legion Controls Master Architecture document for current architecture status.
