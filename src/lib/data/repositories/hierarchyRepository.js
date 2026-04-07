/**
 * Hierarchy repository — async facade over hierarchyApiAdapter.
 * Used by operator/engineering when REACT_APP_API_BASE_URL is set.
 */

import * as api from "../adapters/api/hierarchyApiAdapter";
import { isHierarchyApiEnabled } from "../../api/apiConfig";
import { EMPTY_WORKING_DATA } from "../../../modules/engineering/working-version/workingVersionModel";
import { ensureNetworkConfig } from "../../../modules/engineering/network/networkConfigModel";

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

export async function deleteBuilding(buildingId) {
  return api.deleteBuilding(buildingId);
}

export async function updateFloor(floorId, payload) {
  return api.updateFloor(floorId, payload);
}

export async function deleteFloor(floorId) {
  return api.deleteFloor(floorId);
}

export async function deleteEquipment(equipmentId) {
  return api.deleteEquipment(equipmentId);
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
    for (let fi = 0; fi < floors.length; fi++) {
      const f = floors[fi];
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
          instanceNumber: eq.instanceNumber ?? null,
          equipmentType: eq.equipmentType,
          address: eq.address || "",
          locationLabel: "",
          controllerRef: null,
          protocol: "API",
          templateName: eq.templateName ?? null,
          pointsDefined: points.length,
          status: eq.engineeringStatus || "MISSING_CONTROLLER",
          notes: "",
          livePoints,
        });
      }
      floorNodes.push({
        id: f.id,
        name: f.name,
        sortOrder: fi,
        floorType: "Standard Floor",
      });
    }
    siteBuildings.push({
      id: b.id,
      name: b.name,
      buildingType: b.buildingType || "",
      buildingCode: b.buildingCode || "",
      description: b.description != null ? String(b.description) : "",
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
      timezone: "",
      description: siteRow.description != null ? String(siteRow.description) : "",
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
 * Maps GET /working-version payload JSON into flat engineering reducer state.
 * Hierarchy (site.buildings / equipment) comes from the server after DB sync.
 */
export function normalizeWorkingPayloadFromApi(p) {
  if (!p || typeof p !== "object") return null;
  const s = p.site;
  const equipmentRaw = Array.isArray(p.equipment) ? p.equipment : [];
  const workingEquipment = equipmentRaw.map((eq) => ({
    ...eq,
    id: eq.id,
    sortOrder:
      typeof eq.sortOrder === "number" && !Number.isNaN(eq.sortOrder) ? eq.sortOrder : undefined,
    floorId: eq.floorId,
    siteId: eq.siteId,
    buildingId: eq.buildingId,
    name: eq.name,
    displayLabel: eq.displayLabel || eq.name,
    type: eq.type || eq.equipmentType,
    equipmentType: eq.equipmentType || eq.type,
    instanceNumber: eq.instanceNumber ?? null,
    address: eq.address != null ? String(eq.address) : "",
    locationLabel: eq.locationLabel || "",
    controllerRef: eq.controllerRef ?? null,
    protocol: eq.protocol || "API",
    templateName: eq.templateName ?? null,
    pointsDefined: eq.pointsDefined ?? 0,
    status: eq.status || "MISSING_CONTROLLER",
    notes: eq.notes || "",
    livePoints: Array.isArray(eq.livePoints) ? eq.livePoints : [],
  }));

  let workingSite = null;
  if (s && typeof s === "object") {
    workingSite = {
      id: s.id,
      name: s.name,
      mode: s.mode ?? "api",
      status: s.status ?? "editing",
      nodeStatus: s.nodeStatus ?? "Active",
      siteType: s.siteType || "",
      timezone: s.timezone || "",
      displayLabel: s.displayLabel || s.name,
      description: s.description || "",
      engineeringNotes: s.engineeringNotes || "",
      icon: s.icon || "",
      buildings: (s.buildings || []).map((b) => ({
        id: b.id,
        name: b.name,
        buildingType: b.buildingType,
        buildingCode: b.buildingCode,
        description: b.description != null ? String(b.description) : "",
        address: b.address,
        city: b.city,
        state: b.state,
        lat: b.lat,
        lng: b.lng,
        status: b.status,
        layoutStatus: b.layoutStatus,
        sortOrder: b.sortOrder ?? 0,
        hasFloors: b.hasFloors,
        floors: (b.floors || []).map((f) => ({
          id: f.id,
          name: f.name,
          sortOrder: f.sortOrder ?? 0,
          floorType: f.floorType,
          occupancyType: f.occupancyType,
        })),
      })),
    };
  }

  const base = { ...EMPTY_WORKING_DATA, ...p };
  return {
    ...base,
    site: workingSite,
    equipment: workingEquipment,
    templates: {
      equipmentTemplates: Array.isArray(p.templates?.equipmentTemplates)
        ? p.templates.equipmentTemplates
        : EMPTY_WORKING_DATA.templates.equipmentTemplates,
      graphicTemplates: Array.isArray(p.templates?.graphicTemplates)
        ? p.templates.graphicTemplates
        : EMPTY_WORKING_DATA.templates.graphicTemplates,
    },
    discoveredDevices: Array.isArray(p.discoveredDevices) ? p.discoveredDevices : [],
    discoveredObjects:
      p.discoveredObjects && typeof p.discoveredObjects === "object" ? p.discoveredObjects : {},
    mappings: p.mappings && typeof p.mappings === "object" ? p.mappings : {},
    graphics: p.graphics && typeof p.graphics === "object" ? p.graphics : {},
    siteLayoutGraphics:
      p.siteLayoutGraphics && typeof p.siteLayoutGraphics === "object" ? p.siteLayoutGraphics : {},
    networkConfig: ensureNetworkConfig(base),
    validation: p.validation ?? null,
    deploymentHistory: Array.isArray(p.deploymentHistory) ? p.deploymentHistory : [],
    activeDeploymentSnapshot: p.activeDeploymentSnapshot ?? null,
  };
}

/**
 * Full working-version flat state from API (GET working-version syncs hierarchy from DB first).
 */
export async function fetchWorkingVersionForEngineering(siteId) {
  const raw = await api.getWorkingVersion(siteId);
  const p = raw?.workingVersion?.payload;
  return normalizeWorkingPayloadFromApi(p);
}

/**
 * Active release from `GET .../api/sites/:siteId/active-release`.
 * If no deployed release exists, builds a live snapshot from the relational hierarchy so Operator UI stays consistent.
 * @returns {Promise<{ versionNumber: number|null, status: string, data: object } | null>}
 */
export async function fetchActiveRelease(siteId) {
  const raw = await api.getActiveRelease(siteId);
  const ar = raw?.activeRelease;
  if (ar?.payload != null && typeof ar.payload === "object") {
    return {
      versionNumber: ar.versionNumber ?? null,
      status: ar.status,
      data: ar.payload,
    };
  }
  const live = await buildOperatorDeploymentSnapshot(siteId);
  if (!live) return null;
  try {
    const working = await fetchWorkingVersionForEngineering(siteId);
    if (working?.templates && typeof working.templates === "object") {
      live.templates = {
        equipmentTemplates: Array.isArray(working.templates.equipmentTemplates)
          ? working.templates.equipmentTemplates
          : [],
        graphicTemplates: Array.isArray(working.templates.graphicTemplates)
          ? working.templates.graphicTemplates
          : [],
      };
    }
  } catch {
    /* operator still works without template command metadata */
  }
  return {
    versionNumber: ar?.versionNumber ?? 0,
    status: ar?.status || "LIVE",
    data: live,
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
