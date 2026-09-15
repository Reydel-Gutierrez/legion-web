# Migration strategy: Prisma → Flyway

The schema currently exists and is applied via Prisma (`backend/prisma/schema.prisma` +
`backend/prisma/migrations/`, 27+ migrations already run against `legion_db`). This directory is
Flyway's migration home going forward — **not** a replay of Prisma's history.

## How this works

- `spring.flyway.baseline-on-migrate=true` + `spring.flyway.baseline-version=0` (see
  `application.yml`) tells Flyway: "assume everything up through version 0 already exists — don't
  try to create it, just record that it's done." The first time Spring boots against an existing
  `legion_db`, Flyway creates its own `flyway_schema_history` table and inserts one baseline row.
  It never runs `CREATE TABLE` for anything Prisma already created.
- Every schema change **from this point forward** — whether driven by Engineering work in Spring or
  by a future Node-side change — should get a Flyway migration here (`V1__description.sql`,
  `V2__description.sql`, ...), numbered starting above the baseline. Prisma must stop being used to
  change schema once this transition begins, or the two tools will drift out of sync silently.
- **A brand-new/empty database** (fresh dev setup, CI, a new install) also works: Flyway's baseline
  step only activates against a database that lacks its history table; `backend/prisma migrate
  deploy` should still be run once first to create the schema Prisma still owns the *shape* of, then
  Flyway baselines on top of that — same sequence as an existing database. Flyway is never pointed
  at a schema it should create from nothing until Prisma is fully retired.

## What NOT to do

- Do not write a Flyway migration that recreates or drops any existing table — that would destroy
  live Site/SiteVersion/User/PointHistorySample/etc. data.
- Do not run `spring.jpa.hibernate.ddl-auto` as anything other than `none`. Hibernate must never be
  allowed to infer or alter schema here.
- Do not remove `backend/prisma/migrations/` — it remains the historical record of how the schema
  got to its current shape, even after Flyway becomes the tool for new changes.
