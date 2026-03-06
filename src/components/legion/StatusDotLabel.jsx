/**
 * Reusable status/severity indicator: dot + label (no badge backgrounds).
 * Use for: severity, status, ack, comm health across all Legion tables.
 *
 * Props:
 *   value (string) - raw value (e.g. "Critical", "Online", "Major")
 *   kind ("status" | "severity") - which mapping to use
 *   acked (boolean) - when provided, overrides value for ack mapping
 *   dotOnly (boolean) - when true, render only the dot, no label text
 *   className (string) - optional additional classes
 */
import React from "react";
import { getSeverityMap, getStatusMap, getAckMap, getAlarmStateMap } from "../../lib/utils/chipMap";

function getMap(value, kind, acked) {
  if (typeof acked === "boolean") return getAckMap(acked);
  if (kind === "severity") return getSeverityMap(value);
  if (kind === "alarmState") return getAlarmStateMap(value);
  return getStatusMap(value ?? "");
}

export default function StatusDotLabel({ value, kind = "status", acked, dotOnly = false, className = "" }) {
  const m = getMap(value, kind, acked);
  const dotMod = m.dotModifier || "legion-dot--neutral";

  return (
    <span className={`legion-dot-label ${className}`.trim()}>
      <span className={`legion-dot ${dotMod}`} />
      {!dotOnly && <span className="legion-dot-text">{m.label}</span>}
    </span>
  );
}
