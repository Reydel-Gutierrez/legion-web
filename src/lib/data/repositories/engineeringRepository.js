// Engineering data repository.
// This is a thin facade over the current mock engineering data modules so
// that pages do not import mock files directly. Later we can route these
// functions to real APIs without rewriting the pages.

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
  DISCOVERED_OBJECTS_BY_DEVICE,
  getDiscoveredObjects,
} from "../../../modules/engineering/data/mockPointMappingData";

import {
  SOURCE,
  EXPECTED_POINT_TYPES,
  getSiteTemplates,
  getStarterPointsForEquipmentType,
  GLOBAL_EQUIPMENT_TEMPLATES,
  GLOBAL_GRAPHIC_TEMPLATES,
  addEquipmentTemplateToGlobal,
  addGraphicTemplateToGlobal,
} from "../../../modules/engineering/data/mockTemplateLibraryData";

export const USE_MOCK_ENGINEERING_DATA = true;
export { EQUIPMENT_GROUPS, EQUIPMENT_STATUSES };

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
  DISCOVERED_OBJECTS_BY_DEVICE,
  getDiscoveredObjects,
};

// Template library (constants and helpers)
export {
  SOURCE,
  EXPECTED_POINT_TYPES,
  getSiteTemplates,
  getStarterPointsForEquipmentType,
  GLOBAL_EQUIPMENT_TEMPLATES,
  GLOBAL_GRAPHIC_TEMPLATES,
  addEquipmentTemplateToGlobal,
  addGraphicTemplateToGlobal,
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

