/**
 * Seed data for the engineering working version (Miami HQ, Brightline, empty sites).
 */

import { createSite, createEquipment, createEquipmentTemplate, createGraphicTemplate } from "./workingVersionModel";
import { engineeringRepository } from "../../../lib/data";
import { createEmptyNetworkConfig, createMiamiHqNetworkConfig } from "../network/networkConfigModel";

function buildSiteFromTree(siteTree) {
  if (!siteTree) return null;
  const buildings = (siteTree.children || []).map((b) => ({
    id: b.id,
    siteId: siteTree.id,
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
    thumbnail: b.thumbnail,
    floors: (b.children || []).map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder ?? 0,
      floorType: f.floorType,
    })),
  }));
  return createSite({
    id: siteTree.id,
    name: siteTree.name,
    mode: "working",
    status: "editing",
    siteType: siteTree.siteType,
    timezone: siteTree.timezone,
    buildings,
  });
}

function buildEquipmentFromMock(mockList, siteId) {
  if (!Array.isArray(mockList)) return [];
  return mockList.map((e) =>
    createEquipment({
      ...e,
      siteId: e.siteId || siteId,
      buildingId: e.buildingId || null,
      displayLabel: e.displayLabel || e.name,
      address: e.address ?? null,
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
    address: n.address ?? null,
    children: buildDiscoveredDevicesFromMock(n.children || []),
  }));
}

function buildDiscoveredObjectsFromMock(discoveredObjectsByDevice) {
  const out = {};
  if (!discoveredObjectsByDevice || typeof discoveredObjectsByDevice !== "object") return out;
  Object.keys(discoveredObjectsByDevice).forEach((key) => {
    out[key] = (discoveredObjectsByDevice[key] || []).map((o) => ({ ...o }));
  });
  return out;
}

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

function buildGraphicTemplatesFromMock(siteName) {
  const { graphic = [], equipment = [] } = engineeringRepository.getSiteTemplates(siteName || "Miami HQ", true);
  return graphic.map((g) => {
    const eq = equipment.find((e) => (e.name || "").toLowerCase() === (g.appliesTo || "").toLowerCase());
    return createGraphicTemplate({
      id: g.id,
      name: g.name,
      appliesTo: g.appliesTo,
      equipmentTemplateId: eq?.id ?? null,
      boundPointCount: g.boundPointCount ?? 0,
      source: g.source || "Global Imported",
      lastUpdated: g.lastUpdated || null,
    });
  });
}

function getTemplatePointIdsForTemplate(templateName) {
  try {
    const { TEMPLATE_POINTS } = require("../data/mockPointMappingData");
    const points = TEMPLATE_POINTS[templateName] || [];
    return points.map((p) => ({ id: p.id, displayName: p.displayName }));
  } catch {
    return [];
  }
}

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

function buildReleaseHistorySeed() {
  return [
    { version: "v12", date: "2026-03-09", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-09T21:45:00.000Z" },
    { version: "v11", date: "2026-03-08", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-08T18:00:00.000Z" },
    { version: "v10", date: "2026-03-07", user: "Reydel", result: "Success", notes: "", timestamp: "2026-03-07T18:00:00.000Z" },
  ];
}

function buildActiveReleaseMetadataSeed() {
  return {
    version: "v12",
    lastDeployedAt: "2026-03-09T21:45:00.000Z",
    deployedBy: "Reydel Gutierrez",
    systemStatus: "Running",
  };
}

/**
 * @param {string} siteName - "Miami HQ" | "New Site" | "New Building"
 * @returns {object} Flat working-version state (persisted as JSON)
 */
export function createSeedWorkingVersion(siteName) {
  const isEmpty = siteName === "New Building" || siteName === "New Site" || !siteName;
  if (isEmpty) {
    return {
      site: null,
      templates: { equipmentTemplates: [], graphicTemplates: [] },
      equipment: [],
      discoveredDevices: [],
      discoveredObjects: {},
      mappings: {},
      graphics: {},
      siteLayoutGraphics: {},
      networkConfig: createEmptyNetworkConfig(),
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
    siteLayoutGraphics: {},
    networkConfig: createMiamiHqNetworkConfig(),
    validation: null,
    deploymentHistory: buildReleaseHistorySeed(),
    activeDeploymentSnapshot: buildActiveReleaseMetadataSeed(),
  };
}
