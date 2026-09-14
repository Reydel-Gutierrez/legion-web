# Legion Site Package (`.lspkg`) format — schema version 1

Governing architecture: `LC-ARCH-002` (Legion Engineering & Deployment Architecture v1.0), decisions
DEP-001–DEP-008. This document is the versioned, authoritative description of the `.lspkg`
container. Bumping `packageSchemaVersion` requires updating this document and deciding a
compatibility policy (`backend/src/lib/lspkg/manifest.js:SUPPORTED_SCHEMA_VERSIONS`) — an LS-100
that does not recognize a package's schema version must refuse to stage it, never guess.

## Container

A `.lspkg` file is a ZIP archive (implementation: `backend/src/lib/lspkg/zip.js`, a minimal
dependency-free reader/writer built on Node's `zlib`/`crypto` only — no external zip library is
installed in this repo). Constraints on the container itself:

- **STORE only** (no compression). Entries are JSON text in the KB–low-MB range; STORE removes any
  question of cross-environment compression determinism.
- **Fixed timestamps.** Every entry uses DOS date 1980-01-01 — two builds from identical logical
  content produce byte-identical archives (see "Determinism" below).
- **Path-safe entry names.** Forward-slash relative paths only; no `..` segment, no absolute path,
  no drive letter. Rejected at read time (`ZipError`), not sanitized silently.
- **No compression method other than 0 (STORE) is accepted on read.**

## Top-level manifest — `manifest.json`

Required fields (`backend/src/lib/lspkg/manifest.js:REQUIRED_MANIFEST_FIELDS`):

| Field | Meaning |
|---|---|
| `packageSchemaVersion` | Integer. This document describes version `1`. |
| `packageId` | UUID, unique per *build* (two builds of the same project version get different `packageId`s). |
| `siteId` | The Site's stable Prisma UUID from the Engineering database. This is the identity DEP-001's one-active-Site rule and same-Site-upgrade matching are keyed on. |
| `siteName` | Human-readable, informational only. |
| `projectVersion` | Caller-supplied or auto-generated string (e.g. `v1758..`), the Engineering project version this package was built from. |
| `createdAt` | ISO-8601 build timestamp. Excluded from the determinism guarantee (see below). |
| `author` | Identity string if available; `null` otherwise — no authentication system in this repo issues a verifiable identity yet, so this is informational metadata, not a signed claim. |
| `toolVersion` | The building backend's `package.json` version. |
| `minLs100Version` | Minimum LS-100 runtime version required to activate this package. |
| `simulationPackage` | `true` only when explicitly requested — gates inclusion of dev SIM controller/mapping records. |
| `deploymentScope` | `"full-site"` in schema version 1 (LC-ARCH-002 §7: "first implementation may support full-site configuration packages only"). |
| `releaseNotes` | Auto-generated change summary (via `diff.js`) unless the caller supplies one. |
| `files` | Sorted array of every content file name included (excluding `manifest.json` itself). |
| `checksums` | `{ [fileName]: sha256Hex }` — SHA-256 over the **canonical** (recursively key-sorted) JSON serialization of that file's parsed content, not over raw bytes, so re-serialization (e.g. after transport) never spuriously breaks a checksum. |
| `signature` | `{ signed: boolean, algorithm: string, signature: string\|null, reason?: string }` — see "Signing" below. |

## Content files

| File | Contents | Notes |
|---|---|---|
| `site.json` | `{ site, buildings, floors }` | Site/building/floor identity and config fields only. |
| `equipment.json` | `{ equipment, points }` | Point *definitions* only — no `presentValue`, no `commState`, no `lastSeenAt`. |
| `mappings.json` | `{ controllers, pointMappings, designed }` | `controllers`/`pointMappings` are the relational `ControllersMapped`/`PointsMapped` rows (config fields only — no `status`/`lastSeenAt`/`metadataJson`); `designed` is the Engineering working-payload's own draft mapping intent JSON, passed through as authored. |
| `graphics.json` | `{ graphics, siteLayoutGraphics }` | Passed through from the Engineering working payload as authored — these are canvas/binding JSON, not live values. |
| `templates.json` | `{ equipmentTemplates, graphicTemplates }` | Site-local template copies from the Engineering working payload. |
| `alarms.json` | `{ alarmDefinitions }` | Definitions only — never `AlarmEvent` (history). |
| `trends.json` | `{ trendDefinitions }` | Definitions + assignments only — never `PointHistorySample`. |
| `schedules.json` | `{ scheduleDefinitions }` | Definitions + assignments only. |
| `network.json` | Intended BACnet/IP + MS/TP network configuration | Design intent only — never discovered/live scan results. |
| `controllerApplications.json` | `{ controllerApplications }` | LCPE controller-application *references* only (LC-ARCH-002 §9). This repo has no LCPE integration; every entry is honestly `status: "NOT_APPLICABLE"`. Activating a package never claims a physical controller received a program. |

## Stable identity

Every object inside a package (`site`, `equipment[].id`, `points[].id`, `controllers[].id`,
`alarmDefinitions[].id`, `trendDefinitions[].id`, `scheduleDefinitions[].id`, ...) carries the exact
Prisma UUID assigned in the Engineering database. That UUID **is** the stable logical identity:

- First activation to a fresh LS-100 creates rows with these exact ids.
- A later version of the *same* Site reuses the same ids — activation upserts by id rather than
  deleting and recreating the hierarchy (DEP-001, DEP-006, LC-ARCH-002 §7 "match configuration
  through stable logical identities").
- An id present in an *older* activated version but absent from the new package is a removal —
  surfaced explicitly in the change preview, never silently dropped.

## Explicit exclusions (enforced, not just documented)

`backend/src/lib/lspkg/builder.js` only ever selects an explicit allow-list of fields per Prisma
model — it never does `include: true` on a whole row. On top of that, `manifest.js:assertNoForbiddenKeys`
recursively scans the fully-assembled manifest and file set for any key matching
`/password|secret|token|apikey|privatekey|credential/i` and throws rather than silently stripping.

Never present in a package: `PointHistorySample`, `AlarmEvent`, `Point.presentValue`/`commState`/
`lastSeenAt`, `ControllersMapped.status`/`lastSeenAt`/`metadataJson`, any `User`/`UserSiteAccess`/
credential data, raw PostgreSQL dumps, or SIM controller/mapping records unless
`simulationPackage: true` was explicitly requested. Equipment/point/alarm/trend/schedule
*definitions* are never SIM-filtered — a SIM controller binding is a dev-only stand-in for how a
point's value is currently being driven, not part of the site's design.

## Determinism

`buildSitePackage()` guarantees **identical logical content** — `files` and `checksums` — from
identical database input, given identical caller-supplied `packageId`/`projectVersion`/`now`
(these three are the only "explicitly permitted build metadata" allowed to differ between builds
of the same underlying content; in normal operation `packageId` is a fresh UUID and `createdAt` is
wall-clock time per build, by design — every build is a distinct, auditable artifact even when
nothing changed). With those three pinned, the resulting `.lspkg` bytes are identical.

## Checksums vs. signing

A **checksum** (SHA-256, always present) is an integrity check: it detects corruption or tampering
in transit. A **signature** is an authenticity/non-repudiation claim: it proves *who* built the
package. This repo has no production key-management system — nowhere to safely generate, store,
rotate, or distribute a private signing key — so `backend/src/lib/lspkg/signing.js` defines the
`Signer` interface future production signing must implement, and ships only an
`UnsignedDevelopmentSigner` default. Every package built today carries `signature.signed === false`
and the parser (`parser.js`) surfaces this as an explicit warning, never a silent gap.

## Validation on read (`parser.js`)

1. ZIP structure integrity + path safety + size/file-count limits (`zip.js`).
2. `manifest.json` present, JSON-parses, and passes `validateManifest`.
3. `packageSchemaVersion` is in `SUPPORTED_SCHEMA_VERSIONS` — otherwise rejected outright.
4. Every file `manifest.files` declares is present; every checksum matches a fresh SHA-256 of that
   file's canonical JSON; any archive entry *not* declared in the manifest is rejected (no
   undeclared/hidden content).
5. `assertNoForbiddenKeys` re-run on read (defense in depth — a package could have been built by a
   future/different tool).

A package that fails any of these is never staged as valid; the caller persists the failure reason
instead of proceeding.
