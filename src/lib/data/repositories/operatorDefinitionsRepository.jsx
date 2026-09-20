import { apiFetch } from "../../api/apiClient";
import { coerceSiteKeyToApiId } from "../siteApiResolution";
import { isBackendSiteId } from "../siteIdUtils";

async function basePath(siteKey, kind) {
  const siteId = isBackendSiteId(siteKey) ? siteKey : coerceSiteKeyToApiId(siteKey, await apiFetch("/api/sites"));
  if (!siteId) throw new Error("Select a saved site before configuring trends or schedules.");
  return `/api/operator/${encodeURIComponent(siteId)}/${kind}/definitions`;
}

export async function listDefinitions(siteKey, kind) {
  return (await apiFetch(await basePath(siteKey, kind))).data;
}

export async function saveDefinition(siteKey, kind, definition) {
  const base = await basePath(siteKey, kind);
  return (await apiFetch(definition.id ? `${base}/${encodeURIComponent(definition.id)}` : base, {
    method: definition.id ? "PATCH" : "POST", body: definition,
  })).data;
}

export async function assignDefinition(siteKey, kind, id, equipmentIds, resolvedMappings = {}) {
  return (await apiFetch(`${await basePath(siteKey, kind)}/${encodeURIComponent(id)}/assign`, {
    method: "POST", body: { equipmentIds, resolvedMappings },
  })).data;
}

export async function deleteDefinition(siteKey, kind, id) {
  return apiFetch(`${await basePath(siteKey, kind)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchTrendStore(siteKey) {
  const rows = await listDefinitions(siteKey, "trend");
  return {
    definitions: rows.map((row) => ({ ...row, pointIds: row.pointRequirements.map((point) => point.pointKey), pointRequirements: row.pointRequirements })),
    assignments: rows.flatMap((row) => row.assignments.map((assignment) => ({ ...assignment, assetId: assignment.equipmentId, trendDefinitionId: row.id, loggingEnabled: assignment.enabled }))),
    trendHistory: {},
  };
}

export async function fetchSchedules(siteKey) {
  const rows = await listDefinitions(siteKey, "schedule");
  return rows.flatMap((row) => row.assignments.flatMap((assignment) => row.weeklyWindows.map((window, index) => ({
    ...window, id: `${assignment.id}:${index}`, definitionId: row.id, name: row.name,
    equipmentId: assignment.equipmentId, enabled: row.enabled && assignment.enabled,
  }))));
}
