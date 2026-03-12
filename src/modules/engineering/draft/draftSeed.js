/**
 * Seed data for the central engineering draft.
 * Miami HQ world: site, templates, equipment, discovery, mappings, graphics, deployment history.
 * Used to initialize shared state when site is Miami HQ (or Parkline).
 */

import { createSite, createEquipment, createEquipmentTemplate, createGraphicTemplate } from "./draftModel";
import { engineeringRepository } from "../../../lib/data";

/** Build draft site from site tree (from getMockSiteTree) */
function buildSiteFromTree(siteTree) {
  if (!siteTree) return null;
  const buildings = (siteTree.children || []).map((b) => ({
    id: b.id,
    name: b.name,
    buildingType: b.buildingType,
    buildingCode: b.buildingCode,
    floors: (b.children || []).map((f) => ({ id: f.id, name: f.name, sortOrder: f.sortOrder ?? 0 })),
  }));
  return createSite({
    id: siteTree.id,
    name: siteTree.name,
    mode: "draft",
    status: "editing",
    siteType: siteTree.siteType,
    address: siteTree.address,
    timezone: siteTree.timezone,
    buildings,
  });
}

/** Build equipment list from mock; ensure required fields */
function buildEquipmentFromMock(mockList, siteId) {
  if (!Array.isArray(mockList)) return [];
  return mockList.map((e) =>
    createEquipment({
      ...e,
      siteId: e.siteId || siteId,
      buildingId: e.buildingId || null,
      displayLabel: e.displayLabel || e.name,
      locationLabel: e.locationLabel || "",
      controllerRef: e.controllerRef ?? null,
      deviceInstance: e.deviceInstance ?? null,
      templateName: e.templateName ?? null,
      pointsDefined: e.pointsDefined ?? 0,
      status: e.status || "MISSING_CONTROLLER",
      notes: e.notes || "",
      equipmentGroup: e.equipmentGroup || null,
      protocol: e.protocol || "BACnet/IP",
    })
  );
}

/** Build discovery devices from mock — keep tree structure (array of root nodes with children) */
function buildDiscoveredDevicesFromMock(mockDiscovery) {
  if (!Array.isArray(mockDiscovery)) return [];
  return mockDiscovery.map((n) => ({
    ...n,
    id: n.id,
    parentId: n.parentId ?? null,
    name: n.name,
    vendor: n.vendor,
    deviceInstance: n.deviceInstance,
    network: n.network,
    macOrMstpId: n.macOrMstpId,
    objectCount: n.objectCount ?? 0,
    lastSeen: n.lastSeen,
    status: n.status,
    protocol: n.protocol || "BACnet/IP",
    isExpandable: n.isExpandable ?? false,
    assignedEquipmentId: n.assignedEquipmentId ?? null,
    children: buildDiscoveredDevicesFromMock(n.children || []),
  }));
}

/** discoveredObjects: map deviceInstance (string) -> array of objects */
function buildDiscoveredObjectsFromMock(discoveredObjectsByDevice) {
  const out = {};
  if (!discoveredObjectsByDevice || typeof discoveredObjectsByDevice !== "object") return out;
  Object.keys(discoveredObjectsByDevice).forEach((key) => {
    out[key] = (discoveredObjectsByDevice[key] || []).map((o) => ({ ...o }));
  });
  return out;
}

/** Equipment templates from template library mock */
function buildEquipmentTemplatesFromMock(siteName) {
  const { equipment = [] } = engineeringRepository.getSiteTemplates(siteName || "Miami HQ", true);
  return equipment.map((t) =>
    createEquipmentTemplate({
      id: t.id,
      name: t.name,
      equipmentType: t.equipmentType,
      pointCount: t.pointCount ?? 0,
      defaultGraphic: t.defaultGraphic ?? null,
      source: t.source || "Global Imported",
      points: t.points || [],
      description: t.description || "",
      lastUpdated: t.lastUpdated || null,
    })
  );
}

/** Graphic templates from template library mock */
function buildGraphicTemplatesFromMock(siteName) {
  const { graphic = [] } = engineeringRepository.getSiteTemplates(siteName || "Miami HQ", true);
  return graphic.map((g) =>
    createGraphicTemplate({
      id: g.id,
      name: g.name,
      appliesTo: g.appliesTo,
      boundPointCount: g.boundPointCount ?? 0,
      source: g.source || "Global Imported",
      lastUpdated: g.lastUpdated || null,
    })
  );
}

/** Template points by template name (from mockPointMappingData) */
function getTemplatePointIdsForTemplate(templateName) {
  try {
    const { TEMPLATE_POINTS } = require("../data/mockPointMappingData");
    const points = TEMPLATE_POINTS[templateName] || [];
    return points.map((p) => ({ id: p.id, displayName: p.displayName }));
  } catch {
    return [];
  }
}

/** Initial mappings: some mapped, some missing (by equipment id). */
function buildInitialMappings(equipmentList, discoveredObjectsByDevice) {
  const mappings = {};
  equipmentList.forEach((eq) => {
    if (!eq.controllerRef || !eq.templateName) return;
    const objects = discoveredObjectsByDevice[String(eq.controllerRef)] || [];
    if (objects.length === 0) return;
    const templatePoints = getTemplatePointIdsForTemplate(eq.templateName);
    const byName = {};
    objects.forEach((o) => {
      byName[(o.displayName || "").toLowerCase().replace(/\s+/g, "")] = o.id;
    });
    const eqMappings = {};
    templatePoints.forEach(({ id: tpId, displayName }) => {
      const key = (displayName || "").toLowerCase().replace(/\s+/g, "");
      if (byName[key]) eqMappings[tpId] = byName[key];
    });
    if (Object.keys(eqMappings).length > 0) mappings[eq.id] = eqMappings;
  });
  return mappings;
}

/** Graphics by equipment id (from mock graphics data) */
function buildGraphicsFromMock(siteName) {
  const { getGraphicForEquipment } = require("../data/mockGraphicsData");
  const graphics = {};
  const equipmentIds = [
    "eq-m1", "eq-m2", "eq-m3", "eq-m4", "eq-m5", "eq-m6", "eq-m7", "eq-m8", "eq-m9",
    "eq-m10", "eq-m11", "eq-m12", "eq-m13", "eq-m14", "eq-m15", "eq-m16",
  ];
  equipmentIds.forEach((eqId) => {
    const g = getGraphicForEquipment(eqId);
    if (g && g.id) graphics[eqId] = { ...g };
  });
  return graphics;
}

/** Deployment history: v10, v11, v12 */
function buildDeploymentHistory() {
  return [
    { version: "v12", date: "2026-03-09", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-09T21:45:00.000Z" },
    { version: "v11", date: "2026-03-08", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-08T18:00:00.000Z" },
    { version: "v10", date: "2026-03-07", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-07T18:00:00.000Z" },
  ];
}

/** Active deployment snapshot (current live version) */
function buildActiveDeploymentSnapshot() {
  return {
    version: "v12",
    lastDeployedAt: "2026-03-09T21:45:00.000Z",
    deployedBy: "Reydel Gutierrez",
    systemStatus: "Running",
  };
}

/**
 * Create full draft seed for a site.
 * @param {string} siteName - "Miami HQ" | "New Site" | "New Building"
 * @returns {object} Draft state
 */
export function createSeedDraft(siteName) {
  const isEmpty =
    siteName === "New Building" ||
    siteName === "New Site" ||
    !siteName;
  if (isEmpty) {
    return {
      site: null,
      templates: { equipmentTemplates: [], graphicTemplates: [] },
      equipment: [],
      discoveredDevices: [],
      discoveredObjects: {},
      mappings: {},
      graphics: {},
      validation: null,
      deploymentHistory: [],
      activeDeploymentSnapshot: null,
    };
  }

  const siteTree = engineeringRepository.getEngineeringSiteTree(siteName);
  const mockEquipment = engineeringRepository.getEngineeringEquipmentForSite(siteName) || [];
  const mockDiscovery = engineeringRepository.getEngineeringDiscoveryDevices(siteName) || [];

  const site = buildSiteFromTree(siteTree);
  const siteId = site?.id || (siteTree?.id ?? null);
  const equipment = buildEquipmentFromMock(mockEquipment, siteId);
  const discoveredDevices = buildDiscoveredDevicesFromMock(mockDiscovery);
  const discoveredObjects = buildDiscoveredObjectsFromMock(engineeringRepository.DISCOVERED_OBJECTS_BY_DEVICE);
  const equipmentTemplates = buildEquipmentTemplatesFromMock(siteName);
  const graphicTemplates = buildGraphicTemplatesFromMock(siteName);
  const mappings = buildInitialMappings(equipment, engineeringRepository.DISCOVERED_OBJECTS_BY_DEVICE);
  const graphics = buildGraphicsFromMock(siteName);

  return {
    site,
    templates: { equipmentTemplates, graphicTemplates },
    equipment,
    discoveredDevices,
    discoveredObjects,
    mappings,
    graphics,
    validation: null,
    deploymentHistory: buildDeploymentHistory(),
    activeDeploymentSnapshot: buildActiveDeploymentSnapshot(),
  };
}
