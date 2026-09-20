/**
 * Engineering working-version domain model (frontend-only).
 * Engineering edits the working version; deploy activates a release for Operator Mode.
 */

import { createEmptyNetworkConfig } from "../network/networkConfigModel";

/** Initial empty working-version data payload (nested under workingVersion.data). */
export const EMPTY_WORKING_DATA = {
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
  siteLayoutGraphics: {},
  networkConfig: createEmptyNetworkConfig(),
  validation: null,
  deploymentHistory: [],
  /** Metadata for the last activated release (version label / timestamps) — persisted under this key for compatibility. */
  activeDeploymentSnapshot: null,
};

/** Site under configuration: id, name, mode/status metadata, buildings/floors summary */
export function createSite(overrides = {}) {
  return {
    id: null,
    name: null,
    mode: "working",
    status: "editing",
    buildings: [],
    ...overrides,
  };
}

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
    /** Controller / BACnet address for mapping (shown in Site Builder table). */
    address: null,
    locationLabel: null,
    notes: "",
    equipmentGroup: null,
    protocol: "BACnet/IP",
    /** Per-floor display order in Site Builder (0 = first). */
    sortOrder: null,
    ...overrides,
  };
}

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
    /** Optional user-entered address # (aligns with equipment mapping). */
    address: null,
    children: [],
    ...overrides,
  };
}

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

export function createGraphicTemplate(overrides = {}) {
  return {
    id: null,
    name: null,
    appliesTo: null,
    equipmentTemplateId: null,
    boundPointCount: 0,
    graphicEditorState: null,
    source: "Global Imported",
    lastUpdated: null,
    ...overrides,
  };
}

export function getMappingsForEquipment(mappings, equipmentId) {
  return mappings[equipmentId] || {};
}

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

export function createReleaseHistoryEntry(overrides = {}) {
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
