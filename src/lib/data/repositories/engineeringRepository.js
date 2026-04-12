// Engineering data repository.
// This is a thin facade over the current mock engineering data modules so
// that pages do not import mock files directly. Later we can route these
// functions to real APIs without rewriting the pages.

import { USE_HIERARCHY_API } from "../config";
import * as hierarchyRepository from "./hierarchyRepository";
import {
  initialEngineeringMock,
  EQUIPMENT_GROUPS,
  EQUIPMENT_STATUSES,
  getMockSiteTree,
  getMockEquipmentForSite,
  getEquipmentByFloorId,
  getMockDiscoveryForSite,
  enrichEquipmentForPointMapping,
  isNewBuildingSite,
  isNewBuildingFlow,
  treeToSiteStructure,
} from "../../../modules/engineering/data/mockEngineeringData";

import {
  GRAPHIC_STATUSES,
  GRAPHIC_TYPES,
  MOCK_MAPPED_POINTS,
  BINDING_DISPLAY_OPTIONS,
  getGraphicForEquipment,
  getMockGraphicsTree,
  getGraphicById,
  getGraphicsContextOptions,
} from "../../../modules/engineering/data/mockGraphicsData";

import {
  SEVERITY,
  CATEGORY,
  READINESS_STATUS,
  ACTION_TARGET,
  getMockPointMappingRows,
  runValidation,
  getEmptyValidationState,
} from "../../../modules/engineering/validation-center/data/mockValidationData";

import {
  getTemplatePoints,
  autoMapPoints,
  MAPPING_STATUSES,
  BACNET_OBJECT_TYPES,
  GRAPHICS_VALUE_STATES,
  getPointDisplayInfoForEquipment,
  getPointDisplayInfoForEquipmentTemplate,
  DISCOVERED_OBJECTS_BY_DEVICE,
  getDiscoveredObjects,
} from "../../../modules/engineering/data/mockPointMappingData";

import {
  SOURCE,
  EXPECTED_POINT_TYPES,
  getSiteTemplates,
  getStarterPointsForEquipmentType,
} from "../../../modules/engineering/data/mockTemplateLibraryData";

import * as globalTemplateLibraryRepository from "./globalTemplateLibraryRepository";

export const USE_MOCK_ENGINEERING_DATA = true;
export { EQUIPMENT_GROUPS, EQUIPMENT_STATUSES, USE_HIERARCHY_API };

/** Load full working-version flat state from the API (GET syncs hierarchy from DB). */
export async function fetchWorkingVersion(siteId) {
  if (!USE_HIERARCHY_API) return null;
  return hierarchyRepository.fetchWorkingVersionForEngineering(siteId);
}

/** @see hierarchyRepository — use after PUT working-version to merge server-synced hierarchy into state */
export { normalizeWorkingPayloadFromApi } from "./hierarchyRepository";

/** @deprecated use fetchWorkingVersion */
export async function fetchEngineeringSiteDraftFromApi(siteId) {
  return fetchWorkingVersion(siteId);
}

/** Persist working version — API hook; no-op when hierarchy API is off. */
export async function saveWorkingVersion(siteId, payload, notes) {
  if (!USE_HIERARCHY_API) return Promise.resolve();
  return hierarchyRepository.saveWorkingVersionToApi(siteId, payload, notes);
}

/**
 * Promote working version on the backend (POST .../deploy).
 * @param {string} siteId
 * @param {string} [notes]
 * @param {{ deployedBy?: string }} [options]
 * @returns {Promise<object|null>} API JSON (e.g. `{ activeRelease }`) or null when API is off
 */
export async function postDeployWorkingVersion(siteId, notes, options = {}) {
  if (!USE_HIERARCHY_API) return Promise.resolve(null);
  return hierarchyRepository.deployWorkingVersionViaApi(siteId, notes, options);
}

export function notifyEngineeringHierarchyChanged(siteId) {
  hierarchyRepository.notifyHierarchyChanged(siteId);
}

// --- Global Template Library (database-backed; requires USE_HIERARCHY_API)

export async function fetchGlobalEquipmentTemplatesList() {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.listGlobalEquipmentTemplates();
}

export async function fetchGlobalEquipmentTemplateById(id) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.getGlobalEquipmentTemplate(id);
}

export async function fetchGlobalGraphicTemplatesList() {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.listGlobalGraphicTemplates();
}

export async function fetchGlobalGraphicTemplateById(id) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.getGlobalGraphicTemplate(id);
}

export async function pushEquipmentTemplateToGlobal(siteTemplate) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.pushGlobalEquipmentTemplate(siteTemplate);
}

export async function pushGraphicTemplateToGlobal(siteTemplate, equipmentTemplates) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.pushGlobalGraphicTemplate(siteTemplate, equipmentTemplates);
}

export async function patchGlobalEquipmentTemplateName(id, payload) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.patchGlobalEquipmentTemplate(id, payload);
}

export async function deleteGlobalEquipmentTemplate(id) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.deleteGlobalEquipmentTemplate(id);
}

export async function patchGlobalGraphicTemplateName(id, payload) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.patchGlobalGraphicTemplate(id, payload);
}

export async function deleteGlobalGraphicTemplate(id) {
  if (!USE_HIERARCHY_API) {
    throw new Error("Global Template Library requires REACT_APP_API_BASE_URL");
  }
  return globalTemplateLibraryRepository.deleteGlobalGraphicTemplate(id);
}

/** @returns {Promise<{ activeVersionNumber: number|null, workingVersionNumber: number|null, workingStatus: string|null } | null>} */
export async function fetchSiteVersionSummary(siteId) {
  if (!USE_HIERARCHY_API) return Promise.resolve(null);
  return hierarchyRepository.fetchSiteVersionSummary(siteId);
}

// Core engineering state / seed
export function getInitialEngineeringSeed() {
  return initialEngineeringMock;
}

export function getEngineeringSiteTree(siteName) {
  return getMockSiteTree(siteName);
}

export function getEngineeringEquipmentForSite(siteName) {
  return getMockEquipmentForSite(siteName);
}

export function getEngineeringEquipmentByFloorId(equipment, floorId) {
  return getEquipmentByFloorId(equipment, floorId);
}

export function getEngineeringDiscoveryDevices(siteName) {
  return getMockDiscoveryForSite(siteName);
}

export function getEngineeringSiteStructureFromTree(siteTree) {
  return treeToSiteStructure(siteTree);
}

export function isNewEngineeringBuildingSite(siteName) {
  return isNewBuildingSite(siteName);
}

export function isNewEngineeringBuildingFlow(siteName) {
  return isNewBuildingFlow(siteName);
}

export function enrichEquipmentForEngineeringPointMapping(equipmentList, siteTree, siteName) {
  return enrichEquipmentForPointMapping(equipmentList, siteTree, siteName);
}

// Graphics / templates
export {
  GRAPHIC_STATUSES,
  GRAPHIC_TYPES,
  MOCK_MAPPED_POINTS,
  BINDING_DISPLAY_OPTIONS,
  getGraphicForEquipment,
  getMockGraphicsTree,
  getGraphicById,
  getGraphicsContextOptions,
};

// Point mapping (constants and helpers; pages use repo instead of mock file)
// getPointDisplayInfoForEquipment(equipment, draftTemplates?) — draftTemplates for template-only sites
export {
  getTemplatePoints,
  autoMapPoints,
  MAPPING_STATUSES,
  BACNET_OBJECT_TYPES,
  GRAPHICS_VALUE_STATES,
  getPointDisplayInfoForEquipment,
  getPointDisplayInfoForEquipmentTemplate,
  DISCOVERED_OBJECTS_BY_DEVICE,
  getDiscoveredObjects,
};

// Template library (constants and helpers)
export {
  SOURCE,
  EXPECTED_POINT_TYPES,
  getSiteTemplates,
  getStarterPointsForEquipmentType,
};

// Validation
export {
  SEVERITY,
  CATEGORY,
  READINESS_STATUS,
  ACTION_TARGET,
  getMockPointMappingRows,
  runValidation,
  getEmptyValidationState,
};

