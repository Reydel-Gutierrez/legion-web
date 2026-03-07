/**
 * Shared mock engineering data for Site Builder and Equipment Builder.
 * Structure supports future backend integration.
 */

export const EQUIPMENT_TYPES = {
  AHU: "Air Handling Unit",
  VAV: "Variable Air Volume",
  FCU: "Fan Coil Unit",
  CH: "Chiller",
  CHWP: "Chilled Water Pump",
  EF: "Exhaust Fan",
  BL: "Boiler",
  CT: "Cooling Tower",
  CUSTOM: "Custom",
};

export const EQUIPMENT_STATUSES = {
  MISSING_CONTROLLER: "Missing Controller",
  READY_FOR_MAPPING: "Ready for Mapping",
  DRAFT: "Draft",
  NEEDS_TEMPLATE: "Needs Template",
  CONTROLLER_ASSIGNED: "Controller Assigned",
};

export const EQUIPMENT_GROUPS = [
  { id: "ahus", label: "AHUs", type: "AHU" },
  { id: "vavs", label: "VAVs", type: "VAV" },
  { id: "fcus", label: "FCUs", type: "FCU" },
  { id: "chiller-plant", label: "Chiller Plant", type: "CH" },
  { id: "pumps", label: "Pumps", type: "CHWP" },
  { id: "exhaust-fans", label: "Exhaust Fans", type: "EF" },
];

export const initialEngineeringMock = {
  currentSiteId: "site-parkline",
  sites: [
    {
      id: "site-parkline",
      name: "Parkline",
      buildings: [
        {
          id: "bldg-100nw",
          name: "100NW Parkline",
          floors: [
            { id: "f-100nw-1", name: "Floor 1", sortOrder: 1 },
            { id: "f-100nw-2", name: "Floor 2", sortOrder: 2 },
            { id: "f-100nw-3", name: "Floor 3", sortOrder: 3 },
            { id: "f-100nw-roof", name: "Roof", sortOrder: 99 },
          ],
        },
      ],
    },
  ],
  equipment: [
    // Floor 1
    {
      id: "eq-ahu-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-1",
      name: "AHU-1",
      displayLabel: "AHU-1",
      type: "AHU",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VMA-1832 AHU",
      pointsDefined: 3,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 1, North Zone",
      notes: "",
      equipmentGroup: "ahus",
    },
    {
      id: "eq-vav-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-1",
      name: "VAV-1",
      displayLabel: "VAV-1",
      type: "VAV",
      controllerRef: "43001",
      protocol: "BACnet/IP",
      deviceInstance: 43001,
      templateName: "LC VAV-1832",
      pointsDefined: 12,
      status: "CONTROLLER_ASSIGNED",
      locationLabel: "Floor 1, North Zone",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-2",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-1",
      name: "VAV-2",
      displayLabel: "VAV-2",
      type: "VAV",
      controllerRef: "43002",
      protocol: "BACnet/IP",
      deviceInstance: 43002,
      templateName: "LC VAV-1832",
      pointsDefined: 12,
      status: "READY_FOR_MAPPING",
      locationLabel: "Floor 1, North Zone",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-3",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-1",
      name: "VAV-3",
      displayLabel: "VAV-3",
      type: "VAV",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VAV-1832",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 1, South Zone",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-fcu-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-1",
      name: "FCU-1",
      displayLabel: "FCU-1",
      type: "FCU",
      controllerRef: "43010",
      protocol: "BACnet/IP",
      deviceInstance: 43010,
      templateName: "LC FCU-2-Pipe",
      pointsDefined: 8,
      status: "CONTROLLER_ASSIGNED",
      locationLabel: "Floor 1",
      notes: "",
      equipmentGroup: "fcus",
    },
    // Floor 2
    {
      id: "eq-ahu-2",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-2",
      name: "AHU-2",
      displayLabel: "AHU-2",
      type: "AHU",
      controllerRef: "43020",
      protocol: "BACnet/IP",
      deviceInstance: 43020,
      templateName: "LC VMA-1832 AHU",
      pointsDefined: 5,
      status: "READY_FOR_MAPPING",
      locationLabel: "Floor 2, North Zone",
      notes: "",
      equipmentGroup: "ahus",
    },
    {
      id: "eq-vav-11",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-2",
      name: "VAV-11",
      displayLabel: "VAV-11",
      type: "VAV",
      controllerRef: "43021",
      protocol: "BACnet/IP",
      deviceInstance: 43021,
      templateName: "LC VAV-1832",
      pointsDefined: 12,
      status: "CONTROLLER_ASSIGNED",
      locationLabel: "Floor 2",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-12",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-2",
      name: "VAV-12",
      displayLabel: "VAV-12",
      type: "VAV",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VAV-1832",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 2",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-13",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-2",
      name: "VAV-13",
      displayLabel: "VAV-13",
      type: "VAV",
      controllerRef: "43023",
      protocol: "BACnet/IP",
      deviceInstance: 43023,
      templateName: null,
      pointsDefined: 0,
      status: "NEEDS_TEMPLATE",
      locationLabel: "Floor 2",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-fcu-2",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-2",
      name: "FCU-2",
      displayLabel: "FCU-2",
      type: "FCU",
      controllerRef: "43030",
      protocol: "BACnet/IP",
      deviceInstance: 43030,
      templateName: "LC FCU-2-Pipe",
      pointsDefined: 8,
      status: "CONTROLLER_ASSIGNED",
      locationLabel: "Floor 2",
      notes: "",
      equipmentGroup: "fcus",
    },
    // Floor 3
    {
      id: "eq-ahu-3",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-3",
      name: "AHU-3",
      displayLabel: "AHU-3",
      type: "AHU",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VMA-1832 AHU",
      pointsDefined: 0,
      status: "DRAFT",
      locationLabel: "Floor 3",
      notes: "Pending install",
      equipmentGroup: "ahus",
    },
    {
      id: "eq-vav-21",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-3",
      name: "VAV-21",
      displayLabel: "VAV-21",
      type: "VAV",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VAV-1832",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 3",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-22",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-3",
      name: "VAV-22",
      displayLabel: "VAV-22",
      type: "VAV",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VAV-1832",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 3",
      notes: "",
      equipmentGroup: "vavs",
    },
    {
      id: "eq-vav-23",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-3",
      name: "VAV-23",
      displayLabel: "VAV-23",
      type: "VAV",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC VAV-1832",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Floor 3",
      notes: "",
      equipmentGroup: "vavs",
    },
    // Roof
    {
      id: "eq-ch-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-roof",
      name: "CH-1",
      displayLabel: "CH-1",
      type: "CH",
      controllerRef: "43100",
      protocol: "BACnet/IP",
      deviceInstance: 43100,
      templateName: "LC Chiller-500Ton",
      pointsDefined: 24,
      status: "CONTROLLER_ASSIGNED",
      locationLabel: "Roof Level",
      notes: "",
      equipmentGroup: "chiller-plant",
    },
    {
      id: "eq-chwp-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-roof",
      name: "CHWP-1",
      displayLabel: "CHWP-1",
      type: "CHWP",
      controllerRef: "43101",
      protocol: "BACnet/IP",
      deviceInstance: 43101,
      templateName: "LC CHWP-VFD",
      pointsDefined: 10,
      status: "READY_FOR_MAPPING",
      locationLabel: "Roof Level",
      notes: "",
      equipmentGroup: "pumps",
    },
    {
      id: "eq-ef-1",
      siteId: "site-parkline",
      buildingId: "bldg-100nw",
      floorId: "f-100nw-roof",
      name: "EF-1",
      displayLabel: "EF-1",
      type: "EF",
      controllerRef: null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: "LC ExhaustFan",
      pointsDefined: 0,
      status: "MISSING_CONTROLLER",
      locationLabel: "Roof Level",
      notes: "",
      equipmentGroup: "exhaust-fans",
    },
  ],
};

// ---------------------------------------------------------------------------
// Site Selector options and mock site data for Site Builder
// ---------------------------------------------------------------------------
export const SITE_SELECTOR_OPTIONS = {
  NEW_BUILDING: "New Building",
  MIAMI_HQ: "Miami HQ",
  PARKLINE: "Parkline",
};

/** Miami HQ: Tower A, Tower B, Parking Garage with equipment */
const MIAMI_HQ_SITE = {
  id: "site-miami-hq",
  name: "Miami HQ",
  siteType: "Office",
  address: "100 Legion Way, Miami, FL",
  timezone: "America/New_York",
  buildings: [
    {
      id: "bldg-miami-tower-a",
      name: "Tower A",
      buildingType: "Office Tower",
      buildingCode: "TA",
      floors: [
        { id: "f-miami-ta-1", name: "Floor 1", sortOrder: 1, floorType: "Standard Floor" },
        { id: "f-miami-ta-2", name: "Floor 2", sortOrder: 2, floorType: "Standard Floor" },
        { id: "f-miami-ta-3", name: "Floor 3", sortOrder: 3, floorType: "Standard Floor" },
        { id: "f-miami-ta-4", name: "Floor 4", sortOrder: 4, floorType: "Standard Floor" },
        { id: "f-miami-ta-5", name: "Floor 5", sortOrder: 5, floorType: "Standard Floor" },
        { id: "f-miami-ta-roof", name: "Roof", sortOrder: 99, floorType: "Roof" },
      ],
    },
    {
      id: "bldg-miami-tower-b",
      name: "Tower B",
      buildingType: "Office Tower",
      buildingCode: "TB",
      floors: [
        { id: "f-miami-tb-1", name: "Floor 1", sortOrder: 1, floorType: "Standard Floor" },
        { id: "f-miami-tb-2", name: "Floor 2", sortOrder: 2, floorType: "Standard Floor" },
        { id: "f-miami-tb-3", name: "Floor 3", sortOrder: 3, floorType: "Standard Floor" },
        { id: "f-miami-tb-mech", name: "Mechanical Level", sortOrder: 98, floorType: "Mechanical Level" },
      ],
    },
    {
      id: "bldg-miami-garage",
      name: "Parking Garage",
      buildingType: "Garage",
      buildingCode: "PG",
      floors: [
        { id: "f-miami-pg-1", name: "Level 1", sortOrder: 1, floorType: "Parking Level" },
        { id: "f-miami-pg-2", name: "Level 2", sortOrder: 2, floorType: "Parking Level" },
        { id: "f-miami-pg-roof", name: "Roof", sortOrder: 99, floorType: "Roof" },
      ],
    },
  ],
};

/** Parkline: 100NW and 400NW with floors */
const PARKLINE_SITE = {
  id: "site-parkline",
  name: "Parkline",
  siteType: "Office",
  address: "100 NW Parkline Ave, Portland, OR",
  timezone: "America/Los_Angeles",
  buildings: [
    {
      id: "bldg-100nw",
      name: "100NW Parkline",
      buildingType: "Office Tower",
      buildingCode: "100NW",
      floors: [
        { id: "f-100nw-1", name: "Floor 1", sortOrder: 1, floorType: "Standard Floor" },
        { id: "f-100nw-2", name: "Floor 2", sortOrder: 2, floorType: "Standard Floor" },
        { id: "f-100nw-3", name: "Floor 3", sortOrder: 3, floorType: "Standard Floor" },
        { id: "f-100nw-roof", name: "Roof", sortOrder: 99, floorType: "Roof" },
      ],
    },
    {
      id: "bldg-400nw",
      name: "400NW Parkline",
      buildingType: "Office Tower",
      buildingCode: "400NW",
      floors: [
        { id: "f-400nw-1", name: "Floor 1", sortOrder: 1, floorType: "Standard Floor" },
        { id: "f-400nw-2", name: "Floor 2", sortOrder: 2, floorType: "Standard Floor" },
        { id: "f-400nw-3", name: "Floor 3", sortOrder: 3, floorType: "Standard Floor" },
        { id: "f-400nw-roof", name: "Roof", sortOrder: 99, floorType: "Roof" },
      ],
    },
  ],
};

/** Miami HQ equipment preview by floor - enriched with BAS metadata */
const MIAMI_HQ_EQUIPMENT = [
  { id: "eq-m1", floorId: "f-miami-ta-1", name: "AHU-1", displayLabel: "AHU-1", type: "AHU", locationLabel: "Floor 1, North Zone", controllerRef: "43001", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m2", floorId: "f-miami-ta-1", name: "VAV-1", displayLabel: "VAV-1", type: "VAV", locationLabel: "Floor 1, North Zone", controllerRef: "43002", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m3", floorId: "f-miami-ta-1", name: "VAV-2", displayLabel: "VAV-2", type: "VAV", locationLabel: "Floor 1, North Zone", controllerRef: "43003", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m4", floorId: "f-miami-ta-1", name: "VAV-3", displayLabel: "VAV-3", type: "VAV", locationLabel: "Floor 1, South Zone", controllerRef: null, protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 0, status: "MISSING_CONTROLLER", notes: "" },
  { id: "eq-m5", floorId: "f-miami-ta-1", name: "FCU-1", displayLabel: "FCU-1", type: "FCU", locationLabel: "Floor 1", controllerRef: "43010", protocol: "BACnet/IP", templateName: "LC FCU-2-Pipe", pointsDefined: 8, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m6", floorId: "f-miami-ta-2", name: "AHU-2", displayLabel: "AHU-2", type: "AHU", locationLabel: "Floor 2, North Zone", controllerRef: "43020", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m7", floorId: "f-miami-ta-2", name: "VAV-11", displayLabel: "VAV-11", type: "VAV", locationLabel: "Floor 2", controllerRef: "43021", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m8", floorId: "f-miami-ta-2", name: "VAV-12", displayLabel: "VAV-12", type: "VAV", locationLabel: "Floor 2", controllerRef: null, protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 0, status: "MISSING_CONTROLLER", notes: "" },
  { id: "eq-m9", floorId: "f-miami-ta-2", name: "FCU-2", displayLabel: "FCU-2", type: "FCU", locationLabel: "Floor 2", controllerRef: "43030", protocol: "BACnet/IP", templateName: "LC FCU-2-Pipe", pointsDefined: 8, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m10", floorId: "f-miami-ta-3", name: "AHU-3", displayLabel: "AHU-3", type: "AHU", locationLabel: "Floor 3", controllerRef: "43040", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m11", floorId: "f-miami-ta-3", name: "VAV-21", displayLabel: "VAV-21", type: "VAV", locationLabel: "Floor 3", controllerRef: "43041", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m12", floorId: "f-miami-ta-3", name: "VAV-22", displayLabel: "VAV-22", type: "VAV", locationLabel: "Floor 3", controllerRef: "43042", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m13", floorId: "f-miami-ta-3", name: "VAV-23", displayLabel: "VAV-23", type: "VAV", locationLabel: "Floor 3", controllerRef: null, protocol: "BACnet/IP", templateName: null, pointsDefined: 0, status: "NEEDS_TEMPLATE", notes: "" },
  { id: "eq-m14", floorId: "f-miami-ta-roof", name: "CH-1", displayLabel: "CH-1", type: "CH", locationLabel: "Roof Level", controllerRef: "43100", protocol: "BACnet/IP", templateName: "LC Chiller-500Ton", pointsDefined: 24, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m15", floorId: "f-miami-ta-roof", name: "CHWP-1", displayLabel: "CHWP-1", type: "CHWP", locationLabel: "Roof Level", controllerRef: "43101", protocol: "BACnet/IP", templateName: "LC CHWP-VFD", pointsDefined: 10, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m16", floorId: "f-miami-ta-roof", name: "EF-1", displayLabel: "EF-1", type: "EF", locationLabel: "Roof Level", controllerRef: null, protocol: "BACnet/IP", templateName: "LC ExhaustFan", pointsDefined: 0, status: "MISSING_CONTROLLER", notes: "" },
  { id: "eq-m17", floorId: "f-miami-tb-1", name: "AHU-4", displayLabel: "AHU-4", type: "AHU", locationLabel: "Floor 1", controllerRef: "43201", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m18", floorId: "f-miami-tb-1", name: "VAV-31", displayLabel: "VAV-31", type: "VAV", locationLabel: "Floor 1", controllerRef: "43202", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m19", floorId: "f-miami-tb-1", name: "VAV-32", displayLabel: "VAV-32", type: "VAV", locationLabel: "Floor 1", controllerRef: null, protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 0, status: "MISSING_CONTROLLER", notes: "" },
  { id: "eq-m20", floorId: "f-miami-tb-2", name: "AHU-5", displayLabel: "AHU-5", type: "AHU", locationLabel: "Floor 2", controllerRef: "43220", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m21", floorId: "f-miami-tb-2", name: "VAV-21", displayLabel: "VAV-21", type: "VAV", locationLabel: "Floor 2", controllerRef: "43221", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m22", floorId: "f-miami-tb-2", name: "VAV-22", displayLabel: "VAV-22", type: "VAV", locationLabel: "Floor 2", controllerRef: "43222", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m23", floorId: "f-miami-tb-mech", name: "CHWP-2", displayLabel: "CHWP-2", type: "CHWP", locationLabel: "Mechanical Level", controllerRef: "43250", protocol: "BACnet/IP", templateName: "LC CHWP-VFD", pointsDefined: 10, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m24", floorId: "f-miami-tb-mech", name: "HX-1", displayLabel: "HX-1", type: "HX", locationLabel: "Mechanical Level", controllerRef: "43251", protocol: "BACnet/IP", templateName: "LC HX-Plate", pointsDefined: 6, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m25", floorId: "f-miami-pg-1", name: "EF-10", displayLabel: "EF-10", type: "EF", locationLabel: "Level 1", controllerRef: "43301", protocol: "BACnet/IP", templateName: "LC ExhaustFan", pointsDefined: 4, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m26", floorId: "f-miami-pg-1", name: "EF-11", displayLabel: "EF-11", type: "EF", locationLabel: "Level 1", controllerRef: "43302", protocol: "BACnet/IP", templateName: "LC ExhaustFan", pointsDefined: 4, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m27", floorId: "f-miami-pg-1", name: "CO-SENSOR-1", displayLabel: "CO-SENSOR-1", type: "Sensor", locationLabel: "Level 1", controllerRef: "43310", protocol: "BACnet/IP", templateName: "LC CO-Sensor", pointsDefined: 2, status: "CONTROLLER_ASSIGNED", notes: "" },
];

/** Parkline equipment (from initialEngineeringMock, plus 400NW with full metadata) */
const PARKLINE_EQUIPMENT = [
  ...initialEngineeringMock.equipment.map((e) => ({
    ...e,
    displayLabel: e.displayLabel || e.name,
    locationLabel: e.locationLabel || (e.floorId ? "Floor" : "—"),
    controllerRef: e.controllerRef ?? null,
    protocol: e.protocol || "BACnet/IP",
    templateName: e.templateName || null,
    pointsDefined: e.pointsDefined ?? 0,
    status: e.status || "MISSING_CONTROLLER",
    notes: e.notes || "",
  })),
  { id: "eq-400nw-1", floorId: "f-400nw-1", name: "AHU-1", displayLabel: "AHU-1", type: "AHU", locationLabel: "Floor 1", controllerRef: "44001", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-400nw-2", floorId: "f-400nw-1", name: "VAV-1", displayLabel: "VAV-1", type: "VAV", locationLabel: "Floor 1", controllerRef: "44002", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-400nw-3", floorId: "f-400nw-2", name: "AHU-2", displayLabel: "AHU-2", type: "AHU", locationLabel: "Floor 2", controllerRef: "44020", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-400nw-4", floorId: "f-400nw-roof", name: "CH-1", displayLabel: "CH-1", type: "CH", locationLabel: "Roof Level", controllerRef: "44100", protocol: "BACnet/IP", templateName: "LC Chiller-500Ton", pointsDefined: 24, status: "CONTROLLER_ASSIGNED", notes: "" },
];

/** Convert flat mock site to Site Builder tree format, with equipment preview on floors */
function mockSiteToTree(siteData, equipmentList = []) {
  if (!siteData) return null;
  const siteId = siteData.id;
  const siteNode = {
    id: siteId,
    type: "site",
    name: siteData.name,
    siteType: siteData.siteType,
    address: siteData.address,
    timezone: siteData.timezone,
    status: siteData.status,
    parentId: null,
    children: [],
  };
  (siteData.buildings || []).forEach((b) => {
    const bldgId = b.id;
    const bldgNode = {
      id: bldgId,
      type: "building",
      name: b.name,
      buildingType: b.buildingType,
      buildingCode: b.buildingCode,
      sortOrder: b.sortOrder,
      status: b.status || "Active",
      parentId: siteId,
      children: [],
    };
    (b.floors || []).forEach((f) => {
      const floorEq = (equipmentList || []).filter((e) => e.floorId === f.id);
      bldgNode.children.push({
        id: f.id,
        type: "floor",
        name: f.name,
        floorType: f.floorType,
        occupancyType: f.occupancyType,
        sortOrder: f.sortOrder ?? 0,
        parentId: bldgId,
        equipmentCount: floorEq.length,
        equipmentPreview: floorEq,
        children: [],
      });
    });
    siteNode.children.push(bldgNode);
  });
  return siteNode;
}

/** Get equipment for a site by display name */
export function getMockEquipmentForSite(siteName) {
  if (siteName === "Miami HQ") return MIAMI_HQ_EQUIPMENT;
  if (siteName === "Parkline") return PARKLINE_EQUIPMENT;
  return [];
}

/** Get equipment items for a floor */
export function getEquipmentByFloorId(equipment, floorId) {
  if (!equipment || !floorId) return [];
  return equipment.filter((e) => e.floorId === floorId);
}

/** Get mock site tree for Site Builder by display name (with equipment preview) */
export function getMockSiteTree(siteName) {
  if (siteName === "Miami HQ") return mockSiteToTree(MIAMI_HQ_SITE, MIAMI_HQ_EQUIPMENT);
  if (siteName === "Parkline") return mockSiteToTree(PARKLINE_SITE, PARKLINE_EQUIPMENT);
  return null;
}

/** Check if site name is New Building (blank/setup mode) */
export function isNewBuildingSite(siteName) {
  return siteName === SITE_SELECTOR_OPTIONS.NEW_BUILDING;
}

/** Alias for isNewBuildingSite */
export function isNewBuildingFlow(siteName) {
  return isNewBuildingSite(siteName);
}

/** Derive buildings/floors from Site Builder tree for AddEquipmentModal */
export function treeToSiteStructure(siteTree) {
  if (!siteTree) return { buildings: [] };
  const buildings = (siteTree.children || []).map((b) => ({
    id: b.id,
    name: b.name,
    floors: (b.children || []).map((f) => ({ id: f.id, name: f.name })),
  }));
  return { buildings };
}
