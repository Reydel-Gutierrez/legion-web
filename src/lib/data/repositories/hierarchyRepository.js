/**
 * Hierarchy repository — async facade over hierarchyApiAdapter.
 * Used by operator/engineering when REACT_APP_API_BASE_URL is set.
 */

import * as api from "../adapters/api/hierarchyApiAdapter";
import { isHierarchyApiEnabled } from "../../api/apiConfig";

export { isHierarchyApiEnabled };

export async function listSites() {
  return api.listSites();
}

export async function getSiteById(siteId) {
  return api.getSiteById(siteId);
}

export async function createSite(payload) {
  return api.createSite(payload);
}

export async function updateSite(siteId, payload) {
  return api.updateSite(siteId, payload);
}

export async function listBuildingsBySite(siteId) {
  return api.listBuildingsBySite(siteId);
}

export async function getBuildingById(buildingId) {
  return api.getBuildingById(buildingId);
}

export async function createBuilding(siteId, payload) {
  return api.createBuilding(siteId, payload);
}

export async function updateBuilding(buildingId, payload) {
  return api.updateBuilding(buildingId, payload);
}

export async function listFloorsByBuilding(buildingId) {
  return api.listFloorsByBuilding(buildingId);
}

export async function createFloor(buildingId, payload) {
  return api.createFloor(buildingId, payload);
}

export async function listEquipmentByFloor(floorId) {
  return api.listEquipmentByFloor(floorId);
}

export async function createEquipment(floorId, payload) {
  return api.createEquipment(floorId, payload);
}

export async function updateEquipment(equipmentId, payload) {
  return api.updateEquipment(equipmentId, payload);
}

export async function listPointsByEquipment(equipmentId) {
  return api.listPointsByEquipment(equipmentId);
}

export async function createPoint(equipmentId, payload) {
  return api.createPoint(equipmentId, payload);
}

export async function updatePoint(pointId, payload) {
  return api.updatePoint(pointId, payload);
}

/**
 * Full deployment-shaped snapshot for operator (Site Layout, Equipment tree, workspace points).
 */
export async function buildOperatorDeploymentSnapshot(siteId) {
  const siteRow = await api.getSiteById(siteId);
  if (!siteRow) return null;
  const buildings = await api.listBuildingsBySite(siteId);
  const siteBuildings = [];
  const allEquipment = [];

  for (const b of buildings) {
    const floors = await api.listFloorsByBuilding(b.id);
    const floorNodes = [];
    for (const f of floors) {
      const equipmentList = await api.listEquipmentByFloor(f.id);
      for (const eq of equipmentList) {
        const points = await api.listPointsByEquipment(eq.id);
        const livePoints = points
          .map((pt) => api.pointToWorkspaceRow(eq.id, eq.name, pt))
          .filter(Boolean);
        allEquipment.push({
          id: eq.id,
          floorId: eq.floorId,
          siteId: eq.siteId,
          buildingId: eq.buildingId,
          name: eq.name,
          displayLabel: eq.name,
          type: eq.equipmentType,
          instanceNumber: null,
          equipmentType: eq.equipmentType,
          locationLabel: "",
          controllerRef: null,
          protocol: "API",
          templateName: null,
          pointsDefined: points.length,
          status: eq.engineeringStatus || "CONTROLLER_ASSIGNED",
          notes: "",
          livePoints,
        });
      }
      floorNodes.push({
        id: f.id,
        name: f.name,
        sortOrder: 0,
        floorType: "Standard Floor",
      });
    }
    siteBuildings.push({
      id: b.id,
      name: b.name,
      buildingType: "Building",
      buildingCode: "",
      address: b.addressLine1,
      city: b.city,
      state: b.state,
      lat: b.latitude,
      lng: b.longitude,
      status: b.layoutStatus || "normal",
      hasFloors: floorNodes.length > 0,
      floors: floorNodes,
    });
  }

  return {
    version: "api",
    lastDeployedAt: new Date().toISOString(),
    deployedBy: "API",
    systemStatus: "Running",
    site: {
      id: siteRow.id,
      name: siteRow.name,
      siteType: "Site",
      address: "",
      timezone: "",
      buildings: siteBuildings,
    },
    equipment: allEquipment,
    templates: { equipmentTemplates: [], graphicTemplates: [] },
    mappings: {},
    graphics: {},
    siteLayoutGraphics: {},
  };
}

/**
 * Working-version site + equipment[] from API (for Site Builder sync).
 * Uses persisted working-version payload when the hierarchy API is enabled.
 */
export async function fetchWorkingVersionForEngineering(siteId) {
  const raw = await api.getWorkingVersion(siteId);
  const p = raw?.workingVersion?.payload;
  if (!p || typeof p !== "object") return null;
  const s = p.site;
  const equipment = Array.isArray(p.equipment) ? p.equipment : [];
  if (!s) {
    return { site: null, equipment };
  }
  const workingSite = {
    id: s.id,
    name: s.name,
    mode: s.mode ?? "api",
    status: s.status ?? "editing",
    siteType: s.siteType || "Site",
    address: s.address || "",
    timezone: s.timezone || "",
    buildings: (s.buildings || []).map((b) => ({
      id: b.id,
      name: b.name,
      buildingType: b.buildingType,
      buildingCode: b.buildingCode,
      address: b.address,
      city: b.city,
      state: b.state,
      lat: b.lat,
      lng: b.lng,
      status: b.status,
      hasFloors: b.hasFloors,
      floors: (b.floors || []).map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder ?? 0,
        floorType: f.floorType,
      })),
    })),
  };
  const workingEquipment = equipment.map((eq) => ({
    id: eq.id,
    floorId: eq.floorId,
    siteId: eq.siteId,
    name: eq.name,
    displayLabel: eq.displayLabel || eq.name,
    type: eq.type || eq.equipmentType,
    instanceNumber: eq.instanceNumber || null,
    locationLabel: eq.locationLabel || "",
    controllerRef: eq.controllerRef || null,
    protocol: eq.protocol || "API",
    templateName: eq.templateName || null,
    pointsDefined: eq.pointsDefined ?? 0,
    status: eq.status || "CONTROLLER_ASSIGNED",
    notes: eq.notes || "",
    livePoints: eq.livePoints,
  }));
  return { site: workingSite, equipment: workingEquipment };
}

/**
 * Active release from `GET .../api/sites/:siteId/active-release` (null if none).
 * @returns {Promise<{ versionNumber: number, status: string, data: object } | null>}
 */
export async function fetchActiveRelease(siteId) {
  const raw = await api.getActiveRelease(siteId);
  const ar = raw?.activeRelease;
  if (!ar?.payload) return null;
  return {
    versionNumber: ar.versionNumber,
    status: ar.status,
    data: ar.payload,
  };
}

/** @deprecated prefer fetchActiveRelease — returns payload only */
export async function fetchActiveReleasePayload(siteId) {
  const n = await fetchActiveRelease(siteId);
  return n?.data ?? null;
}

export async function saveWorkingVersionToApi(siteId, payload, notes) {
  return api.putWorkingVersion(siteId, { payload, ...(notes !== undefined ? { notes } : {}) });
}

export async function deployWorkingVersionViaApi(siteId, notes) {
  return api.postDeploy(siteId, notes);
}

/** Active + working version numbers for Engineering Deployment panel (API mode). */
export async function fetchSiteVersionSummary(siteId) {
  const [activeRaw, workingRaw] = await Promise.all([api.getActiveRelease(siteId), api.getWorkingVersion(siteId)]);
  const ar = activeRaw?.activeRelease;
  const wv = workingRaw?.workingVersion;
  return {
    activeVersionNumber: ar?.versionNumber ?? null,
    workingVersionNumber: wv?.versionNumber ?? null,
    workingStatus: wv?.status ?? null,
  };
}

/** @deprecated use fetchWorkingVersionForEngineering */
export async function fetchSiteDraftForEngineering(siteId) {
  return fetchWorkingVersionForEngineering(siteId);
}

export function notifyHierarchyChanged(siteId) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("legion-api-hierarchy-changed", {
        detail: siteId != null ? { siteId } : {},
      })
    );
  }
}
