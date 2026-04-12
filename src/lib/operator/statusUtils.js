/**
 * Single source of truth for operator equipment / point comm freshness (LIVE / STALE / OFFLINE).
 * Thresholds align with runtime poll cadence; values are always computed client-side (never persisted).
 */

/** Matches backend `runtime.store` default when poll rate is unknown. */
export const DEFAULT_OPERATOR_POLL_MS = 20000;

/**
 * @param {unknown} pollRateMs
 * @returns {number}
 */
export function normalizePollRateMs(pollRateMs) {
  const n = Number(pollRateMs);
  return pollRateMs != null && Number.isFinite(n) && n > 0 ? n : DEFAULT_OPERATOR_POLL_MS;
}

/**
 * @param {unknown} pollRateMs
 * @returns {number}
 */
export function getStaleThresholdMs(pollRateMs) {
  const poll = normalizePollRateMs(pollRateMs);
  return Math.max(15000, poll * 2);
}

/**
 * @param {unknown} pollRateMs
 * @returns {number}
 */
export function getOfflineThresholdMs(pollRateMs) {
  const poll = normalizePollRateMs(pollRateMs);
  return Math.max(90000, poll * 4);
}

/**
 * @param {{ lastSeenAt?: string | null, pollRateMs?: unknown, now?: number }} args
 * @returns {"LIVE"|"STALE"|"OFFLINE"}
 */
export function getEquipmentStatus({ lastSeenAt, pollRateMs, now }) {
  const n = now != null && Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (lastSeenAt == null || lastSeenAt === "") return "OFFLINE";
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return "OFFLINE";
  const deltaMs = n - t;
  if (deltaMs < 0) return "LIVE";

  const poll = normalizePollRateMs(pollRateMs);
  const staleThreshold = Math.max(15000, poll * 2);
  const offlineThreshold = Math.max(90000, poll * 4);

  if (deltaMs <= staleThreshold) return "LIVE";
  if (deltaMs <= offlineThreshold) return "STALE";
  return "OFFLINE";
}

/**
 * @param {"LIVE"|"STALE"|"OFFLINE"|string} status
 * @returns {string} CSS color
 */
export function getStatusColor(status) {
  if (status === "LIVE") return "#22c55e";
  if (status === "STALE") return "#c9a227";
  if (status === "OFFLINE") return "#ef4444";
  return "#9ca3af";
}

/**
 * Dot stack for {@link OperatorCommFreshnessLabel} (Bootstrap/Volt–aligned).
 * @param {"LIVE"|"STALE"|"OFFLINE"|string} status
 * @returns {string}
 */
export function getCommFreshnessDotClassName(status) {
  if (status === "LIVE") return "legion-dot legion-dot--comm-live legion-dot--comm-live-pulse";
  if (status === "STALE") return "legion-dot legion-dot--comm-stale";
  if (status === "OFFLINE") return "legion-dot legion-dot--red";
  return "legion-dot legion-dot--neutral";
}

/**
 * @param {string | null | undefined} lastSeenAt
 * @param {number} [now]
 * @returns {string}
 */
export function formatLastSeenSecondsAgo(lastSeenAt, now = Date.now()) {
  if (lastSeenAt == null || lastSeenAt === "") return "—";
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  return `${sec} sec ago`;
}
