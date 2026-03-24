/**
 * Validation for the engineering working version (readiness before deploy).
 */

import { SEVERITY, CATEGORY, READINESS_STATUS, ACTION_TARGET } from "../../../lib/data/repositories/engineeringRepository";
import { engineeringRepository } from "../../../lib/data";
import { getMappingsForEquipment } from "./workingVersionModel";

let issueIdCounter = 0;
function nextId() {
  return `vd-${++issueIdCounter}-${Date.now()}`;
}

/**
 * @param {object} workingData - Flat working-version fields (same shape as legacy engineering payload)
 */
export function validateWorkingVersion(workingData) {
  const issues = [];
  const equipment = workingData?.equipment ?? [];
  const discoveredDevices = workingData?.discoveredDevices ?? [];
  const discoveredObjects = workingData?.discoveredObjects ?? {};
  const mappings = workingData?.mappings ?? {};
  const graphics = workingData?.graphics ?? {};

  const deviceStatusByInstance = {};
  function collectDeviceStatus(nodes) {
    if (!nodes?.length) return;
    nodes.forEach((d) => {
      const key = String(d.deviceInstance ?? d.id);
      deviceStatusByInstance[key] = (d.status || "Offline").toLowerCase();
      collectDeviceStatus(d.children);
    });
  }
  collectDeviceStatus(discoveredDevices);

  equipment.forEach((eq) => {
    if (!eq.controllerRef || String(eq.controllerRef).trim() === "") {
      issues.push({
        id: nextId(),
        severity: SEVERITY.ERROR,
        category: CATEGORY.EQUIPMENT,
        equipmentOrDevice: eq.displayLabel || eq.name,
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
      });
    }
  });

  equipment.forEach((eq) => {
    if (eq.controllerRef && (!eq.templateName || String(eq.templateName).trim() === "")) {
      issues.push({
        id: nextId(),
        severity: SEVERITY.ERROR,
        category: CATEGORY.EQUIPMENT,
        equipmentOrDevice: eq.displayLabel || eq.name,
        issue: "No template selected",
        relatedPointOrBinding: "—",
        recommendedFix: "Select an equipment template in Site Builder",
        status: "Open",
        actionTarget: ACTION_TARGET.TEMPLATE_LIBRARY,
        actionLabel: "Open in Template Library",
        whyThisMatters: "Equipment needs a template to define logical points for mapping.",
        fixSteps: "In Site Builder, select the equipment and choose a template, or add one in Template Library.",
        templatePoint: null,
        mappedBacnetObject: null,
        mappingStatus: null,
      });
    }
  });

  equipment.forEach((eq) => {
    if (!eq.controllerRef || !eq.templateName) return;
    const templatePoints = engineeringRepository.getTemplatePoints(eq.templateName);
    const eqMappings = getMappingsForEquipment(mappings, eq.id);
    templatePoints.forEach((tp) => {
      const mapped = !!eqMappings[tp.id];
      if (tp.required && !mapped) {
        issues.push({
          id: nextId(),
          severity: SEVERITY.ERROR,
          category: CATEGORY.POINT_MAPPING,
          equipmentOrDevice: eq.displayLabel || eq.name,
          issue: "Required point not mapped",
          relatedPointOrBinding: tp.displayName || tp.key,
          recommendedFix: "Map a BACnet object",
          status: "Open",
          actionTarget: ACTION_TARGET.POINT_MAPPING,
          actionLabel: "Open in Point Mapping",
          whyThisMatters: "Required template points must be mapped for the equipment to operate correctly.",
          fixSteps: `Open Point Mapping, select ${eq.displayLabel || eq.name}, and map ${tp.displayName || tp.key} to a BACnet object.`,
          templatePoint: tp.displayName || tp.key,
          mappedBacnetObject: null,
          mappingStatus: "not mapped",
        });
      } else if (!tp.required && !mapped) {
        issues.push({
          id: nextId(),
          severity: SEVERITY.WARNING,
          category: CATEGORY.POINT_MAPPING,
          equipmentOrDevice: eq.displayLabel || eq.name,
          issue: "Optional point unmapped",
          relatedPointOrBinding: tp.displayName || tp.key,
          recommendedFix: "Map in Point Mapping or ignore",
          status: "Open",
          actionTarget: ACTION_TARGET.POINT_MAPPING,
          actionLabel: "Open in Point Mapping",
          whyThisMatters: "Optional points can improve functionality but are not required for deployment.",
          fixSteps: `Optionally map ${tp.displayName || tp.key} in Point Mapping.`,
          templatePoint: tp.displayName || tp.key,
          mappedBacnetObject: null,
          mappingStatus: "optional unmapped",
        });
      }
    });
  });

  equipment.forEach((eq) => {
    if (!eq.controllerRef) return;
    const status = deviceStatusByInstance[String(eq.controllerRef)];
    if (status === "offline") {
      issues.push({
        id: nextId(),
        severity: SEVERITY.ERROR,
        category: CATEGORY.NETWORK,
        equipmentOrDevice: eq.displayLabel || eq.name,
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
      });
    }
  });

  equipment.forEach((eq) => {
    if (!eq.controllerRef) return;
    const objects = discoveredObjects[String(eq.controllerRef)] ?? [];
    if (objects.length === 0 && deviceStatusByInstance[String(eq.controllerRef)] !== "offline") {
      issues.push({
        id: nextId(),
        severity: SEVERITY.ERROR,
        category: CATEGORY.CONTROLLERS,
        equipmentOrDevice: eq.displayLabel || eq.name,
        issue: "No discovered objects for assigned controller",
        relatedPointOrBinding: "—",
        recommendedFix: "Run point discovery on the controller",
        status: "Open",
        actionTarget: ACTION_TARGET.NETWORK_DISCOVERY,
        actionLabel: "Open in Network Discovery",
        whyThisMatters: "Point mapping requires discovered BACnet objects from the controller.",
        fixSteps: "In Network Discovery, open the device assigned to this equipment and run Discover Points.",
        templatePoint: null,
        mappedBacnetObject: null,
        mappingStatus: null,
      });
    }
  });

  equipment.forEach((eq) => {
    if (!eq.templateName) return;
    const hasGraphic = graphics[eq.id] && graphics[eq.id].id;
    if (!hasGraphic) {
      issues.push({
        id: nextId(),
        severity: SEVERITY.WARNING,
        category: CATEGORY.GRAPHICS,
        equipmentOrDevice: eq.displayLabel || eq.name,
        issue: "Graphic missing",
        relatedPointOrBinding: "—",
        recommendedFix: "Create or assign a graphic",
        status: "Open",
        actionTarget: ACTION_TARGET.GRAPHICS_MANAGER,
        actionLabel: "Open in Graphics Manager",
        whyThisMatters: "Equipment without a graphic may still be deployed but will not have a visual in the operator UI.",
        fixSteps: "In Graphics Manager, create or assign a graphic template for this equipment.",
        templatePoint: null,
        mappedBacnetObject: null,
        mappingStatus: null,
      });
    }
  });

  const errors = issues.filter((i) => i.severity === SEVERITY.ERROR).length;
  const warnings = issues.filter((i) => i.severity === SEVERITY.WARNING).length;
  const byCategory = {};
  issues.forEach((i) => {
    byCategory[i.category] = (byCategory[i.category] || 0) + 1;
  });
  const summary = { errors, warnings, byCategory };
  let readiness = READINESS_STATUS.READY;
  if (errors > 0) readiness = READINESS_STATUS.BLOCKED;
  else if (warnings > 0) readiness = READINESS_STATUS.WARNINGS;

  let message = "All required checks passed.";
  if (readiness === READINESS_STATUS.BLOCKED) {
    message = `${errors} blocking issue${errors !== 1 ? "s" : ""} must be resolved before normal deployment.`;
  } else if (readiness === READINESS_STATUS.WARNINGS) {
    message = `${warnings} warning${warnings !== 1 ? "s" : ""} detected. You may still deploy using override.`;
  }

  return {
    issues,
    summary,
    readiness,
    message,
    lastRunAt: new Date().toISOString(),
  };
}

export { SEVERITY, CATEGORY, READINESS_STATUS, ACTION_TARGET };
