import { formatAxisTimeLabel, pickAxisTickIndices } from "./trendChartUtils";

/**
 * Parses labels from fmtExact: "m/d/yy HH:mm"
 * @param {string} label
 * @returns {Date | null}
 */
export function parseTrendLabelToDate(label) {
  const m = /^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/.exec(String(label || "").trim());
  if (!m) return null;
  const mo = parseInt(m[1], 10);
  const da = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy += 2000;
  const hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  return new Date(yy, mo - 1, da, hh, mm, 0, 0);
}

function hourKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

/** Local calendar day + 4-hour slot (0,4,8,12,16,20). */
function fourHourSlotKey(d) {
  const slot = Math.floor(d.getHours() / 4);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${slot}`;
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * @param {string} range
 * @returns {"hour" | "fourHour" | "day" | "twoDay"}
 */
export function getTrendAxisTickMode(range) {
  const r = String(range || "").trim();
  if (r === "6H") return "hour";
  if (r === "24H" || r === "1D") return "fourHour";
  if (r === "7D") return "day";
  if (r === "14D") return "twoDay";
  const m = /^(\d+)D$/.exec(r);
  if (m) {
    const d = parseInt(m[1], 10);
    if (d <= 1) return "fourHour";
    if (d < 14) return "day";
    return "twoDay";
  }
  return "fourHour";
}

/**
 * @param {string[]} timeLabels
 * @param {unknown[]|undefined} timestamps
 * @returns {Date[] | null}
 */
function resolveDates(timeLabels, timestamps) {
  const n = timeLabels.length;
  if (n < 2) return null;
  const out = [];
  if (timestamps && timestamps.length === n) {
    for (let i = 0; i < n; i++) {
      const t = timestamps[i];
      const d = t instanceof Date ? t : new Date(t);
      if (Number.isNaN(d.getTime())) return null;
      out.push(d);
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const d = parseTrendLabelToDate(timeLabels[i]);
    if (!d) return null;
    out.push(d);
  }
  return out;
}

function pushFirstOfKeyChange(dates, keyFn) {
  const n = dates.length;
  const ticks = [0];
  let lastKey = keyFn(dates[0]);
  for (let i = 1; i < n; i++) {
    const k = keyFn(dates[i]);
    if (k !== lastKey) {
      ticks.push(i);
      lastKey = k;
    }
  }
  if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);
  return ticks;
}

function pushTwoDayBucketsFromStart(dates) {
  const n = dates.length;
  const t0 = dates[0].getTime();
  const spanMs = 2 * 24 * 60 * 60 * 1000;
  const ticks = [0];
  let lastB = Math.floor((dates[0].getTime() - t0) / spanMs);
  for (let i = 1; i < n; i++) {
    const b = Math.floor((dates[i].getTime() - t0) / spanMs);
    if (b > lastB) {
      ticks.push(i);
      lastB = b;
    }
  }
  if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);
  return ticks;
}

/**
 * Indices for Recharts XAxis `ticks` (dataKey `idx`).
 * @param {string} range
 * @param {string[]} timeLabels
 * @param {unknown[]|undefined} timestamps
 * @returns {number[]}
 */
export function getTrendXAxisTickIndices(range, timeLabels, timestamps) {
  const n = timeLabels.length;
  if (n < 2) return [0];
  const dates = resolveDates(timeLabels, timestamps);
  if (!dates) return [...new Set([0, ...pickAxisTickIndices(n, 8), n - 1])].sort((a, b) => a - b);

  const mode = getTrendAxisTickMode(range);
  if (mode === "hour") return pushFirstOfKeyChange(dates, hourKey);
  if (mode === "fourHour") return pushFirstOfKeyChange(dates, fourHourSlotKey);
  if (mode === "day") return pushFirstOfKeyChange(dates, dayKey);
  return pushTwoDayBucketsFromStart(dates);
}

/**
 * @param {string} range
 * @param {string} label
 */
export function formatTrendXAxisTickLabel(range, label) {
  if (!label || typeof label !== "string") return "—";
  const mode = getTrendAxisTickMode(range);
  if (mode === "day" || mode === "twoDay") {
    const parts = label.trim().split(/\s+/);
    return parts[0] || label;
  }
  return formatAxisTimeLabel(label);
}
