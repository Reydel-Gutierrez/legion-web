/**
 * Classify an operator workspace row for the Points Overview filters.
 * @param {import("../data/contracts").WorkspaceRow} row
 * @returns {"analog"|"binary"|"multistate"}
 */
export function classifyOperatorPointKind(row) {
  if (!row) return "analog";
  const ct = String(row.commandType || "").toLowerCase();
  if (ct === "boolean") return "binary";
  if (ct === "enum") return "multistate";
  if (ct === "numeric" || ct === "percentage") return "analog";

  const et = String(row.expectedType || "").trim().toUpperCase();
  if (et) {
    if (/^(BI|BV|BO|BIT|MSB)/.test(et)) return "binary";
    if (/^(MSV|MV|ENUM|STATE|MULTI)/.test(et)) return "multistate";
    if (/^(AI|AO|AV|MI|MO|NUM|REAL|FLOAT|INT|UINT|DOUBLE|ANALOG)/.test(et)) return "analog";
  }

  const v = row.value;
  if (v === true || v === false) return "binary";
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "on" || s === "off" || s === "true" || s === "false" || s === "active" || s === "inactive") {
      return "binary";
    }
  }
  return "analog";
}

export function pointStatusLabel(row, displayValue, oosLabel, alarmLabel) {
  if (displayValue === oosLabel) return "Out of service";
  if (alarmLabel) return alarmLabel;
  const freshness = row?.commFreshnessStatus;
  if (freshness === "LIVE") return "Normal";
  if (freshness === "STALE") return "Stale";
  if (freshness === "OFFLINE") return "Offline";
  const st = String(row?.status || "").toUpperCase();
  if (st === "OK" || st === "NORMAL" || st === "ONLINE") return "Normal";
  if (st === "PENDING") return "Pending";
  if (st === "UNBOUND") return "Unbound";
  if (st === "OFFLINE") return "Offline";
  if (st) return row.status;
  return "Unknown";
}
