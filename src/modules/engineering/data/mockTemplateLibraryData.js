/**
 * Mock data for Site Template Library and Global Template Library.
 * Site templates = templates already added/imported for the current site.
 * Global templates = company-wide standards available to import into a site.
 */

export const SOURCE = {
  GLOBAL_IMPORTED: "Global Imported",
  SITE_CUSTOM: "Site Custom",
  /** Canonical starters in the Global Template Library (import to add to a site) */
  LEGION_STARTER: "Legion Starter",
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
  { value: "MSI", label: "MSI" },
  { value: "MV", label: "MV (legacy)" },
];

// Starter point definitions by equipment type (for new templates)
export const VAV_STARTER_POINTS = [
  { pointLabel: "Zone Temp", pointKey: "ZN-T", expectedType: "AI", commandType: "none", notes: "Space temperature" },
  {
    pointLabel: "Cooling Setpoint",
    pointKey: "CLG-SP",
    expectedType: "AV",
    commandType: "numeric",
    commandConfig: { min: 55, max: 80, step: 0.5, unit: "°F" },
    notes: "Cooling target",
  },
  {
    pointLabel: "Heating Setpoint",
    pointKey: "HTG-SP",
    expectedType: "AV",
    commandType: "numeric",
    commandConfig: { min: 60, max: 75, step: 0.5, unit: "°F" },
    notes: "Heating target",
  },
  {
    pointLabel: "Damper Command",
    pointKey: "DMP-CMD",
    expectedType: "AO",
    commandType: "percentage",
    commandConfig: { min: 0, max: 100, step: 1, unit: "%" },
    notes: "Command output",
  },
  { pointLabel: "Damper Position", pointKey: "DMP-POS", expectedType: "AI", commandType: "none", notes: "Actual position" },
  { pointLabel: "Airflow", pointKey: "CFM", expectedType: "AI", commandType: "none", notes: "Measured airflow" },
  { pointLabel: "Occupancy", pointKey: "OCC", expectedType: "BI", commandType: "none", notes: "Occupancy input" },
  { pointLabel: "Fan Status", pointKey: "FAN-ST", expectedType: "BI", commandType: "none", notes: "Fan proof/status" },
  { pointLabel: "Alarm State", pointKey: "ALM-ST", expectedType: "BI", commandType: "none", notes: "General alarm indication" },
];

export const AHU_STARTER_POINTS = [
  { pointLabel: "Supply Air Temp", pointKey: "SA-T", expectedType: "AI", commandType: "none", notes: "SAT sensor" },
  { pointLabel: "Return Air Temp", pointKey: "RA-T", expectedType: "AI", commandType: "none", notes: "RAT sensor" },
  { pointLabel: "Mixed Air Temp", pointKey: "MA-T", expectedType: "AI", commandType: "none", notes: "MAT sensor" },
  {
    pointLabel: "Supply Air Setpoint",
    pointKey: "SA-SP",
    expectedType: "AV",
    commandType: "numeric",
    commandConfig: { min: 50, max: 85, step: 0.5, unit: "°F" },
    notes: "SAT setpoint",
  },
  {
    pointLabel: "Cooling Valve",
    pointKey: "CLG-V",
    expectedType: "AO",
    commandType: "percentage",
    commandConfig: { min: 0, max: 100, step: 1, unit: "%" },
    notes: "Cooling valve command",
  },
  {
    pointLabel: "Heating Valve",
    pointKey: "HTG-V",
    expectedType: "AO",
    commandType: "percentage",
    commandConfig: { min: 0, max: 100, step: 1, unit: "%" },
    notes: "Heating valve command",
  },
  { pointLabel: "Fan Status", pointKey: "FAN-ST", expectedType: "BI", commandType: "none", notes: "Fan proof" },
  { pointLabel: "Filter Status", pointKey: "FLT-ST", expectedType: "BI", commandType: "none", notes: "Filter alarm" },
];

export const FCU_STARTER_POINTS = [
  { pointLabel: "Room Temp", pointKey: "RM-T", expectedType: "AI", commandType: "none", notes: "Room temperature" },
  {
    pointLabel: "Cooling Setpoint",
    pointKey: "CLG-SP",
    expectedType: "AV",
    commandType: "numeric",
    commandConfig: { min: 55, max: 80, step: 0.5, unit: "°F" },
    notes: "Cooling setpoint",
  },
  {
    pointLabel: "Valve Command",
    pointKey: "VLV-CMD",
    expectedType: "AO",
    commandType: "percentage",
    commandConfig: { min: 0, max: 100, step: 1, unit: "%" },
    notes: "Valve output",
  },
  {
    pointLabel: "Fan Speed",
    pointKey: "FAN-SP",
    expectedType: "AV",
    commandType: "percentage",
    commandConfig: { min: 0, max: 100, step: 1, unit: "%" },
    notes: "Fan speed command",
  },
  { pointLabel: "Occupancy", pointKey: "OCC", expectedType: "BI", commandType: "none", notes: "Occupancy" },
  { pointLabel: "Fan Status", pointKey: "FAN-ST", expectedType: "BI", commandType: "none", notes: "Fan proof" },
];

export const CHILLER_STARTER_POINTS = [
  { pointLabel: "Chilled Water Supply Temp", pointKey: "CHW-SUP-T", expectedType: "AI", commandType: "none", notes: "CHW supply" },
  { pointLabel: "Chilled Water Return Temp", pointKey: "CHW-RET-T", expectedType: "AI", commandType: "none", notes: "CHW return" },
  {
    pointLabel: "Chiller Setpoint",
    pointKey: "CH-SP",
    expectedType: "AV",
    commandType: "numeric",
    commandConfig: { min: 40, max: 55, step: 0.5, unit: "°F" },
    notes: "Leaving temp setpoint",
  },
  { pointLabel: "Run Status", pointKey: "RUN-ST", expectedType: "BI", commandType: "none", notes: "Run status" },
  { pointLabel: "Alarm", pointKey: "ALM", expectedType: "BI", commandType: "none", notes: "Alarm" },
];

export function getStarterPointsForEquipmentType(equipmentType) {
  const map = {
    VAV: VAV_STARTER_POINTS,
    AHU: AHU_STARTER_POINTS,
    FCU: FCU_STARTER_POINTS,
    Chiller: CHILLER_STARTER_POINTS,
    RTU: AHU_STARTER_POINTS,
    /** Legion canonical starters live in DB / working payload; avoid conflicting abbreviated mock sets */
    "VAV-CLG-ONLY": [],
    "VAV-HTG": [],
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

// Global Template Library is stored in the database and accessed via the API
// (`engineeringRepository` helpers: fetchGlobalEquipmentTemplatesList, pushGlobalEquipmentTemplate, etc.).
