'use strict';

/**
 * Shared point-level historian pipeline (LC-ARCH-001 D-010: stale/offline points remain
 * represented in trends; history is never fabricated).
 *
 * Every live write path — the SIM poll loop today, real BACnet/IP and MS/TP polling later —
 * records samples through this module so trends (and any future analytics) read from one
 * persisted timeline per point. A sample is only ever written alongside a real communication
 * event, or an explicit OFFLINE transition marker (value: null) written the moment the runtime
 * reconciler confirms a point has gone stale/unreachable; nothing here invents a numeric value
 * or backfills a gap.
 */

const prisma = require('./prisma');

const QUALITY = { ONLINE: 'ONLINE', OFFLINE: 'OFFLINE', STALE: 'STALE' };

/** @param {unknown} raw */
function normalizeQuality(raw) {
  const q = String(raw || '').trim().toUpperCase();
  return QUALITY[q] ? q : QUALITY.ONLINE;
}

/**
 * @param {{ pointId: string, value?: string|number|null, quality?: string, timestamp?: Date }} entry
 */
function sampleCreateInput(entry) {
  return {
    pointId: String(entry.pointId),
    value: entry.value == null ? null : String(entry.value),
    quality: normalizeQuality(entry.quality),
    timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(),
  };
}

/**
 * Record one sample immediately. Use this for write paths that are not already inside a shared
 * `$transaction` (e.g. a single manual/engineering point update).
 * @param {{ pointId: string, value?: string|number|null, quality?: string, timestamp?: Date }} entry
 */
async function recordSample(entry) {
  return prisma.pointHistorySample.create({ data: sampleCreateInput(entry) });
}

/**
 * Prisma operation list for a batch of samples, meant to be spread into an existing
 * `prisma.$transaction([...])` array so samples commit atomically with the point writes that
 * produced them (see the SIM poll loop in `runtime.service.js`).
 * @param {Array<{ pointId: string, value?: string|number|null, quality?: string, timestamp?: Date }>} entries
 */
function sampleTransactionOps(entries) {
  return (entries || []).map((entry) => prisma.pointHistorySample.create({ data: sampleCreateInput(entry) }));
}

/** Supported trend chart windows (Section 10 / operator trend UI). */
const RANGE_WINDOWS_MS = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/** @param {string} range */
function windowMsForRange(range) {
  const key = String(range || '').trim().toLowerCase();
  return RANGE_WINDOWS_MS[key] || RANGE_WINDOWS_MS['1h'];
}

// --------------------------------------------------------------------------------------------
// Effective historian configuration (coverage + sampleInterval + retentionDays)
//
// A point earns historian rows ONLY because a trend says so. Being SIM-mapped, bound, and polled
// is necessary for a real value to exist, but it is NOT sufficient for that value to be recorded —
// a point with no enabled TrendAssignment (on an enabled TrendDefinition) gets zero
// PointHistorySample rows, full stop. This is computed by ONE query, rebuilt wholesale on every
// refresh (never mutated incrementally), so a point that loses its last qualifying assignment
// cannot leave a stale "covered" entry behind — the next refresh's Map/Set simply won't contain it.
//
// The three derived facts share one snapshot so they can never disagree with each other:
//   - coveredPointIds: every point referenced by resolvedMappings across all qualifying rows.
//   - intervalMsByPoint: the FINEST (minimum) *normalized* sampleInterval among a point's
//     qualifying trends. A trend with a missing/invalid interval is normalized to
//     DEFAULT_SAMPLE_INTERVAL_SECONDS (never treated as "no constraint" — that would record every
//     write), and every normalized value is floored at MIN_SAMPLE_INTERVAL_SECONDS.
//   - retentionDaysByPoint: the LONGEST retentionDays among a point's qualifying trends, falling
//     back to the schema default (new TrendDefinition rows default retentionDays to 30, so this
//     is effectively "explicit value if set, else 30").
//
// Refreshed two ways: (1) pushed immediately by operatorDefinitions.service.js right after every
// create/update/remove/assign/unassign that could change coverage, interval, or retention: (2) a
// slower background timer as a safety net for any row changed outside that service. Both call the
// same `refreshHistorianConfig()`, so there is exactly one code path building this state — no risk
// of the two mechanisms disagreeing on what "current" means.
// --------------------------------------------------------------------------------------------

const DEFAULT_RETENTION_DAYS = 30;

/** Applied when a trend's persisted `sampleInterval` is missing, non-numeric, zero, or negative —
 * a covered point must never fall back to "record every write" just because its interval is bad. */
const DEFAULT_SAMPLE_INTERVAL_SECONDS = 60;

/** Floor for any effective interval, valid or defaulted, so a legitimately small but too-aggressive
 * persisted value (or a future relaxation of the create/update validation) still can't drive
 * per-poll writes. Trend create/update validation in operatorDefinitions.service.js rejects new
 * values below this at the API boundary; this is the last-line runtime enforcement. */
const MIN_SAMPLE_INTERVAL_SECONDS = 10;

/**
 * Normalizes a persisted `sampleInterval` (seconds) into a value that is always a finite number
 * >= {@link MIN_SAMPLE_INTERVAL_SECONDS}. Missing, non-numeric, zero, or negative input falls back
 * to {@link DEFAULT_SAMPLE_INTERVAL_SECONDS} rather than being treated as "no constraint" — this is
 * what keeps a legacy or malformed trend definition from recording on every poll.
 * @param {unknown} raw
 * @returns {number}
 */
function normalizeSampleIntervalSeconds(raw) {
  const numeric = Number(raw);
  if (raw == null || !Number.isFinite(numeric) || numeric <= 0) return DEFAULT_SAMPLE_INTERVAL_SECONDS;
  return Math.max(MIN_SAMPLE_INTERVAL_SECONDS, numeric);
}

let coveredPointIds = new Set();
let intervalMsByPoint = new Map();
let retentionDaysByPoint = new Map();
let configCacheTimer = null;

/** pointId -> epoch ms of the last sample this process recorded for it. Process-local; a restart
 * simply allows one extra sample immediately after startup, never fewer — no data can go missing
 * because of this cache being empty on a fresh process. */
const lastRecordedAtMs = new Map();

async function refreshHistorianConfig() {
  // One snapshot query for all three derived facts, so they always agree with each other and a
  // point dropped from resolvedMappings cannot linger as "covered" under a stale partial cache.
  const assignments = await prisma.trendAssignment.findMany({
    where: { enabled: true, definition: { enabled: true } },
    include: { definition: true },
  });

  const nextCovered = new Set();
  const nextInterval = new Map();
  const nextRetention = new Map();

  for (const assignment of assignments) {
    const definition = assignment.definition;
    if (!definition) continue;
    const mappings = assignment.resolvedMappings || {};
    const pointIds = Object.values(mappings).filter((id) => typeof id === 'string' && id);
    if (!pointIds.length) continue;

    const intervalMs = normalizeSampleIntervalSeconds(definition.sampleInterval) * 1000;
    const retentionDays = definition.retentionDays == null ? DEFAULT_RETENTION_DAYS : Number(definition.retentionDays);

    for (const pointId of pointIds) {
      nextCovered.add(pointId); // this assignment alone is what grants coverage
      const prevInterval = nextInterval.get(pointId);
      if (prevInterval == null || intervalMs < prevInterval) nextInterval.set(pointId, intervalMs);
      if (Number.isFinite(retentionDays)) {
        const prevRetention = nextRetention.get(pointId);
        if (prevRetention == null || retentionDays > prevRetention) nextRetention.set(pointId, retentionDays);
      }
    }
  }

  coveredPointIds = nextCovered;
  intervalMsByPoint = nextInterval;
  retentionDaysByPoint = nextRetention;

  // A point that just fell out of coverage should not have its NEXT (re-)assignment immediately
  // throttled by a stale "last recorded at" from before it was dropped; it also shouldn't matter
  // either way since shouldRecordSample rejects uncovered points outright regardless of this map,
  // but clearing it keeps the two caches from silently drifting apart over long uptimes.
  for (const pointId of lastRecordedAtMs.keys()) {
    if (!nextCovered.has(pointId)) lastRecordedAtMs.delete(pointId);
  }
}

/**
 * Starts the periodic background refresh of the historian config cache. Call once at startup —
 * idempotent: a second call is a no-op rather than stacking a duplicate timer (guards against
 * `runtime.service.initialize()` accidentally running twice in one process, e.g. a dev
 * hot-reload or a test importing it more than once). Pass `{ restart: true }` to force a new
 * timer (e.g. to change the period), which the app never needs to do today.
 */
function startIntervalCacheRefresh(periodMs = 300000, { restart = false } = {}) {
  if (configCacheTimer && !restart) return configCacheTimer;
  refreshHistorianConfig().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[historian] initial config cache load failed:', e?.message || e);
  });
  if (configCacheTimer) clearInterval(configCacheTimer);
  configCacheTimer = setInterval(() => {
    refreshHistorianConfig().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[historian] config cache refresh failed:', e?.message || e);
    });
  }, periodMs);
  return configCacheTimer;
}

/** @param {string} pointId */
function isPointCovered(pointId) {
  return coveredPointIds.has(String(pointId));
}

/**
 * Synchronous gate deciding whether `pointId` should get a new historian row at `timestampMs`.
 * Rejects outright if the point has no enabled trend assignment (requirement: a point earns
 * samples only by being covered — SIM/manual writes to an unassigned point never reach the
 * historian table at all). When covered, never awaits anything, so the read-then-write of
 * `lastRecordedAtMs` for a given point cannot be interleaved by another call — this is what
 * prevents the SIM poll loop and a manual point update from both recording a sample for the same
 * point inside the same interval window.
 * @param {string} pointId
 * @param {number} timestampMs
 * @returns {boolean}
 */
function shouldRecordSample(pointId, timestampMs) {
  if (!coveredPointIds.has(pointId)) return false;
  // Every qualifying trend contributes a normalized (never null/invalid) interval in
  // refreshHistorianConfig, so a covered point always has an entry here; the default is a
  // defensive fallback only, never "record every write" — a missing/invalid interval must not
  // cause per-poll writes.
  const minMs = intervalMsByPoint.get(pointId) ?? DEFAULT_SAMPLE_INTERVAL_SECONDS * 1000;
  const last = lastRecordedAtMs.get(pointId);
  if (last == null || timestampMs - last >= minMs) {
    lastRecordedAtMs.set(pointId, timestampMs);
    return true;
  }
  return false;
}

// --------------------------------------------------------------------------------------------
// Retention cleanup (retentionDays)
//
// Runs on its own long-period timer, never inside a per-point-update code path. Reuses the same
// config snapshot `refreshHistorianConfig()` builds (retentionDaysByPoint), so retention can never
// disagree with what coverage/interval say about the same point. Points with a longer-than-default
// window get their own indexed range delete; every other point (covered or not — an unassigned
// point's history isn't deleted just because it was unassigned) uses the schema default.
// --------------------------------------------------------------------------------------------

let retentionSweepTimer = null;

async function runRetentionCleanup() {
  /** @type {Map<number, string[]>} */
  const buckets = new Map();
  for (const [pointId, days] of retentionDaysByPoint.entries()) {
    if (days === DEFAULT_RETENTION_DAYS) continue; // no custom window -> falls into the default sweep below
    if (!buckets.has(days)) buckets.set(days, []);
    buckets.get(days).push(pointId);
  }
  const customPointIds = Array.from(retentionDaysByPoint.keys()).filter((id) => retentionDaysByPoint.get(id) !== DEFAULT_RETENTION_DAYS);

  const now = Date.now();
  let deleted = 0;
  for (const [days, ids] of buckets.entries()) {
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
    const result = await prisma.pointHistorySample.deleteMany({
      where: { pointId: { in: ids }, timestamp: { lt: cutoff } },
    });
    deleted += result.count;
  }

  const defaultCutoff = new Date(now - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const defaultResult = await prisma.pointHistorySample.deleteMany({
    where: {
      timestamp: { lt: defaultCutoff },
      ...(customPointIds.length ? { pointId: { notIn: customPointIds } } : {}),
    },
  });
  deleted += defaultResult.count;
  return { deleted };
}

/**
 * Starts the periodic retention sweep. Call once at startup. Default period: 6 hours — retention
 * is a days-scale concern, so this must never run on every point update or every poll tick.
 * Idempotent like {@link startIntervalCacheRefresh}: a second call is a no-op unless
 * `{ restart: true }` is passed, so an accidental double-`initialize()` in one process (dev
 * reload, a test re-importing the module) cannot stack duplicate sweep timers.
 */
function startRetentionSweep(periodMs = 6 * 60 * 60 * 1000, { restart = false } = {}) {
  if (retentionSweepTimer && !restart) return retentionSweepTimer;
  const run = () => runRetentionCleanup().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[historian] retention cleanup failed:', e?.message || e);
  });
  run();
  if (retentionSweepTimer) clearInterval(retentionSweepTimer);
  retentionSweepTimer = setInterval(run, periodMs);
  return retentionSweepTimer;
}

// --------------------------------------------------------------------------------------------
// Read-path decimation
//
// PointHistorySample is queried with an indexed range scan (pointId + timestamp) bounded by the
// retention window the sweep above enforces, so the DB read itself stays bounded. This caps the
// RESPONSE size / frontend rendering cost for long ranges (7d/30d at a fast poll rate can still
// produce tens of thousands of real rows per point): a real, already-recorded sample is kept every
// Nth row, and the most recent sample is always kept so "now" is never stale. This is decimation,
// not aggregation or fabrication — no value is invented or averaged.
// --------------------------------------------------------------------------------------------

const MAX_SAMPLES_PER_POINT = 1500;

/**
 * @param {Array<{ timestamp: string, value: string|null, quality: string }>} rows - ascending by timestamp
 * @param {number} [maxSamples]
 */
function decimateSamples(rows, maxSamples = MAX_SAMPLES_PER_POINT) {
  if (!Array.isArray(rows) || rows.length <= maxSamples) return rows || [];
  const stride = Math.ceil(rows.length / maxSamples);
  const out = [];
  for (let i = 0; i < rows.length; i += stride) out.push(rows[i]);
  const last = rows[rows.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

module.exports = {
  QUALITY,
  normalizeQuality,
  recordSample,
  sampleTransactionOps,
  windowMsForRange,
  RANGE_WINDOWS_MS,
  shouldRecordSample,
  startIntervalCacheRefresh,
  refreshHistorianConfig,
  isPointCovered,
  startRetentionSweep,
  runRetentionCleanup,
  decimateSamples,
  MAX_SAMPLES_PER_POINT,
  DEFAULT_RETENTION_DAYS,
  normalizeSampleIntervalSeconds,
  DEFAULT_SAMPLE_INTERVAL_SECONDS,
  MIN_SAMPLE_INTERVAL_SECONDS,
};
