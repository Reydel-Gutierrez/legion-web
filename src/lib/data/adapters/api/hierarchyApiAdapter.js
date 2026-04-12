/**
 * API adapter for Phase 1 hierarchy (sites → buildings → floors → equipment → points).
 * Maps backend payloads to stable frontend-friendly shapes used by repositories.
 */

import { apiFetch } from "../../../api/apiClient";

function mapEntityStatus(raw) {
  const s = (raw || "").toString().toUpperCase();
  if (s === "INACTIVE" || s === "ARCHIVED") return s.toLowerCase();
  return "active";
}

function mapBuildingLayoutStatus(raw) {
  const s = mapEntityStatus(raw);
  if (s === "inactive" || s === "archived") return "warning";
  return "normal";
}

function mapEquipmentEngineeringStatus(raw) {
  const s = (raw || "").toString().toUpperCase();
  // API Equipment.status is EntityStatus (row active), not "BACnet controller assigned".
  if (s === "ACTIVE") return "MISSING_CONTROLLER";
  if (s === "INACTIVE") return "DRAFT";
  if (s === "ARCHIVED") return "DRAFT";
  return "DRAFT";
}

/** @returns {import("../../contracts").Site} */
export function normalizeSite(api) {
  if (!api) return null;
  return {
    id: api.id,
    name: api.name,
    timezone: api.timezone ?? undefined,
    description: api.description != null ? String(api.description) : "",
    status: api.status === "ACTIVE" ? "Active" : api.status || "Active",
    createdByUser: api.createdByUser ?? null,
  };
}

export function normalizeBuilding(api) {
  if (!api) return null;
  return {
    id: api.id,
    siteId: api.siteId,
    name: api.name,
    addressLine1: api.addressLine1,
    addressLine2: api.addressLine2 ?? null,
    city: api.city,
    state: api.state,
    postalCode: api.postalCode,
    country: api.country,
    latitude: api.latitude,
    longitude: api.longitude,
    status: api.status,
    layoutStatus: mapBuildingLayoutStatus(api.status),
    buildingType: api.buildingType ?? "",
    buildingCode: api.buildingCode ?? "",
    description: api.description != null ? String(api.description) : "",
    sortOrder: api.sortOrder ?? 0,
  };
}

export function normalizeFloor(api) {
  if (!api) return null;
  return {
    id: api.id,
    buildingId: api.buildingId,
    name: api.name,
    status: api.status,
    floorType: api.floorType ?? "",
    occupancyType: api.occupancyType ?? "",
    sortOrder: api.sortOrder ?? 0,
  };
}

export function normalizeEquipment(api) {
  if (!api) return null;
  return {
    id: api.id,
    siteId: api.siteId,
    buildingId: api.buildingId,
    floorId: api.floorId,
    name: api.name,
    code: api.code,
    equipmentType: api.equipmentType,
    templateName: api.templateName ?? null,
    address: api.address ?? null,
    instanceNumber: api.instanceNumber ?? null,
    status: api.status,
    engineeringStatus: mapEquipmentEngineeringStatus(api.status),
  };
}

export function normalizePoint(api) {
  if (!api) return null;
  return {
    id: api.id,
    equipmentId: api.equipmentId,
    siteId: api.siteId,
    buildingId: api.buildingId,
    floorId: api.floorId,
    pointName: api.pointName,
    pointCode: api.pointCode,
    pointType: api.pointType,
    unit: api.unit,
    writable: api.writable !== false,
    presentValue: api.presentValue,
    status: api.status,
    lastSeenAt: api.lastSeenAt != null ? String(api.lastSeenAt) : null,
    commState: api.commState != null ? String(api.commState) : null,
  };
}

function parsePresentValueRawForWorkspace(presentValue) {
  if (presentValue === null || presentValue === undefined || presentValue === "") return null;
  if (typeof presentValue === "boolean") return presentValue;
  if (typeof presentValue === "number" && !Number.isNaN(presentValue)) return presentValue;
  const s = String(presentValue).trim();
  if (s === "") return null;
  const lower = s.toLowerCase();
  if (lower === "true" || lower === "on" || lower === "active") return true;
  if (lower === "false" || lower === "off" || lower === "inactive") return false;
  if (s === "1") return true;
  if (s === "0") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return presentValue;
}

export function pointToWorkspaceRow(equipmentId, equipmentName, pt) {
  const p = normalizePoint(pt);
  if (!p) return null;
  const units = p.unit || "";
  const val = p.presentValue != null && p.presentValue !== "" ? String(p.presentValue) : "—";
  const valueStr = units ? `${val} ${units}`.trim() : val;
  const pointKey = (p.pointCode != null && String(p.pointCode).trim() !== "" ? String(p.pointCode).trim() : String(p.id));
  const pointDescription = (p.pointName != null && String(p.pointName).trim() !== "" ? String(p.pointName).trim() : "");
  const presentValueRaw =
    p.presentValue != null && p.presentValue !== "" ? parsePresentValueRawForWorkspace(p.presentValue) : null;
  return {
    id: `${equipmentId}-${p.pointCode || p.id}`,
    databasePointId: p.id,
    equipmentId,
    equipmentName,
    pointId: p.pointCode || p.id,
    pointKey,
    pointDescription,
    pointName: pointDescription || pointKey,
    pointReferenceId: p.pointCode || p.id,
    value: valueStr,
    units,
    status: mapEntityStatus(p.status) === "active" ? "OK" : "Warn",
    writable: p.writable,
    presentValueRaw,
  };
}

// --- Sites

export async function listSites() {
  const raw = await apiFetch("/api/sites");
  const rows = Array.isArray(raw) ? raw : raw?.sites ?? raw?.data ?? [];
  return Array.isArray(rows) ? rows.map(normalizeSite).filter(Boolean) : [];
}

export async function getSiteById(siteId) {
  const raw = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}`);
  return normalizeSite(raw);
}

export async function createSite(payload) {
  const raw = await apiFetch("/api/sites", {
    method: "POST",
    body: payload,
  });
  return normalizeSite(raw);
}

export async function updateSite(siteId, payload) {
  const raw = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeSite(raw);
}

// --- Buildings

export async function listBuildingsBySite(siteId) {
  const rows = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}/buildings`);
  return Array.isArray(rows) ? rows.map(normalizeBuilding).filter(Boolean) : [];
}

export async function getBuildingById(buildingId) {
  const raw = await apiFetch(`/api/buildings/${encodeURIComponent(buildingId)}`);
  return normalizeBuilding(raw);
}

export async function createBuilding(siteId, payload) {
  const raw = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}/buildings`, {
    method: "POST",
    body: payload,
  });
  return normalizeBuilding(raw);
}

export async function updateBuilding(buildingId, payload) {
  const raw = await apiFetch(`/api/buildings/${encodeURIComponent(buildingId)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeBuilding(raw);
}

export async function deleteBuilding(buildingId) {
  await apiFetch(`/api/buildings/${encodeURIComponent(buildingId)}`, {
    method: "DELETE",
  });
}

// --- Floors

export async function listFloorsByBuilding(buildingId) {
  const rows = await apiFetch(`/api/buildings/${encodeURIComponent(buildingId)}/floors`);
  return Array.isArray(rows) ? rows.map(normalizeFloor).filter(Boolean) : [];
}

export async function createFloor(buildingId, payload) {
  const raw = await apiFetch(`/api/buildings/${encodeURIComponent(buildingId)}/floors`, {
    method: "POST",
    body: payload,
  });
  return normalizeFloor(raw);
}

export async function updateFloor(floorId, payload) {
  const raw = await apiFetch(`/api/floors/${encodeURIComponent(floorId)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeFloor(raw);
}

export async function deleteFloor(floorId) {
  await apiFetch(`/api/floors/${encodeURIComponent(floorId)}`, {
    method: "DELETE",
  });
}

// --- Equipment

/** Flat list of equipment on a site (buildings/floors included for labels). */
export async function listEquipmentBySite(siteId) {
  const rows = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}/equipment`);
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const base = normalizeEquipment(r);
    if (!base) return null;
    return {
      ...base,
      buildingName: r.building?.name ?? "",
      floorName: r.floor?.name ?? "",
      pointsCount: r._count?.points,
    };
  }).filter(Boolean);
}

export async function listEquipmentByFloor(floorId) {
  const rows = await apiFetch(`/api/floors/${encodeURIComponent(floorId)}/equipment`);
  return Array.isArray(rows) ? rows.map(normalizeEquipment).filter(Boolean) : [];
}

export async function createEquipment(floorId, payload) {
  const raw = await apiFetch(`/api/floors/${encodeURIComponent(floorId)}/equipment`, {
    method: "POST",
    body: payload,
  });
  return normalizeEquipment(raw);
}

export async function updateEquipment(equipmentId, payload) {
  const raw = await apiFetch(`/api/equipment/${encodeURIComponent(equipmentId)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeEquipment(raw);
}

export async function deleteEquipment(equipmentId) {
  await apiFetch(`/api/equipment/${encodeURIComponent(equipmentId)}`, {
    method: "DELETE",
  });
}

// --- Points

export async function listPointsByEquipment(equipmentId) {
  const raw = await apiFetch(`/api/equipment/${encodeURIComponent(equipmentId)}/points`);
  const rows = Array.isArray(raw) ? raw : raw?.points ?? raw?.data ?? [];
  return Array.isArray(rows) ? rows.map(normalizePoint).filter(Boolean) : [];
}

export async function createPoint(equipmentId, payload) {
  const raw = await apiFetch(`/api/equipment/${encodeURIComponent(equipmentId)}/points`, {
    method: "POST",
    body: payload,
  });
  return normalizePoint(raw);
}

export async function updatePoint(pointId, payload) {
  const raw = await apiFetch(`/api/points/${encodeURIComponent(pointId)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizePoint(raw);
}

// --- Site versions (working / active release / deploy)

export async function getWorkingVersion(siteId) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/working-version`);
}

export async function putWorkingVersion(siteId, body) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/working-version`, {
    method: "PUT",
    body: body ?? {},
  });
}

export async function getActiveRelease(siteId) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/active-release`);
}

export async function postDeploy(siteId, notes, options = {}) {
  const body = {};
  if (notes !== undefined && notes !== null && String(notes).length > 0) {
    body.notes = String(notes);
  }
  if (options.deployedBy != null && String(options.deployedBy).trim()) {
    body.deployedBy = String(options.deployedBy).trim();
  }
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/deploy`, {
    method: "POST",
    body: Object.keys(body).length > 0 ? body : {},
  });
}

export async function listSiteVersions(siteId) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/versions`);
}

/** @returns {Promise<object[]>} UserSiteAccess rows with user + role */
export async function listSiteUserAccess(siteId) {
  const raw = await apiFetch(`/api/sites/${encodeURIComponent(siteId)}/users`);
  return Array.isArray(raw) ? raw : [];
}

/** @returns {Promise<{ id: string, email: string, name: string|null }[]>} */
export async function listUsers() {
  const raw = await apiFetch("/api/users");
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .filter((u) => u && u.id)
    .map((u) => ({
      id: u.id,
      email: u.email != null ? String(u.email) : "",
      name: u.name != null ? String(u.name) : "",
    }));
}

/**
 * Grant or update site access (UserSiteAccess).
 * @param {string} siteId
 * @param {{ userId: string, roleId?: string, roleName?: string }} body roleName is Prisma Role.name e.g. site_admin, engineer
 */
export async function grantSiteUserAccess(siteId, body) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/users/access`, {
    method: "POST",
    body: body && typeof body === "object" ? body : {},
  });
}
