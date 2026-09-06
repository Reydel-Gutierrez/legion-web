# Repository Guidelines

## Project Structure & Module Organization

Legion Web is a building automation application with a React 17 frontend and an Express/Prisma backend using PostgreSQL.

- `src/app/`: routing, layouts, and context providers.
- `src/modules/operator/` and `src/modules/engineering/`: feature pages and workspace components.
- `src/components/`: shared UI; `src/hooks/`: reusable hooks.
- `src/lib/data/`: repositories, contracts, and mock/API adapters. Access data through repositories rather than importing raw mocks into pages.
- `src/assets/` and `public/`: graphics and static assets; `src/scss/`: theme and application styles.
- `backend/src/`: API modules, middleware, and BACnet services; `backend/prisma/`: schema, migrations, and seed data.
- Frontend tests live beside implementation files as `*.test.js`. Generated output goes in `build/`.

## Build, Test, and Development Commands

Run frontend commands from the repository root:

- `npm ci`: install locked dependencies.
- `npm start`: start the development server, normally on port 3000.
- `npm run build`: produce the production bundle in `build/`.
- `npm test -- --watchAll=false`: run the Jest suite once.

Run backend commands from `backend/`:

- `npm ci`: install dependencies and generate the Prisma client.
- `npm run dev`: start the API server.
- `npm run prisma:migrate`: apply development migrations.
- `npm run smoke:bacnet`: check BACnet routes against a running API, defaulting to port 4000.

## Coding Style & Naming Conventions

Use two-space indentation and semicolons; match surrounding quote style. Frontend files use ES modules, while backend files use CommonJS. Name components in PascalCase, hooks as `useSomething`, and utilities in camelCase. Preserve backend patterns such as `equipment.controller.js` and `equipment.service.js`. ESLint configuration lives in the root `package.json`; no standalone lint or formatter script is defined.

## Testing Guidelines

Use Jest and React Testing Library for behavior-focused tests. Cover changed permissions, point classification, hierarchy selection, and UI interactions where applicable. No coverage threshold is configured. Run relevant tests and the frontend build before submitting frontend changes; use backend smoke checks for route changes.

## Commit & Pull Request Guidelines

History uses informal descriptive messages without a consistent prefix convention. Write concise, action-oriented subjects. PRs should explain the behavior change, link relevant issues, list validation performed, and include screenshots for UI changes. Call out schema migrations and configuration changes.

## Security & Configuration

Copy `.env.example` to `.env.local` for frontend configuration. Set `REACT_APP_API_BASE_URL` to connect to the API; configure backend `DATABASE_URL` for PostgreSQL. Never commit credentials or place secrets in browser-exposed `REACT_APP_*` variables.

## Legion Product & Architecture Rules

Legion Controls is intended to be a commercial Building Automation System platform.

The application is organized around:

- Operator Dashboard
- Commissioning Dashboard
- Engineering Dashboard
- BACnet/IP and BACnet MS/TP
- Facility hierarchy
- Equipment graphics
- Point management
- Scheduling
- Alarming
- Trending/historian functionality

### BAS Architecture Rules

- Preserve existing functionality unless a task explicitly replaces it.
- Do not fake live BAS values in the frontend.
- Do not hardcode equipment-specific behavior when a reusable abstraction is possible.
- Online/offline state must derive from actual communication/runtime freshness.
- Alarm state and communication state are independent.
- BACnet runtime behavior belongs in backend/runtime services, not frontend workarounds.
- Respect the Site → Building → Floor → Equipment → Point hierarchy.
- One archive/database represents one Site.
- Prefer reusable components, hooks, services, and contracts over one-off implementations.

### UI Rules

- Maintain the current Legion light professional design language.
- Do not redesign unrelated UI while implementing a feature.
- Avoid unnecessary pages, tabs, cards, and controls.
- Prefer reusable workspace cards.
- Avoid excessive internal scrolling.
- Preserve the Operator equipment 2x2 workspace architecture unless explicitly instructed otherwise.

### Agent Workflow

Before editing:

1. Inspect the relevant existing implementation.
2. Trace the current data flow.
3. Reuse existing abstractions where appropriate.
4. Briefly state the intended implementation.

After editing:

1. Run relevant tests.
2. Run the frontend build when frontend code changes.
3. Run appropriate backend tests/checks when backend code changes.
4. Fix failures introduced by the change.
5. Distinguish pre-existing failures from new failures.
6. Review the final diff before declaring the task complete.

### Git Safety

- Work only on the current feature branch.
- Never force-push.
- Never rewrite Git history.
- Never merge into `main`.
- Do not push unless explicitly instructed.
- Do not commit unrelated changes.
- Do not delete branches.

### Safety

Never:

- delete production/user data,
- modify real production credentials,
- expose secrets,
- fabricate BACnet values,
- bypass authentication,
- make destructive database changes without explicit approval.

When a decision is destructive or would substantially change Legion's architecture, stop and ask first.
