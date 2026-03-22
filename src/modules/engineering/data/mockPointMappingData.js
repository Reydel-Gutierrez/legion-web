/**
 * Mock data for Point Mapping page.
 * Template point definitions and discovered BACnet objects for equipment mapping.
 */

// BACnet object type labels
export const BACNET_OBJECT_TYPES = {
  AI: "Analog Input",
  AO: "Analog Output",
  AV: "Analog Value",
  BI: "Binary Input",
  BO: "Binary Output",
  BV: "Binary Value",
  MV: "Multi-State Value",
  MSI: "Multi-State Input",
  MSO: "Multi-State Output",
};

// Point mapping statuses
export const MAPPING_STATUSES = {
  MAPPED: "Mapped",
  AUTO_MAPPED: "Auto-Mapped",
  MISSING: "Missing",
  OPTIONAL_UNMAPPED: "Optional Unmapped",
  TYPE_MISMATCH: "Type Mismatch",
  DUPLICATE_ASSIGNMENT: "Duplicate Assignment",
  IGNORED: "Ignored",
};

// Graphics value states: Template Point -> optional mapped BACnet Object
export const GRAPHICS_VALUE_STATES = {
  TEMPLATE_ONLY: "template_only",   // No controller; using template point only
  UNMAPPED: "unmapped",             // Controller assigned but no BACnet mapping yet
  MAPPED: "mapped",                 // Mapped and live value available
  OFFLINE: "offline",               // Controller missing or device offline
};

// ---------------------------------------------------------------------------
// Template point definitions by template name
// ---------------------------------------------------------------------------
export const TEMPLATE_POINTS = {
  "LC VAV-1832": [
    { id: "tp-vav-1", key: "ZoneTemp", displayName: "Zone Temp", expectedObjectType: "AI", required: true, units: "°F", pointCategory: "sensor", description: "Zone temperature sensor" },
    { id: "tp-vav-2", key: "CoolingSetpoint", displayName: "Cooling Setpoint", expectedObjectType: "AV", required: true, units: "°F", pointCategory: "setpoint", description: "Cooling setpoint" },
    { id: "tp-vav-3", key: "HeatingSetpoint", displayName: "Heating Setpoint", expectedObjectType: "AV", required: true, units: "°F", pointCategory: "setpoint", description: "Heating setpoint" },
    { id: "tp-vav-4", key: "DamperCommand", displayName: "Damper Command", expectedObjectType: "AO", required: true, units: "%", pointCategory: "output", description: "Damper position command" },
    { id: "tp-vav-5", key: "DamperPosition", displayName: "Damper Position", expectedObjectType: "AI", required: true, units: "%", pointCategory: "feedback", description: "Current damper position" },
    { id: "tp-vav-6", key: "Airflow", displayName: "Airflow", expectedObjectType: "AI", required: true, units: "CFM", pointCategory: "sensor", description: "Airflow rate" },
    { id: "tp-vav-7", key: "Occupancy", displayName: "Occupancy", expectedObjectType: "BI", required: true, units: "", pointCategory: "sensor", description: "Occupancy status" },
    { id: "tp-vav-8", key: "FanStatus", displayName: "Fan Status", expectedObjectType: "BI", required: true, units: "", pointCategory: "status", description: "Fan on/off status" },
    { id: "tp-vav-9", key: "DischargeAirTemp", displayName: "Discharge Air Temp", expectedObjectType: "AI", required: true, units: "°F", pointCategory: "sensor", description: "Discharge air temperature" },
    { id: "tp-vav-10", key: "SpaceHumidity", displayName: "Space Humidity", expectedObjectType: "AI", required: false, units: "%", pointCategory: "sensor", description: "Space humidity level" },
    { id: "tp-vav-11", key: "OverrideMode", displayName: "Override Mode", expectedObjectType: "MV", required: false, units: "", pointCategory: "control", description: "Override mode setting" },
    { id: "tp-vav-12", key: "AlarmState", displayName: "Alarm State", expectedObjectType: "BI", required: true, units: "", pointCategory: "alarm", description: "Alarm state" },
  ],
  "LC VMA-1832 AHU": [
    { id: "tp-ahu-1", key: "SupplyAirTemp", displayName: "Supply Air Temp", expectedObjectType: "AI", required: true, units: "°F", pointCategory: "sensor", description: "Supply air temperature" },
    { id: "tp-ahu-2", key: "ReturnAirTemp", displayName: "Return Air Temp", expectedObjectType: "AI", required: true, units: "°F", pointCategory: "sensor", description: "Return air temperature" },
    { id: "tp-ahu-3", key: "FilterStatus", displayName: "Filter Status", expectedObjectType: "BI", required: true, units: "", pointCategory: "status", description: "Filter differential pressure status" },
    { id: "tp-ahu-4", key: "SupplyFanStatus", displayName: "Supply Fan Status", expectedObjectType: "BI", required: true, units: "", pointCategory: "status", description: "Supply fan run status" },
    { id: "tp-ahu-5", key: "SupplyFanSpeed", displayName: "Supply Fan Speed", expectedObjectType: "AI", required: false, units: "%", pointCategory: "feedback", description: "Supply fan speed command" },
  ],
  "LC FCU-2-Pipe": [
    { id: "tp-fcu-1", key: "RoomTemp", displayName: "Room Temp", expectedObjectType: "AI", required: true, units: "°F", pointCategory: "sensor", description: "Room temperature" },
    { id: "tp-fcu-2", key: "Setpoint", displayName: "Setpoint", expectedObjectType: "AV", required: true, units: "°F", pointCategory: "setpoint", description: "Temperature setpoint" },
    { id: "tp-fcu-3", key: "ValvePosition", displayName: "Valve Position", expectedObjectType: "AO", required: true, units: "%", pointCategory: "output", description: "Chilled water valve command" },
    { id: "tp-fcu-4", key: "FanStatus", displayName: "Fan Status", expectedObjectType: "BI", required: true, units: "", pointCategory: "status", description: "Fan run status" },
    { id: "tp-fcu-5", key: "Occupancy", displayName: "Occupancy", expectedObjectType: "BI", required: false, units: "", pointCategory: "sensor", description: "Occupancy status" },
  ],
};

// ---------------------------------------------------------------------------
// Discovered BACnet objects by device/controller (deviceInstance or controllerRef)
// ---------------------------------------------------------------------------
export const DISCOVERED_OBJECTS_BY_DEVICE = {
  "43002": [
    { id: "obj-1", objectType: "AI", objectInstance: 1, bacnetRef: "AI-1", displayName: "Zone Temp", units: "°F", presentValue: 72.4, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-2", objectType: "AV", objectInstance: 1, bacnetRef: "AV-1", displayName: "Cooling Setpoint", units: "°F", presentValue: 74, writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-3", objectType: "AV", objectInstance: 2, bacnetRef: "AV-2", displayName: "Heating Setpoint", units: "°F", presentValue: 68, writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-4", objectType: "BO", objectInstance: 1, bacnetRef: "BO-1", displayName: "Fan Command", units: "", presentValue: "active", writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-5", objectType: "AO", objectInstance: 1, bacnetRef: "AO-1", displayName: "Damper Position Cmd", units: "%", presentValue: 65, writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-5b", objectType: "AI", objectInstance: 5, bacnetRef: "AI-5", displayName: "Damper Position", units: "%", presentValue: 64, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-6", objectType: "AI", objectInstance: 2, bacnetRef: "AI-2", displayName: "Airflow", units: "CFM", presentValue: 425, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-7", objectType: "BI", objectInstance: 1, bacnetRef: "BI-1", displayName: "Occupancy", units: "", presentValue: "active", writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-8", objectType: "BI", objectInstance: 2, bacnetRef: "BI-2", displayName: "Fan Status", units: "", presentValue: "inactive", writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-9", objectType: "AI", objectInstance: 3, bacnetRef: "AI-3", displayName: "Discharge Air Temp", units: "°F", presentValue: 58.2, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-10", objectType: "AI", objectInstance: 4, bacnetRef: "AI-4", displayName: "Space Humidity", units: "%", presentValue: 51, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-11", objectType: "MV", objectInstance: 1, bacnetRef: "MV-1", displayName: "Override Mode", units: "", presentValue: 0, writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-12", objectType: "BI", objectInstance: 3, bacnetRef: "BI-3", displayName: "Alarm State", units: "", presentValue: "inactive", writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-13", objectType: "AV", objectInstance: 8, bacnetRef: "AV-8", displayName: "Unused AV", units: "", presentValue: 0, writable: true, sourceDevice: "BACnet/IP:43002", status: "Online" },
    { id: "obj-14", objectType: "AI", objectInstance: 9, bacnetRef: "AI-9", displayName: "Unused AI", units: "", presentValue: 0, writable: false, sourceDevice: "BACnet/IP:43002", status: "Online" },
  ],
  "43001": [
    { id: "obj-d1-1", objectType: "AI", objectInstance: 1, bacnetRef: "AI-1", displayName: "Supply Air Temp", units: "°F", presentValue: 55.0, writable: false, sourceDevice: "BACnet/IP:43001", status: "Online" },
    { id: "obj-d1-2", objectType: "AI", objectInstance: 2, bacnetRef: "AI-2", displayName: "Return Air Temp", units: "°F", presentValue: 72.0, writable: false, sourceDevice: "BACnet/IP:43001", status: "Online" },
    { id: "obj-d1-3", objectType: "BI", objectInstance: 1, bacnetRef: "BI-1", displayName: "Filter Status", units: "", presentValue: "inactive", writable: false, sourceDevice: "BACnet/IP:43001", status: "Online" },
    { id: "obj-d1-4", objectType: "BI", objectInstance: 2, bacnetRef: "BI-2", displayName: "Supply Fan Status", units: "", presentValue: "active", writable: false, sourceDevice: "BACnet/IP:43001", status: "Online" },
    { id: "obj-d1-5", objectType: "AI", objectInstance: 3, bacnetRef: "AI-3", displayName: "Supply Fan Speed", units: "%", presentValue: 78, writable: false, sourceDevice: "BACnet/IP:43001", status: "Online" },
  ],
  "43100": [
    { id: "obj-ch1-1", objectType: "BI", objectInstance: 1, bacnetRef: "BI-1", displayName: "Chiller Status", units: "", presentValue: "active", writable: false, sourceDevice: "BACnet/IP:43100", status: "Online" },
    { id: "obj-ch1-2", objectType: "AI", objectInstance: 1, bacnetRef: "AI-1", displayName: "Chilled Water Supply Temp", units: "°F", presentValue: 44.0, writable: false, sourceDevice: "BACnet/IP:43100", status: "Online" },
  ],
  "43101": [
    { id: "obj-pump1-1", objectType: "AI", objectInstance: 1, bacnetRef: "AI-1", displayName: "Valve Position", units: "%", presentValue: 78, writable: false, sourceDevice: "BACnet/IP:43101", status: "Online" },
    { id: "obj-pump1-2", objectType: "BI", objectInstance: 1, bacnetRef: "BI-1", displayName: "Pump Status", units: "", presentValue: "active", writable: false, sourceDevice: "BACnet/IP:43101", status: "Online" },
  ],
};

/**
 * Get available points for an equipment (for Point Mapping / legacy).
 * Prefer discovered BACnet when controller assigned; else template points.
 * @deprecated For Graphics Manager use getPointDisplayInfoForEquipment (bind to template points only).
 */
export function getPointsForEquipment(equipment) {
  if (!equipment) return [];
  const discovered = getDiscoveredObjects(equipment.controllerRef);
  if (discovered.length > 0) {
    return discovered.map((obj) => ({
      id: obj.id,
      displayName: obj.displayName,
      bacnetRef: obj.bacnetRef,
      units: obj.units || "",
      presentValue: obj.presentValue,
    }));
  }
  const template = getTemplatePoints(equipment.templateName);
  return template.map((tp) => ({
    id: tp.id,
    displayName: tp.displayName,
    bacnetRef: tp.key,
    units: tp.units || "",
    presentValue: null,
  }));
}

// ---------------------------------------------------------------------------
// Graphics Manager: bind to Template Points only; value from mapping when available
// ---------------------------------------------------------------------------

/**
 * Template points only (for Bind Point dropdown). No controller or BACnet required.
 */
export function getTemplatePointsForGraphics(equipment) {
  if (!equipment?.templateName) return [];
  return getTemplatePoints(equipment.templateName);
}

/**
 * Mock point mappings per equipment (template point id -> BACnet object id).
 * In production this would come from Point Mapping store/API.
 * Optional draftEquipmentTemplates: when provided, used to resolve template points by name.
 */
function getMappingsForEquipment(equipment, draftEquipmentTemplates) {
  if (!equipment?.templateName) return {};
  const templatePoints = getTemplatePoints(equipment.templateName, draftEquipmentTemplates);
  if (!templatePoints.length) return {};
  if (!equipment?.controllerRef) return {};
  const discovered = getDiscoveredObjects(equipment.controllerRef);
  return autoMapPoints(templatePoints, discovered, {});
}

/**
 * Placeholder value for unmapped/template-only points (for preview/draft).
 */
function getPlaceholderValue(templatePoint) {
  if (!templatePoint) return "—";
  const u = templatePoint.units || "";
  if (templatePoint.expectedObjectType === "AI" || templatePoint.expectedObjectType === "AV") {
    if (u === "°F") return 72;
    if (u === "%") return 50;
    if (u === "CFM") return 400;
  }
  if (templatePoint.expectedObjectType === "BI" || templatePoint.expectedObjectType === "BO") return "—";
  return "—";
}

/**
 * Get display info for each template point for Graphics Manager.
 * Binding is always to logical/template point id. Value comes from mapped BACnet when available.
 * Works without discovered devices: uses template points only when no controller/mapping.
 * @param {object} equipment - Equipment with templateName (and optionally controllerRef)
 * @param {{ equipmentTemplates?: array }} [draftTemplates] - Optional draft templates for template-only sites
 */
/**
 * Template points for Graphics Manager when authoring a graphic template (no live equipment).
 */
export function getPointDisplayInfoForEquipmentTemplate(equipmentTemplate) {
  if (!equipmentTemplate) return [];
  const templatePoints = getTemplatePoints(equipmentTemplate.name, [equipmentTemplate]);
  return templatePoints.map((tp) => ({
    id: tp.id,
    displayName: tp.displayName,
    units: tp.units || "",
    key: tp.key,
    pointCategory: tp.pointCategory,
    required: tp.required,
    valueState: GRAPHICS_VALUE_STATES.TEMPLATE_ONLY,
    displayValue: getPlaceholderValue(tp),
    mappedBacnetRef: null,
    mappedBacnetId: null,
    presentValue: getPlaceholderValue(tp),
  }));
}

export function getPointDisplayInfoForEquipment(equipment, draftTemplates) {
  if (!equipment) return [];
  const draftEquipmentTemplates = draftTemplates?.equipmentTemplates;
  const templatePoints = getTemplatePoints(equipment.templateName, draftEquipmentTemplates);
  if (!templatePoints.length) return [];

  const mappings = getMappingsForEquipment(equipment, draftEquipmentTemplates);
  const discovered = getDiscoveredObjects(equipment.controllerRef);
  const controllerOffline = equipment.controllerRef && discovered.length === 0; // e.g. device not discovered yet

  return templatePoints.map((tp) => {
    const bacnetId = mappings[tp.id];
    const bacnetObj = bacnetId && discovered.find((o) => o.id === bacnetId);

    let valueState = GRAPHICS_VALUE_STATES.TEMPLATE_ONLY;
    let displayValue = getPlaceholderValue(tp);
    let mappedBacnetRef = null;
    let mappedBacnetId = null;

    if (!equipment.controllerRef) {
      valueState = GRAPHICS_VALUE_STATES.TEMPLATE_ONLY;
      displayValue = getPlaceholderValue(tp);
    } else if (controllerOffline) {
      valueState = GRAPHICS_VALUE_STATES.OFFLINE;
      displayValue = null;
      if (bacnetId) mappedBacnetRef = bacnetId; // mapping exists but device offline
    } else if (!bacnetId) {
      valueState = GRAPHICS_VALUE_STATES.UNMAPPED;
      displayValue = getPlaceholderValue(tp);
    } else if (!bacnetObj) {
      valueState = GRAPHICS_VALUE_STATES.OFFLINE;
      displayValue = null;
      mappedBacnetId = bacnetId;
    } else {
      const isOnline = (bacnetObj.status || "").toLowerCase() !== "offline";
      if (isOnline) {
        valueState = GRAPHICS_VALUE_STATES.MAPPED;
        displayValue = bacnetObj.presentValue;
        mappedBacnetRef = bacnetObj.bacnetRef;
        mappedBacnetId = bacnetObj.id;
      } else {
        valueState = GRAPHICS_VALUE_STATES.OFFLINE;
        displayValue = null;
        mappedBacnetRef = bacnetObj.bacnetRef;
        mappedBacnetId = bacnetObj.id;
      }
    }

    return {
      id: tp.id,
      displayName: tp.displayName,
      units: tp.units || "",
      key: tp.key,
      pointCategory: tp.pointCategory,
      required: tp.required,
      valueState,
      displayValue,
      mappedBacnetRef,
      mappedBacnetId,
      // presentValue: for backward compat in UI (same as displayValue for display)
      presentValue: displayValue,
    };
  });
}

// ---------------------------------------------------------------------------
// Default selected equipment context for Point Mapping page
// ---------------------------------------------------------------------------
export const DEFAULT_MAPPING_EQUIPMENT = {
  id: "eq-m8",
  site: "Miami HQ",
  building: "Tower A",
  floor: "Floor 2",
  floorId: "f-miami-ta-2",
  name: "VAV-12",
  displayLabel: "VAV-12",
  type: "VAV",
  controllerRef: "43002",
  protocol: "BACnet/IP",
  templateName: "LC VAV-1832",
  status: "READY_FOR_MAPPING",
  locationLabel: "Floor 2",
};

// Get template points for a template name (from global TEMPLATE_POINTS or draft equipment templates)
export function getTemplatePoints(templateName, draftEquipmentTemplates) {
  const fromGlobal = TEMPLATE_POINTS[templateName];
  if (fromGlobal && fromGlobal.length > 0) return fromGlobal;
  if (draftEquipmentTemplates && draftEquipmentTemplates.length > 0 && templateName) {
    const t = draftEquipmentTemplates.find(
      (x) => (x.name || "").toLowerCase() === (templateName || "").toLowerCase() || x.id === templateName
    );
    if (t && Array.isArray(t.points) && t.points.length > 0) {
      return t.points.map((p) => {
        const key = p.pointKey || p.key;
        const referenceId = (p.referenceId || "").trim() || key;
        return {
          id: p.id || p.key,
          key,
          referenceId: referenceId || undefined,
          displayName: p.pointLabel || p.displayName || p.key,
          expectedObjectType: p.expectedType || "AI",
          required: p.required !== false,
          units: p.units || "",
          pointCategory: p.pointCategory || "sensor",
          description: p.notes || p.description || "",
        };
      });
    }
  }
  return [];
}

// Get discovered objects for a controller/device
export function getDiscoveredObjects(controllerRef) {
  return DISCOVERED_OBJECTS_BY_DEVICE[controllerRef] || [];
}

// Auto-map: match template points to discovered objects by name similarity
export function autoMapPoints(templatePoints, discoveredObjects, existingMappings = {}) {
  const usedIds = new Set(Object.values(existingMappings).filter(Boolean));
  const normalize = (s) => (s || "").toLowerCase().replace(/[\s_-]/g, "");
  const results = {};

  templatePoints.forEach((tp) => {
    const existing = existingMappings[tp.id];
    if (existing) {
      results[tp.id] = existing;
      return;
    }
    const tpNorm = normalize(tp.displayName);
    const tpKeyNorm = normalize(tp.key);
    const candidates = discoveredObjects
      .filter((obj) => !usedIds.has(obj.id))
      .map((obj) => {
        const objNorm = normalize(obj.displayName);
        let score = 0;
        if (objNorm === tpNorm || objNorm === tpKeyNorm) score = 100;
        else if (tpNorm.includes(objNorm) || objNorm.includes(tpNorm)) score = 80;
        else if (tpKeyNorm.includes(objNorm) || objNorm.includes(tpKeyNorm)) score = 70;
        else {
          const wordsTp = tpNorm.split(/(?<=[a-z])(?=[A-Z])|[\s]/).filter(Boolean);
          const wordsObj = objNorm.split(/(?<=[a-z])(?=[A-Z])|[\s]/).filter(Boolean);
          const common = wordsTp.filter((w) => wordsObj.some((ow) => ow.includes(w) || w.includes(ow)));
          score = (common.length / Math.max(wordsTp.length, 1)) * 60;
        }
        return { obj, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const typeCompat = best && isObjectTypeCompatible(tp.expectedObjectType, best.obj.objectType);
    if (best && best.score >= 50 && typeCompat) {
      results[tp.id] = best.obj.id;
      usedIds.add(best.obj.id);
    }
  });

  return results;
}

// Check if BACnet object type is compatible with expected (simplified)
function isObjectTypeCompatible(expected, actual) {
  const compat = {
    AI: ["AI"],
    AO: ["AO"],
    AV: ["AV"],
    BI: ["BI"],
    BO: ["BO"],
    BV: ["BV"],
    MV: ["MV", "AV"],
  };
  const allowed = compat[expected] || [expected];
  return allowed.includes(actual);
}
