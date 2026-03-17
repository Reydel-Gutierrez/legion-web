/**
 * Mock data for Site Template Library and Global Template Library.
 * Site templates = templates already added/imported for the current site.
 * Global templates = company-wide standards available to import into a site.
 */

export const SOURCE = {
  GLOBAL_IMPORTED: "Global Imported",
  SITE_CUSTOM: "Site Custom",
  /** User-created equipment graphics (from Graphics Manager) shown in Graphic Templates tab */
  SITE_CREATED: "Site created",
};

// Expected BACnet/logical point types for template points
export const EXPECTED_POINT_TYPES = [
  { value: "AI", label: "AI" },
  { value: "AO", label: "AO" },
  { value: "AV", label: "AV" },
  { value: "BI", label: "BI" },
  { value: "BO", label: "BO" },
  { value: "BV", label: "BV" },
  { value: "MSV", label: "MSV" },
  { value: "MV", label: "MV" },
];

// Starter point definitions by equipment type (for new templates)
export const VAV_STARTER_POINTS = [
  { pointLabel: "Zone Temp", pointKey: "zoneTemp", required: true, expectedType: "AI", notes: "Space temperature" },
  { pointLabel: "Cooling Setpoint", pointKey: "coolingSetpoint", required: true, expectedType: "AV", notes: "Cooling target" },
  { pointLabel: "Heating Setpoint", pointKey: "heatingSetpoint", required: true, expectedType: "AV", notes: "Heating target" },
  { pointLabel: "Damper Command", pointKey: "damperCommand", required: true, expectedType: "AO", notes: "Command output" },
  { pointLabel: "Damper Position", pointKey: "damperPosition", required: true, expectedType: "AI", notes: "Actual position" },
  { pointLabel: "Airflow", pointKey: "airflow", required: true, expectedType: "AI", notes: "Measured airflow" },
  { pointLabel: "Occupancy", pointKey: "occupancy", required: false, expectedType: "BI", notes: "Occupancy input" },
  { pointLabel: "Fan Status", pointKey: "fanStatus", required: true, expectedType: "BI", notes: "Fan proof/status" },
  { pointLabel: "Alarm State", pointKey: "alarmState", required: true, expectedType: "BI", notes: "General alarm indication" },
];

export const AHU_STARTER_POINTS = [
  { pointLabel: "Supply Air Temp", pointKey: "supplyAirTemp", required: true, expectedType: "AI", notes: "SAT sensor" },
  { pointLabel: "Return Air Temp", pointKey: "returnAirTemp", required: true, expectedType: "AI", notes: "RAT sensor" },
  { pointLabel: "Mixed Air Temp", pointKey: "mixedAirTemp", required: true, expectedType: "AI", notes: "MAT sensor" },
  { pointLabel: "Supply Air Setpoint", pointKey: "supplyAirSetpoint", required: true, expectedType: "AV", notes: "SAT setpoint" },
  { pointLabel: "Cooling Valve", pointKey: "coolingValve", required: true, expectedType: "AO", notes: "Cooling valve command" },
  { pointLabel: "Heating Valve", pointKey: "heatingValve", required: true, expectedType: "AO", notes: "Heating valve command" },
  { pointLabel: "Fan Status", pointKey: "fanStatus", required: true, expectedType: "BI", notes: "Fan proof" },
  { pointLabel: "Filter Status", pointKey: "filterStatus", required: false, expectedType: "BI", notes: "Filter alarm" },
];

export const FCU_STARTER_POINTS = [
  { pointLabel: "Room Temp", pointKey: "roomTemp", required: true, expectedType: "AI", notes: "Room temperature" },
  { pointLabel: "Cooling Setpoint", pointKey: "coolingSetpoint", required: true, expectedType: "AV", notes: "Cooling setpoint" },
  { pointLabel: "Valve Command", pointKey: "valveCommand", required: true, expectedType: "AO", notes: "Valve output" },
  { pointLabel: "Fan Speed", pointKey: "fanSpeed", required: true, expectedType: "AV", notes: "Fan speed command" },
  { pointLabel: "Occupancy", pointKey: "occupancy", required: false, expectedType: "BI", notes: "Occupancy" },
  { pointLabel: "Fan Status", pointKey: "fanStatus", required: true, expectedType: "BI", notes: "Fan proof" },
];

export const CHILLER_STARTER_POINTS = [
  { pointLabel: "Chilled Water Supply Temp", pointKey: "chwSupplyTemp", required: true, expectedType: "AI", notes: "CHW supply" },
  { pointLabel: "Chilled Water Return Temp", pointKey: "chwReturnTemp", required: true, expectedType: "AI", notes: "CHW return" },
  { pointLabel: "Chiller Setpoint", pointKey: "chillerSetpoint", required: true, expectedType: "AV", notes: "Leaving temp setpoint" },
  { pointLabel: "Run Status", pointKey: "runStatus", required: true, expectedType: "BI", notes: "Run status" },
  { pointLabel: "Alarm", pointKey: "alarm", required: true, expectedType: "BI", notes: "Alarm" },
];

export function getStarterPointsForEquipmentType(equipmentType) {
  const map = {
    VAV: VAV_STARTER_POINTS,
    AHU: AHU_STARTER_POINTS,
    FCU: FCU_STARTER_POINTS,
    Chiller: CHILLER_STARTER_POINTS,
  };
  return map[equipmentType] ? [...map[equipmentType]] : [];
}

// ---------------------------------------------------------------------------
// Site-level templates (what this site has)
// ---------------------------------------------------------------------------

const EMPTY_SITE_TEMPLATES = {
  equipment: [],
  graphic: [],
};

function pointWithId(p, id) {
  return { id: id || `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, ...p };
}

const POPULATED_SITE_EQUIPMENT = [
  {
    id: "site-eq-1",
    name: "LC VAV-1832",
    equipmentType: "VAV",
    pointCount: 9,
    defaultGraphic: "Standard VAV Graphic",
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-15",
    description: "",
    points: VAV_STARTER_POINTS.map((p, i) => pointWithId(p, `site-eq-1-pt-${i + 1}`)),
  },
  {
    id: "site-eq-2",
    name: "LC AHU-1832",
    equipmentType: "AHU",
    pointCount: 8,
    defaultGraphic: "Standard AHU Graphic",
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-14",
    description: "",
    points: AHU_STARTER_POINTS.map((p, i) => pointWithId(p, `site-eq-2-pt-${i + 1}`)),
  },
  {
    id: "site-eq-3",
    name: "LC FCU-2Pipe",
    equipmentType: "FCU",
    pointCount: 6,
    defaultGraphic: "Standard FCU Graphic",
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-12",
    description: "",
    points: FCU_STARTER_POINTS.map((p, i) => pointWithId(p, `site-eq-3-pt-${i + 1}`)),
  },
  {
    id: "site-eq-4",
    name: "LC Chiller-500Ton",
    equipmentType: "Chiller",
    pointCount: 5,
    defaultGraphic: null,
    source: SOURCE.SITE_CUSTOM,
    lastUpdated: "2024-01-10",
    description: "",
    points: CHILLER_STARTER_POINTS.map((p, i) => pointWithId(p, `site-eq-4-pt-${i + 1}`)),
  },
];

const POPULATED_SITE_GRAPHIC = [
  {
    id: "site-gfx-1",
    name: "Standard VAV Graphic",
    appliesTo: "LC VAV-1832",
    boundPointCount: 24,
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-15",
  },
  {
    id: "site-gfx-2",
    name: "Standard AHU Graphic",
    appliesTo: "LC AHU-1832",
    boundPointCount: 42,
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-14",
  },
  {
    id: "site-gfx-3",
    name: "Standard FCU Graphic",
    appliesTo: "LC FCU-2Pipe",
    boundPointCount: 18,
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: "2024-01-12",
  },
];

/**
 * Get site templates for the current site.
 * Use useSampleData=true to get populated sample data for development.
 */
export function getSiteTemplates(siteKey, useSampleData = true) {
  if (!siteKey) return EMPTY_SITE_TEMPLATES;
  if (!useSampleData) return EMPTY_SITE_TEMPLATES;
  // For MVP: treat "New Building" / "New Site" as empty, others as populated
  if (siteKey === "New Building" || siteKey === "New Site") return EMPTY_SITE_TEMPLATES;
  return {
    equipment: [...POPULATED_SITE_EQUIPMENT],
    graphic: [...POPULATED_SITE_GRAPHIC],
  };
}

// ---------------------------------------------------------------------------
// Global Template Library (company-wide, available to import)
// ---------------------------------------------------------------------------

export const GLOBAL_EQUIPMENT_TEMPLATES = [
  { id: "global-eq-1", name: "LC VAV-1832", equipmentType: "VAV", pointCount: 24, defaultGraphicName: "Standard VAV Graphic" },
  { id: "global-eq-2", name: "LC AHU-1832", equipmentType: "AHU", pointCount: 42, defaultGraphicName: "Standard AHU Graphic" },
  { id: "global-eq-3", name: "LC FCU-2Pipe", equipmentType: "FCU", pointCount: 18, defaultGraphicName: "Standard FCU Graphic" },
  { id: "global-eq-4", name: "LC Chiller-500Ton", equipmentType: "Chiller", pointCount: 56, defaultGraphicName: null },
  { id: "global-eq-5", name: "LC VAV-2436", equipmentType: "VAV", pointCount: 28, defaultGraphicName: "Standard VAV Graphic" },
  { id: "global-eq-6", name: "LC RTU-20Ton", equipmentType: "RTU", pointCount: 32, defaultGraphicName: "Standard RTU Graphic" },
  { id: "global-eq-7", name: "LC PAC-4Pipe", equipmentType: "PAC", pointCount: 38, defaultGraphicName: null },
];

export const GLOBAL_GRAPHIC_TEMPLATES = [
  { id: "global-gfx-1", name: "Standard VAV Graphic", appliesToEquipmentType: "VAV", boundPointCount: 24 },
  { id: "global-gfx-2", name: "Standard AHU Graphic", appliesToEquipmentType: "AHU", boundPointCount: 42 },
  { id: "global-gfx-3", name: "Standard FCU Graphic", appliesToEquipmentType: "FCU", boundPointCount: 18 },
  { id: "global-gfx-4", name: "Standard RTU Graphic", appliesToEquipmentType: "RTU", boundPointCount: 32 },
  { id: "global-gfx-5", name: "Minimal VAV Graphic", appliesToEquipmentType: "VAV", boundPointCount: 12 },
];

// ---------------------------------------------------------------------------
// Save to Global Library (mutates the arrays above; used by SaveToGlobalModal)
// ---------------------------------------------------------------------------

function generateGlobalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Add a site equipment template to the global library. Call when user chooses "Save to Global Library".
 * @param {object} siteTemplate - Site template from draft.templates.equipmentTemplates
 * @returns {object} The added global row (id, name, equipmentType, pointCount, defaultGraphicName)
 */
export function addEquipmentTemplateToGlobal(siteTemplate) {
  if (!siteTemplate) return null;
  const row = {
    id: generateGlobalId("global-eq"),
    name: siteTemplate.name || "Unnamed",
    equipmentType: siteTemplate.equipmentType || siteTemplate.equipmentType || "CUSTOM",
    pointCount: siteTemplate.pointCount ?? (Array.isArray(siteTemplate.points) ? siteTemplate.points.length : 0),
    defaultGraphicName: siteTemplate.defaultGraphic || null,
  };
  GLOBAL_EQUIPMENT_TEMPLATES.push(row);
  return row;
}

/**
 * Add a site graphic template to the global library.
 * @param {object} siteTemplate - Site template from draft.templates.graphicTemplates
 * @param {array} equipmentTemplates - Site equipment templates (to resolve appliesTo name -> equipmentType)
 * @returns {object} The added global row (id, name, appliesToEquipmentType, boundPointCount)
 */
export function addGraphicTemplateToGlobal(siteTemplate, equipmentTemplates = []) {
  if (!siteTemplate) return null;
  const appliesToName = siteTemplate.appliesTo || "";
  const equipmentTemplate = (equipmentTemplates || []).find(
    (e) => (e.name || "").toLowerCase() === appliesToName.toLowerCase()
  );
  const appliesToEquipmentType = equipmentTemplate?.equipmentType || "CUSTOM";
  const row = {
    id: generateGlobalId("global-gfx"),
    name: siteTemplate.name || "Unnamed",
    appliesToEquipmentType,
    boundPointCount: siteTemplate.boundPointCount ?? 0,
  };
  GLOBAL_GRAPHIC_TEMPLATES.push(row);
  return row;
}
