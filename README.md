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
- Backend and database integration is **upcoming**. The app is structured to swap mock adapters for API adapters without changing page code.

## Stack

- React 16, React Router 5, React Bootstrap (Themesberg)
- SASS (Volt-derived theme under `src/scss/volt`)
- No backend dependency for current runs

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

Not integrated yet. The data layer uses mock adapters; placeholder API adapters exist under `src/lib/data/adapters/api/` for a future swap.
