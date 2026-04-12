/**
 * Workspace bulk-alarm compatibility: same logical point key (best) or same alarm "shape"
 * (numeric threshold vs binary vs enum) derived from template / row metadata.
 */

/** @param {import("../../../lib/data/contracts").WorkspaceRow} row */
export function getWorkspaceRowLogicalPointKey(row) {
  if (!row) return "";
  return String(row.pointKey || row.pointId || "").trim().toLowerCase();
}

/**
 * Coarse alarm shape for compatibility across different equipment instances.
 * @param {import("../../../lib/data/contracts").WorkspaceRow} row
 * @returns {'binary'|'enum'|'numeric'|'unknown'}
 */
export function getWorkspaceRowAlarmShape(row) {
  if (!row) return "unknown";
  const ct = String(row.commandType || "none").toLowerCase();
  if (ct === "boolean") return "binary";
  if (ct === "enum") return "enum";
  if (ct === "numeric" || ct === "percentage") return "numeric";

  const et = String(row.expectedType || "").trim().toUpperCase();
  if (et) {
    if (/^(BI|BV|BO|BIT|MSB)/.test(et)) return "binary";
    if (/^(MSV|MV|ENUM|STATE|MULTI)/.test(et)) return "enum";
    if (/^(AI|AO|AV|MI|MO|MV|NUM|REAL|FLOAT|INT|UINT|DOUBLE|ANALOG)/.test(et)) return "numeric";
  }
  return "unknown";
}

/**
 * @param {import("../../../lib/data/contracts").WorkspaceRow[]} selectedRows
 */
export function areRowsAlarmCompatible(selectedRows) {
  if (!selectedRows?.length) return false;
  if (selectedRows.some((r) => !getWorkspaceRowLogicalPointKey(r))) return false;
  if (selectedRows.length === 1) return true;

  const keys = selectedRows.map(getWorkspaceRowLogicalPointKey).filter(Boolean);
  if (keys.length === selectedRows.length && new Set(keys).size === 1) return true;

  const shapes = selectedRows.map(getWorkspaceRowAlarmShape);
  const uniqueShapes = new Set(shapes);
  if (uniqueShapes.size !== 1) return false;
  const shape = shapes[0];
  if (shape === "unknown") return false;
  return true;
}

export const BULK_ALARM_INCOMPATIBLE_MESSAGE =
  "Bulk alarm setup requires points with the same alarm shape (same logical point or compatible data type/object type).";
