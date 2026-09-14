import { classifyOperatorPointKind } from "../../../lib/operator/pointKind";
import { getEquipmentStatus } from "../../../lib/operator/statusUtils";

function identities(point) {
  return [point.pointKey, point.pointId, point.id, point.databasePointId].filter((id) => id != null).map(String);
}

/**
 * Parse a persisted raw sample string into a plottable numeric value for the given point kind.
 * Binary points map to 0/1 (step-line presentation, never linear-interpolated as if the value
 * moved continuously between states). A value this function cannot interpret returns null,
 * which the chart treats as "no data" rather than a fabricated number.
 */
function parsePointValue(raw, kind) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (kind === "binary") {
    const lower = s.toLowerCase();
    if (["true", "1", "on", "active"].includes(lower)) return 1;
    if (["false", "0", "off", "inactive"].includes(lower)) return 0;
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve which of this trend's configured points exist on the current equipment, mapping each
 * to the real Point.id the historian is keyed by (never a hardcoded/logical key). Reused by both
 * "local save" definitions (configured by logical pointKey, resolved via identity match on the
 * equipment's own live points) and template-assigned definitions (configured via
 * `assignment.resolvedMappings`, a logical-key -> real Point.id map).
 * @returns {Array<{ dbPointId: string, pointKey: string|null, name: string, kind: string, unit: string }>}
 */
export function resolveTrendSeriesTargets(selectedTrend, livePoints) {
  if (!selectedTrend) return [];
  const configured = new Set((selectedTrend.definition?.pointIds || []).map(String));
  const mappings = selectedTrend.assignment?.resolvedMappings || {};
  for (const key of Array.from(configured)) {
    if (typeof mappings[key] === "string") configured.add(mappings[key]);
  }
  const belongs = (point) => identities(point).some((id) => configured.has(id));

  const seen = new Set();
  const targets = [];
  for (const point of livePoints || []) {
    if (!belongs(point)) continue;
    const dbPointId = point.databasePointId || point.pointId || point.id;
    if (!dbPointId) continue;
    const key = String(dbPointId);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      dbPointId: key,
      pointKey: point.pointKey != null ? String(point.pointKey) : null,
      name: point.pointDescription || point.pointName || point.label || point.pointKey || key,
      kind: classifyOperatorPointKind(point),
      unit: point.unit || point.units || "",
    });
  }
  return targets;
}

/**
 * Build the Recharts-ready trend model directly from persisted historian samples. This is the
 * only place trend chart data is assembled — there is no fallback path that fabricates a value,
 * backfills a gap, or anchors the series to the current live reading (LC-ARCH-001 D-010).
 *
 * @param {Array<{ dbPointId: string, pointKey: string|null, name: string, kind: string, unit: string }>} seriesTargets
 * @param {Record<string, Array<{ timestamp: string, value: string|null, quality: string }>>} samplesByDbPointId
 * @param {number} now
 * @param {{ pollRateMs?: number }} [options]
 */
export function buildEquipmentTrendChart(seriesTargets, samplesByDbPointId, now, options = {}) {
  const pollRateMs = options.pollRateMs;
  const targets = seriesTargets || [];

  const series = targets.map((target) => {
    const raw = (samplesByDbPointId && samplesByDbPointId[target.dbPointId]) || [];
    const points = raw
      .map((sample) => ({
        t: new Date(sample.timestamp).getTime(),
        value: parsePointValue(sample.value, target.kind),
        quality: sample.quality,
      }))
      .filter((sample) => Number.isFinite(sample.t))
      .sort((a, b) => a.t - b.t);
    const last = points.length ? points[points.length - 1] : null;
    // The runtime reconciler writes an explicit OFFLINE marker (value: null) the instant it
    // confirms a point unreachable — when that marker is the most recent row, it is an
    // authoritative "communication lost here" signal, not a guess from sample age. Fall back to
    // the age-based LIVE/STALE/OFFLINE heuristic only when the last row is a normal reading.
    const lastIsOfflineMarker = Boolean(last && last.quality === "OFFLINE" && last.value == null);
    const commStatus = lastIsOfflineMarker
      ? "OFFLINE"
      : last
        ? getEquipmentStatus({ lastSeenAt: new Date(last.t).toISOString(), pollRateMs, now })
        : "OFFLINE";
    // "Last valid update" must stay the last real reading, not an OFFLINE marker's null value —
    // the marker still moves `commStatus` and `lossTimestamp`, but never overwrites the value the
    // legend/tooltip should keep showing while communication is down.
    let lastValidPoint = null;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i].value != null) { lastValidPoint = points[i]; break; }
    }
    return {
      ...target,
      points,
      valueByT: new Map(points.map((p) => [p.t, p.value])),
      qualityByT: new Map(points.map((p) => [p.t, p.quality])),
      lastValue: lastValidPoint ? lastValidPoint.value : null,
      lastTimestamp: lastValidPoint ? lastValidPoint.t : null,
      lossTimestamp: lastIsOfflineMarker ? last.t : null,
      commStatus,
    };
  });

  const hasAnyData = series.some((item) => item.points.length > 0);

  // A gap between two consecutive real samples that is much larger than normal cadence means
  // communication was lost for that interval. Represent it as a line break (null sample), not a
  // straight interpolated segment implying continuous, unrecorded data.
  const gapThresholdMs = Math.max(3 * (pollRateMs || 20000), 90000);
  const timestampSet = new Set();
  const breaks = series.map(() => new Set());
  series.forEach((item, index) => {
    item.points.forEach((p) => timestampSet.add(p.t));
    for (let i = 1; i < item.points.length; i += 1) {
      const prev = item.points[i - 1];
      const next = item.points[i];
      if (next.t - prev.t > gapThresholdMs) {
        const breakT = prev.t + 1;
        timestampSet.add(breakT);
        breaks[index].add(breakT);
      }
    }
  });

  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);
  const chart = timestamps.map((t) => {
    const row = { timestamp: t };
    series.forEach((item, index) => {
      if (item.valueByT.has(t)) {
        row[`s${index}`] = item.valueByT.get(t);
      } else if (breaks[index].has(t)) {
        row[`s${index}`] = null;
      }
      // Otherwise leave the key entirely unset: no sample exists at this time for this series,
      // which is different from a known null and must not be drawn as a value of zero.
    });
    return row;
  });

  let yDomain = null;
  const numericValues = [];
  series.forEach((item) => {
    item.points.forEach((p) => {
      if (typeof p.value === "number") numericValues.push(p.value);
    });
  });
  if (numericValues.length) {
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const pad = Math.max((max - min) * 0.1, max === min ? Math.abs(max || 1) * 0.1 || 1 : 0);
    yDomain = [min - pad, max + pad];
  }

  return {
    hasAnyData,
    series,
    chart,
    yDomain,
    timestamps,
  };
}
