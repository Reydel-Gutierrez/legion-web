/**
 * Mock data and logic for Validation Center.
 * Derives validation state from site/equipment/controllers/graphics (mock).
 * Run Validation refreshes this; later can connect to real engineering store/API.
 */

export const SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  PASSED: "passed",
};

export const CATEGORY = {
  EQUIPMENT: "Equipment",
  CONTROLLERS: "Controllers",
  POINT_MAPPING: "Point Mapping",
  GRAPHICS: "Graphics",
  NETWORK: "Network",
  DEPLOYMENT_READINESS: "Deployment Readiness",
};

export const READINESS_STATUS = {
  READY: "ready",
  BLOCKED: "blocked",
  WARNINGS: "warnings",
};

export const ACTION_TARGET = {
  SITE_BUILDER: "site-builder",
  POINT_MAPPING: "point-mapping",
  GRAPHICS_MANAGER: "graphics-manager",
  NETWORK_DISCOVERY: "network-discovery",
  TEMPLATE_LIBRARY: "template-library",
};

/**
 * Mock validation issues. In production these would be computed from site/equipment/mapping/graphics.
 */
function buildMockIssues() {
  return [
    {
      id: "v-1",
      severity: SEVERITY.ERROR,
      category: CATEGORY.EQUIPMENT,
      equipmentOrDevice: "VAV-2",
      issue: "Missing controller",
      relatedPointOrBinding: "—",
      recommendedFix: "Assign a discovered controller",
      status: "Open",
      actionTarget: ACTION_TARGET.SITE_BUILDER,
      actionLabel: "Open in Site Builder",
      whyThisMatters: "Equipment cannot receive or send BACnet data without an assigned controller.",
      fixSteps: "In Site Builder, select the equipment and assign a discovered device from Network Discovery.",
      templatePoint: null,
      mappedBacnetObject: null,
      mappingStatus: null,
    },
    {
      id: "v-2",
      severity: SEVERITY.ERROR,
      category: CATEGORY.POINT_MAPPING,
      equipmentOrDevice: "VAV-1",
      issue: "Required point not mapped",
      relatedPointOrBinding: "Damper Command",
      recommendedFix: "Map a BACnet object",
      status: "Open",
      actionTarget: ACTION_TARGET.POINT_MAPPING,
      actionLabel: "Open in Point Mapping",
      whyThisMatters: "Required template points must be mapped for the equipment to operate correctly.",
      fixSteps: "Open Point Mapping, select VAV-1, and map Damper Command to an AO object from the discovered controller.",
      templatePoint: "Damper Command",
      mappedBacnetObject: null,
      mappingStatus: "not mapped",
    },
    {
      id: "v-3",
      severity: SEVERITY.WARNING,
      category: CATEGORY.GRAPHICS,
      equipmentOrDevice: "AHU-1",
      issue: "Graphic missing optional binding",
      relatedPointOrBinding: "SpaceHumidity",
      recommendedFix: "Update graphic or ignore",
      status: "Open",
      actionTarget: ACTION_TARGET.GRAPHICS_MANAGER,
      actionLabel: "Open in Graphics Manager",
      whyThisMatters: "Optional bindings improve operator visibility but are not required for deployment.",
      fixSteps: "In Graphics Manager, open the AHU-1 graphic and bind SpaceHumidity to the template point, or leave unmapped.",
      templatePoint: "SpaceHumidity",
      mappedBacnetObject: "AI:4",
      mappingStatus: "optional unmapped in graphic",
    },
    {
      id: "v-4",
      severity: SEVERITY.ERROR,
      category: CATEGORY.NETWORK,
      equipmentOrDevice: "NCE-332",
      issue: "Controller offline",
      relatedPointOrBinding: "—",
      recommendedFix: "Verify controller communication",
      status: "Open",
      actionTarget: ACTION_TARGET.NETWORK_DISCOVERY,
      actionLabel: "Open in Network Discovery",
      whyThisMatters: "Offline controllers will not provide live data after deployment.",
      fixSteps: "In Network Discovery, verify network path and device power. Re-scan if needed.",
      templatePoint: null,
      mappedBacnetObject: null,
      mappingStatus: null,
    },
    {
      id: "v-5",
      severity: SEVERITY.ERROR,
      category: CATEGORY.CONTROLLERS,
      equipmentOrDevice: "VAV-3",
      issue: "No discovered objects for assigned controller",
      relatedPointOrBinding: "—",
      recommendedFix: "Run point discovery on the controller",
      status: "Open",
      actionTarget: ACTION_TARGET.NETWORK_DISCOVERY,
      actionLabel: "Open in Network Discovery",
      whyThisMatters: "Point mapping requires discovered BACnet objects from the controller.",
      fixSteps: "In Network Discovery, open the device assigned to VAV-3 and run Discover Points.",
      templatePoint: null,
      mappedBacnetObject: null,
      mappingStatus: null,
    },
    {
      id: "v-6",
      severity: SEVERITY.WARNING,
      category: CATEGORY.GRAPHICS,
      equipmentOrDevice: "AHU-1",
      issue: "Graphic missing",
      relatedPointOrBinding: "—",
      recommendedFix: "Create or assign a graphic",
      status: "Open",
      actionTarget: ACTION_TARGET.GRAPHICS_MANAGER,
      actionLabel: "Open in Graphics Manager",
      whyThisMatters: "Equipment without a graphic may still be deployed but will not have a visual in the operator UI.",
      fixSteps: "In Graphics Manager, create or assign a graphic template for AHU-1.",
      templatePoint: null,
      mappedBacnetObject: null,
      mappingStatus: null,
    },
    {
      id: "v-7",
      severity: SEVERITY.WARNING,
      category: CATEGORY.POINT_MAPPING,
      equipmentOrDevice: "VAV-1",
      issue: "Optional point unmapped",
      relatedPointOrBinding: "Occupancy",
      recommendedFix: "Map in Point Mapping or ignore",
      status: "Open",
      actionTarget: ACTION_TARGET.POINT_MAPPING,
      actionLabel: "Open in Point Mapping",
      whyThisMatters: "Optional points can improve functionality but are not required for deployment.",
      fixSteps: "Optionally map Occupancy in Point Mapping for VAV-1.",
      templatePoint: "Occupancy",
      mappedBacnetObject: null,
      mappingStatus: "optional unmapped",
    },
  ];
}

/**
 * Mock point-mapping drilldown: Logical Template Point -> Mapped BACnet Object
 */
export function getMockPointMappingRows(equipmentName) {
  const rows = {
    "VAV-1": [
      { templatePoint: "Zone Temp", bacnetObject: "AI:3", status: "OK" },
      { templatePoint: "Cooling Setpoint", bacnetObject: "AV:5", status: "OK" },
      { templatePoint: "Damper Command", bacnetObject: "not mapped", status: "Error" },
      { templatePoint: "Occupancy", bacnetObject: "not mapped", status: "Warning (optional)" },
    ],
    "VAV-2": [
      { templatePoint: "Zone Temp", bacnetObject: "—", status: "No controller" },
    ],
    "VAV-3": [
      { templatePoint: "Zone Temp", bacnetObject: "—", status: "No discovered objects" },
    ],
  };
  return rows[equipmentName] || [];
}

/**
 * Compute summary counts from issues list.
 */
export function computeSummaryFromIssues(issues) {
  const errors = issues.filter((i) => i.severity === SEVERITY.ERROR).length;
  const warnings = issues.filter((i) => i.severity === SEVERITY.WARNING).length;
  const byCategory = {};
  issues.forEach((i) => {
    byCategory[i.category] = (byCategory[i.category] || 0) + 1;
  });
  return {
    equipment: 12,
    controllers: 8,
    requiredPointsMapped: 94,
    unmappedRequiredPoints: 1,
    graphicsMissing: 1,
    offlineControllers: 1,
    warnings,
    errors,
    byCategory,
  };
}

/**
 * Get overall deployment readiness: ready | blocked | warnings
 */
export function getReadinessStatus(summary) {
  if (summary.errors > 0) return READINESS_STATUS.BLOCKED;
  if (summary.warnings > 0) return READINESS_STATUS.WARNINGS;
  return READINESS_STATUS.READY;
}

/**
 * Get short message for readiness.
 */
export function getReadinessMessage(readiness, summary) {
  if (readiness === READINESS_STATUS.READY) {
    return "All required checks passed.";
  }
  if (readiness === READINESS_STATUS.BLOCKED) {
    const n = summary.errors;
    return `${n} blocking issue${n !== 1 ? "s" : ""} must be resolved before normal deployment.`;
  }
  const n = summary.warnings;
  return `${n} warning${n !== 1 ? "s" : ""} detected. You may still deploy using override.`;
}

/**
 * Run validation: returns mock result (later from API/store).
 */
export function runValidation(siteName) {
  const issues = buildMockIssues();
  const summary = computeSummaryFromIssues(issues);
  const readiness = getReadinessStatus(summary);
  const message = getReadinessMessage(readiness, summary);
  return {
    issues,
    summary,
    readiness,
    message,
    lastRunAt: new Date().toISOString(),
  };
}

/**
 * Initial state when validation has not been run.
 */
export function getEmptyValidationState() {
  return {
    issues: [],
    summary: {
      equipment: 0,
      controllers: 0,
      requiredPointsMapped: 0,
      unmappedRequiredPoints: 0,
      graphicsMissing: 0,
      offlineControllers: 0,
      warnings: 0,
      errors: 0,
      byCategory: {},
    },
    readiness: null,
    message: null,
    lastRunAt: null,
  };
}
