/**
 * Central Legion engineering draft model — domain shape only.
 * Engineering = author/configure draft; Operator = consume active deployed state.
 * Phase 1: lightweight, mock-data driven; no backend.
 */

/** Initial empty draft state shape */
export const EMPTY_DRAFT = {
  site: null,
  templates: {
    equipmentTemplates: [],
    graphicTemplates: [],
  },
  equipment: [],
  discoveredDevices: [],
  discoveredObjects: {},
  mappings: {},
  graphics: {},
  validation: null,
  deploymentHistory: [],
  activeDeploymentSnapshot: null,
};

/** Draft site: id, name, mode/status metadata, buildings/floors summary */
export function createSite(overrides = {}) {
  return {
    id: null,
    name: null,
    mode: "draft",
    status: "editing",
    buildings: [],
    ...overrides,
  };
}

/** Equipment instance: site location, type, template id, assigned device id, graphic ref. instanceNumber = user-defined unique ref for URL/identification. */
export function createEquipment(overrides = {}) {
  return {
    id: null,
    siteId: null,
    buildingId: null,
    floorId: null,
    name: null,
    displayLabel: null,
    type: null,
    instanceNumber: null,
    controllerRef: null,
    deviceInstance: null,
    templateName: null,
    templateId: null,
    graphicTemplateId: null,
    graphicInstanceId: null,
    pointsDefined: 0,
    status: "MISSING_CONTROLLER",
    locationLabel: null,
    notes: "",
    equipmentGroup: null,
    protocol: "BACnet/IP",
    ...overrides,
  };
}

/** Discovered device: BACnet device/controller metadata, assignment status, online/offline, last seen */
export function createDiscoveredDevice(overrides = {}) {
  return {
    id: null,
    parentId: null,
    name: null,
    vendor: null,
    deviceInstance: null,
    network: null,
    macOrMstpId: null,
    objectCount: 0,
    lastSeen: null,
    status: "Offline",
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
    ...overrides,
  };
}

/** Discovered BACnet object (per device) */
export function createDiscoveredObject(overrides = {}) {
  return {
    id: null,
    objectType: null,
    objectInstance: null,
    bacnetRef: null,
    displayName: null,
    units: null,
    presentValue: null,
    writable: false,
    sourceDevice: null,
    status: "Online",
    ...overrides,
  };
}

/** Equipment template */
export function createEquipmentTemplate(overrides = {}) {
  return {
    id: null,
    name: null,
    equipmentType: null,
    pointCount: 0,
    defaultGraphic: null,
    source: "Global Imported",
    points: [],
    description: "",
    lastUpdated: null,
    ...overrides,
  };
}

/** Graphic template */
export function createGraphicTemplate(overrides = {}) {
  return {
    id: null,
    name: null,
    appliesTo: null,
    boundPointCount: 0,
    source: "Global Imported",
    lastUpdated: null,
    ...overrides,
  };
}

/** Mappings: equipmentId -> { templatePointId -> bacnetObjectId } */
export function getMappingsForEquipment(mappings, equipmentId) {
  return mappings[equipmentId] || {};
}

/** Validation result (computed by validateDraft) */
export function createValidationResult(overrides = {}) {
  return {
    issues: [],
    summary: { errors: 0, warnings: 0, byCategory: {} },
    readiness: null,
    message: null,
    lastRunAt: null,
    ...overrides,
  };
}

/** Deployment history entry */
export function createDeploymentEntry(overrides = {}) {
  return {
    version: null,
    date: null,
    user: null,
    result: "Success",
    notes: "",
    timestamp: null,
    ...overrides,
  };
}
