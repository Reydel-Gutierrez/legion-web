/**
 * Mock data for Graphics Manager page.
 * Graphics hierarchy by site/building/floor and mapped points from Point Mapping.
 */

// Graphic statuses (same pattern as other engineering pages)
export const GRAPHIC_STATUSES = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  LIVE: "Live",
};

// Graphic types for filter dropdown
export const GRAPHIC_TYPES = {
  FLOOR_PLAN: "Floor Plans",
  EQUIPMENT_DIAGRAM: "Equipment Diagrams",
  SYSTEM_VIEW: "System Views",
};

// Mapped point options (from Point Mapping - mock)
export const MOCK_MAPPED_POINTS = [
  { id: "pt-1", key: "ZoneTemp", displayName: "Zone Temp", equipmentRef: "VAV-12", units: "°F", mockValue: 72 },
  { id: "pt-2", key: "CoolingSetpoint", displayName: "Cooling Setpoint", equipmentRef: "VAV-12", units: "°F", mockValue: 74 },
  { id: "pt-3", key: "DamperPosition", displayName: "Damper Position", equipmentRef: "VAV-12", units: "%", mockValue: 45 },
  { id: "pt-4", key: "FanStatus", displayName: "Fan Status", equipmentRef: "VAV-12", units: "", mockValue: "Running" },
  { id: "pt-5", key: "Airflow", displayName: "Airflow", equipmentRef: "VAV-12", units: "CFM", mockValue: 425 },
  { id: "pt-6", key: "SupplyAirTemp", displayName: "Supply Air Temp", equipmentRef: "AHU-1", units: "°F", mockValue: 55 },
  { id: "pt-7", key: "ChillerStatus", displayName: "Chiller Status", equipmentRef: "CH-1", units: "", mockValue: "Running" },
  { id: "pt-8", key: "ValvePosition", displayName: "Valve Position", equipmentRef: "CHWP-1", units: "%", mockValue: 78 },
];

// Point binding display options
export const BINDING_DISPLAY_OPTIONS = [
  { value: "value", label: "Display Value" },
  { value: "status_color", label: "Display Status Color" },
  { value: "animation", label: "Display Animation" },
];

/**
 * Graphics by equipment ID - each equipment has its own graphic with objects.
 * Equipment IDs match mockEngineeringData (eq-m1, eq-m2, etc.)
 */
const GRAPHICS_BY_EQUIPMENT = {
  "eq-m1": {
    id: "g-eq-m1",
    equipmentId: "eq-m1",
    name: "AHU-1 Graphic",
    status: "VALIDATED",
    lastEdited: "2 hours ago",
    objects: [
      { id: "obj-m1-1", type: "text", label: "Supply Air Temp", x: 100, y: 80 },
      { id: "obj-m1-2", type: "value", label: "Point", x: 160, y: 95, bindings: [{ pointId: "tp-ahu-1", displayMode: "value" }] },
    ],
  },
  "eq-m2": {
    id: "g-eq-m2",
    equipmentId: "eq-m2",
    name: "VAV-1 Graphic",
    status: "VALIDATED",
    lastEdited: "1 day ago",
    objects: [
      { id: "obj-m2-1", type: "text", label: "Zone Temp", x: 100, y: 80 },
      { id: "obj-m2-2", type: "value", label: "Point", x: 170, y: 80, bindings: [{ pointId: "tp-vav-1", displayMode: "value" }] },
    ],
  },
  "eq-m8": {
    id: "g-eq-m8",
    equipmentId: "eq-m8",
    name: "VAV-12 Graphic",
    status: "DRAFT",
    lastEdited: "3 hours ago",
    objects: [
      { id: "obj-m8-1", type: "value", label: "Point", x: 100, y: 100, bindings: [{ pointId: "tp-vav-1", displayMode: "value" }] },
      { id: "obj-m8-2", type: "value", label: "Point", x: 180, y: 100, bindings: [{ pointId: "tp-vav-5", displayMode: "value" }] },
    ],
  },
  "eq-m14": {
    id: "g-eq-m14",
    equipmentId: "eq-m14",
    name: "CH-1 Graphic",
    status: "VALIDATED",
    lastEdited: "2 days ago",
    objects: [
      { id: "obj-m14-1", type: "text", label: "Chiller Status", x: 100, y: 80 },
      { id: "obj-m14-2", type: "value", label: "Point", x: 200, y: 80, bindings: [{ pointId: "obj-ch1-1", displayMode: "value" }] },
    ],
  },
  "eq-m15": {
    id: "g-eq-m15",
    equipmentId: "eq-m15",
    name: "CHWP-1 Graphic",
    status: "LIVE",
    lastEdited: "1 week ago",
    objects: [
      { id: "obj-m15-1", type: "text", label: "Valve Position", x: 100, y: 90 },
      { id: "obj-m15-2", type: "value", label: "Point", x: 200, y: 90, bindings: [{ pointId: "obj-pump1-1", displayMode: "value" }] },
    ],
  },
};

/**
 * Get graphic for an equipment. Returns graphic with objects or empty graphic for new equipment.
 */
export function getGraphicForEquipment(equipmentId) {
  if (!equipmentId) return null;
  const existing = GRAPHICS_BY_EQUIPMENT[equipmentId];
  if (existing) return existing;
  return {
    id: `g-new-${equipmentId}`,
    equipmentId,
    name: "New Graphic",
    status: "DRAFT",
    lastEdited: "Now",
    objects: [],
  };
}

/**
 * Miami HQ graphics hierarchy - kept for backward compatibility (filter/search)
 */
const MIAMI_HQ_GRAPHICS = {
  id: "graphics-miami-hq",
  type: "site",
  name: "Miami HQ",
  children: [
    {
      id: "graphics-tower-a",
      type: "building",
      name: "Tower A",
      parentId: "graphics-miami-hq",
      children: [
        {
          id: "g-floor1-plan",
          type: "graphic",
          name: "Floor 1 Plan",
          graphicType: "floor_plan",
          status: "VALIDATED",
          lastEdited: "2 hours ago",
          parentId: "graphics-tower-a",
          children: [],
          objects: [
            { id: "obj-1", type: "equipment", iconType: "VAV", label: "VAV-1", x: 120, y: 80, width: 40, height: 40, bindings: [{ pointId: "pt-1", displayMode: "value" }] },
            { id: "obj-2", type: "equipment", iconType: "VAV", label: "VAV-2", x: 200, y: 80, width: 40, height: 40, bindings: [] },
            { id: "obj-3", type: "text", label: "Floor 1", x: 400, y: 30 },
          ],
        },
        {
          id: "g-floor2-plan",
          type: "graphic",
          name: "Floor 2 Plan",
          graphicType: "floor_plan",
          status: "DRAFT",
          lastEdited: "1 day ago",
          parentId: "graphics-tower-a",
          children: [],
          objects: [
            { id: "obj-4", type: "equipment", iconType: "AHU", label: "AHU-2", x: 80, y: 100, width: 50, height: 50, bindings: [{ pointId: "pt-6", displayMode: "value" }] },
            { id: "obj-5", type: "equipment", iconType: "VAV", label: "VAV-12", x: 180, y: 120, width: 40, height: 40, bindings: [{ pointId: "pt-1", displayMode: "value" }, { pointId: "pt-3", displayMode: "value" }] },
          ],
        },
        {
          id: "g-mech-room",
          type: "graphic",
          name: "Mechanical Room",
          graphicType: "equipment_diagram",
          status: "LIVE",
          lastEdited: "3 days ago",
          parentId: "graphics-tower-a",
          children: [],
          objects: [
            { id: "obj-6", type: "equipment", iconType: "AHU", label: "AHU-1", x: 100, y: 80, width: 50, height: 50, bindings: [] },
          ],
        },
      ],
    },
    {
      id: "graphics-tower-b",
      type: "building",
      name: "Tower B",
      parentId: "graphics-miami-hq",
      children: [
        {
          id: "g-floor1-tb",
          type: "graphic",
          name: "Floor 1 Plan",
          graphicType: "floor_plan",
          status: "DRAFT",
          lastEdited: "5 days ago",
          parentId: "graphics-tower-b",
          children: [],
          objects: [],
        },
        {
          id: "g-floor2-tb",
          type: "graphic",
          name: "Floor 2 Plan",
          graphicType: "floor_plan",
          status: "DRAFT",
          lastEdited: "1 week ago",
          parentId: "graphics-tower-b",
          children: [],
          objects: [],
        },
      ],
    },
    {
      id: "graphics-central-plant",
      type: "building",
      name: "Central Plant",
      parentId: "graphics-miami-hq",
      children: [
        {
          id: "g-chiller-system",
          type: "graphic",
          name: "Chiller System",
          graphicType: "system_view",
          status: "VALIDATED",
          lastEdited: "2 days ago",
          parentId: "graphics-central-plant",
          children: [],
          objects: [
            { id: "obj-7", type: "equipment", iconType: "Chiller", label: "CH-1", x: 150, y: 80, width: 60, height: 50, bindings: [{ pointId: "pt-7", displayMode: "status_color" }] },
            { id: "obj-8", type: "equipment", iconType: "Pump", label: "CHWP-1", x: 250, y: 90, width: 45, height: 45, bindings: [{ pointId: "pt-8", displayMode: "value" }] },
          ],
        },
        {
          id: "g-parking-vent",
          type: "graphic",
          name: "Parking Garage Ventilation",
          graphicType: "system_view",
          status: "DRAFT",
          lastEdited: "4 days ago",
          parentId: "graphics-central-plant",
          children: [],
          objects: [],
        },
      ],
    },
  ],
};

/**
 * Flatten tree for lookup
 */
function flattenGraphicsTree(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flattenGraphicsTree(c, acc));
  return acc;
}

/**
 * Get graphics hierarchy for a site
 */
export function getMockGraphicsTree(siteName) {
  if (siteName === "Miami HQ") return MIAMI_HQ_GRAPHICS;
  if (siteName === "Parkline") {
    return {
      ...MIAMI_HQ_GRAPHICS,
      id: "graphics-parkline",
      name: "Parkline",
      children: MIAMI_HQ_GRAPHICS.children.slice(0, 1).map((b) => ({ ...b, id: `graphics-parkline-${b.id}` })),
    };
  }
  return null;
}

/**
 * Get a single graphic by id from the tree
 */
export function getGraphicById(tree, id) {
  const flat = flattenGraphicsTree(tree);
  return flat.find((n) => n.id === id) || null;
}

/**
 * Get site structure (buildings/floors) for context selector - deprecated, use mockEngineeringData
 */
export function getGraphicsContextOptions(siteName) {
  const tree = getMockGraphicsTree(siteName);
  if (!tree) return { site: siteName, buildings: [], floors: [] };
  const buildings = (tree.children || []).map((b) => ({
    id: b.id,
    name: b.name,
    floors: (b.children || [])
      .filter((c) => c.type === "graphic")
      .map((f) => ({ id: f.id, name: f.name })),
  }));
  return { site: tree.name, buildings };
}
