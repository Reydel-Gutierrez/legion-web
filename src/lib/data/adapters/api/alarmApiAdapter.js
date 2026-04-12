/**
 * Operator alarm definitions and events (Phase 1) — Legion API.
 */

import { apiFetch } from "../../../api/apiClient";

function fmtTs(d) {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function severityToUi(s) {
  if (!s) return "Minor";
  const u = String(s).toUpperCase();
  const map = { CRITICAL: "Critical", MAJOR: "Major", MINOR: "Minor", WARNING: "Warning" };
  return map[u] || s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Map API alarm event + definition to AlarmsPage row shape (Alarm contract).
 * @param {object} ev
 * @returns {import("../../contracts").Alarm & { value?: string }}
 */
export function mapAlarmEventToAlarmRow(ev) {
  const def = ev.definition || {};
  const pt = def.point || {};
  const eq = def.equipment || {};
  const pointLabel =
    [pt.pointCode, pt.pointName].filter(Boolean).join(" — ") ||
    (def.pointKey ? String(def.pointKey) : "Point");
  const definitionBinding = def.pointId ? "Bound / Ready" : "Pending Binding";
  const state = ev.state === "ACTIVE" ? "Active" : "History";
  const occurredAt = fmtTs(ev.occurredAt);
  const clearedAt = ev.clearedAt ? fmtTs(ev.clearedAt) : null;
  const durationMin =
    typeof ev.durationSeconds === "number" && ev.durationSeconds > 0
      ? Math.round(ev.durationSeconds / 60)
      : null;
  const valueStr =
    ev.state === "ACTIVE"
      ? ev.activeValue != null
        ? String(ev.activeValue)
        : ""
      : ev.clearValue != null
        ? String(ev.clearValue)
        : ev.activeValue != null
          ? String(ev.activeValue)
          : "";

  return {
    id: ev.id,
    siteId: ev.siteId,
    equipmentName: eq.name || "Equipment",
    equipmentType: eq.equipmentType || "",
    point: pointLabel,
    message: ev.message || def.name || "Alarm",
    severity: severityToUi(def.severity),
    state,
    ack: !!ev.ack,
    value: valueStr,
    occurredAt,
    clearedAt,
    durationMin,
    definitionBinding,
  };
}

export async function listAlarmDefinitions(siteId, query = {}) {
  const q = new URLSearchParams();
  if (query.equipmentId) q.set("equipmentId", String(query.equipmentId));
  if (query.pointId) q.set("pointId", String(query.pointId));
  if (query.pointKey) q.set("pointKey", String(query.pointKey));
  const qs = q.toString();
  const path = `/api/sites/${encodeURIComponent(siteId)}/alarm-definitions${qs ? `?${qs}` : ""}`;
  return apiFetch(path);
}

export async function createAlarmDefinition(siteId, body) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/alarm-definitions`, {
    method: "POST",
    body,
  });
}

export async function updateAlarmDefinition(siteId, definitionId, body) {
  return apiFetch(
    `/api/sites/${encodeURIComponent(siteId)}/alarm-definitions/${encodeURIComponent(definitionId)}`,
    { method: "PATCH", body }
  );
}

export async function deleteAlarmDefinition(siteId, definitionId) {
  return apiFetch(
    `/api/sites/${encodeURIComponent(siteId)}/alarm-definitions/${encodeURIComponent(definitionId)}`,
    { method: "DELETE" }
  );
}

export async function listAlarmEvents(siteId, query = {}) {
  const q = new URLSearchParams();
  if (query.state) q.set("state", String(query.state));
  if (query.equipmentId) q.set("equipmentId", String(query.equipmentId));
  const qs = q.toString();
  const path = `/api/sites/${encodeURIComponent(siteId)}/alarm-events${qs ? `?${qs}` : ""}`;
  return apiFetch(path);
}

export async function acknowledgeAlarmEvent(siteId, eventId) {
  return apiFetch(
    `/api/sites/${encodeURIComponent(siteId)}/alarm-events/${encodeURIComponent(eventId)}/ack`,
    { method: "PATCH", body: {} }
  );
}

export async function triggerAlarmEvaluate(siteId, pointIds) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/alarm-evaluate`, {
    method: "POST",
    body: { pointIds: pointIds || [] },
  });
}
