import { apiFetch } from "../../../api/apiClient";

/**
 * Real historian read path (LC-ARCH-001 D-010): loads persisted point samples for the operator
 * trend chart. Never fabricates data — a point with nothing recorded in the window simply comes
 * back with an empty array.
 *
 * @param {string[]} pointIds - actual Prisma Point.id values (not logical/template point keys)
 * @param {string} range - one of "1h" | "24h" | "7d" | "30d"
 * @returns {Promise<Record<string, Array<{ timestamp: string, value: string|null, quality: string }>>>}
 */
export async function fetchPointHistory(pointIds, range) {
  const ids = Array.from(new Set((pointIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (ids.length === 0) return {};
  const query = new URLSearchParams({ ids: ids.join(","), range: String(range || "1h") });
  const result = await apiFetch(`/api/points/history?${query.toString()}`, {
    activity: { logApi: false },
  });
  return (result && result.samples) || {};
}
