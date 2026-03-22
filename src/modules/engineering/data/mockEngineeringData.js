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
  currentSiteId: "site-miami-hq",
  sites: [
    {
      id: "site-miami-hq",
      name: "Miami HQ",
      buildings: [],
    },
  ],
  equipment: [],
};

// ---------------------------------------------------------------------------
// Site selector options — only Miami HQ and New Site (New Building = empty draft key)
// ---------------------------------------------------------------------------
export const SITE_SELECTOR_OPTIONS = {
  NEW_BUILDING: "New Building",
  NEW_SITE: "New Site",
  MIAMI_HQ: "Miami HQ",
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

/** Miami HQ equipment preview by floor - enriched with BAS metadata */
const MIAMI_HQ_EQUIPMENT = [
  { id: "eq-m1", floorId: "f-miami-ta-1", name: "AHU-1", displayLabel: "AHU-1", type: "AHU", locationLabel: "Floor 1, North Zone", controllerRef: "43001", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m2", floorId: "f-miami-ta-1", name: "VAV-1", displayLabel: "VAV-1", type: "VAV", locationLabel: "Floor 1, North Zone", controllerRef: "43002", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m3", floorId: "f-miami-ta-1", name: "VAV-2", displayLabel: "VAV-2", type: "VAV", locationLabel: "Floor 1, North Zone", controllerRef: "43003", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m4", floorId: "f-miami-ta-1", name: "VAV-3", displayLabel: "VAV-3", type: "VAV", locationLabel: "Floor 1, South Zone", controllerRef: null, protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 0, status: "MISSING_CONTROLLER", notes: "" },
  { id: "eq-m5", floorId: "f-miami-ta-1", name: "FCU-1", displayLabel: "FCU-1", type: "FCU", locationLabel: "Floor 1", controllerRef: "43010", protocol: "BACnet/IP", templateName: "LC FCU-2-Pipe", pointsDefined: 8, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m6", floorId: "f-miami-ta-2", name: "AHU-2", displayLabel: "AHU-2", type: "AHU", locationLabel: "Floor 2, North Zone", controllerRef: "43020", protocol: "BACnet/IP", templateName: "LC VMA-1832 AHU", pointsDefined: 5, status: "READY_FOR_MAPPING", notes: "" },
  { id: "eq-m7", floorId: "f-miami-ta-2", name: "VAV-11", displayLabel: "VAV-11", type: "VAV", locationLabel: "Floor 2", controllerRef: "43021", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "CONTROLLER_ASSIGNED", notes: "" },
  { id: "eq-m8", floorId: "f-miami-ta-2", name: "VAV-12", displayLabel: "VAV-12", type: "VAV", locationLabel: "Floor 2", controllerRef: "43002", protocol: "BACnet/IP", templateName: "LC VAV-1832", pointsDefined: 12, status: "READY_FOR_MAPPING", notes: "" },
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

// ---------------------------------------------------------------------------
// Network Discovery mock data (hierarchical BACnet devices by site)
// ---------------------------------------------------------------------------
const DISCOVERY_STATUS = { ONLINE: "Online", OFFLINE: "Offline", WARNING: "Warning" };

/** Miami HQ discovery: JACE, routers, MSTP trunks, VAVs, FCUs, etc. */
const MIAMI_HQ_DISCOVERY = [
  {
    id: "disc-m1-vav1",
    parentId: null,
    name: "VAV 1",
    vendor: "Johnson Controls",
    deviceInstance: "45001",
    network: "BAC/IP:0",
    macOrMstpId: "0",
    objectCount: 84,
    lastSeen: "1 minute ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: true,
    assignedEquipmentId: null,
    children: [
      {
        id: "disc-m1-vma1832",
        parentId: "disc-m1-vav1",
        name: "VMA-1832",
        vendor: "Johnson Controls",
        deviceInstance: "45001",
        network: "BAC/IP:1",
        macOrMstpId: "0",
        objectCount: 93,
        lastSeen: "7 minutes ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet/IP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
    ],
  },
  {
    id: "disc-m2-nce251",
    parentId: null,
    name: "NCE-251",
    vendor: "ControlTrends",
    deviceInstance: "45602",
    network: "BAC/IP:1",
    macOrMstpId: "0",
    objectCount: 54,
    lastSeen: "7 minutes ago",
    status: DISCOVERY_STATUS.OFFLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
  {
    id: "disc-m3-mstp15",
    parentId: null,
    name: "BACnet MSTP-15",
    vendor: "Contemporary Controls",
    deviceInstance: "MSTP-15",
    network: "BAC/IP:0",
    macOrMstpId: "3",
    objectCount: 6,
    lastSeen: "3 minutes ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet MS/TP",
    isExpandable: true,
    assignedEquipmentId: null,
    children: [
      {
        id: "disc-m3-trunk1",
        parentId: "disc-m3-mstp15",
        name: "MSTP Trunk Device 1",
        vendor: "Contemporary Controls",
        deviceInstance: "45002",
        network: "BAC/IP:0",
        macOrMstpId: "1",
        objectCount: 12,
        lastSeen: "2 minutes ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet MS/TP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
      {
        id: "disc-m3-trunk2",
        parentId: "disc-m3-mstp15",
        name: "MSTP Trunk Device 2",
        vendor: "Johnson Controls",
        deviceInstance: "45003",
        network: "BAC/IP:0",
        macOrMstpId: "2",
        objectCount: 8,
        lastSeen: "5 minutes ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet MS/TP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
    ],
  },
  {
    id: "disc-m4-router",
    parentId: null,
    name: "BACnet Router",
    vendor: "Contemporary Controls",
    deviceInstance: "MSTP-52",
    network: "BAC/IP:11",
    macOrMstpId: "2",
    objectCount: 5,
    lastSeen: "7 minutes ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet Router",
    isExpandable: true,
    assignedEquipmentId: null,
    children: [
      {
        id: "disc-m4-child1",
        parentId: "disc-m4-router",
        name: "Router Child Device 1",
        vendor: "Tridium",
        deviceInstance: "43001",
        network: "BAC/IP:11",
        macOrMstpId: "1",
        objectCount: 24,
        lastSeen: "6 minutes ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet/IP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
    ],
  },
  {
    id: "disc-m5-xcm3100",
    parentId: null,
    name: "XCM-3100",
    vendor: "Tridium",
    deviceInstance: "BAC/IP:0",
    network: "BAC/IP:0",
    macOrMstpId: "9",
    objectCount: 54,
    lastSeen: "1 minute ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
  {
    id: "disc-m6-fcu1",
    parentId: null,
    name: "FCU1",
    vendor: "Johnson Controls",
    deviceInstance: "45001",
    network: "BAC/IP:12",
    macOrMstpId: "1",
    objectCount: 54,
    lastSeen: "4 minutes ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
  {
    id: "disc-m7-nce332",
    parentId: null,
    name: "NCE-332",
    vendor: "Johnson Controls",
    deviceInstance: "60546",
    network: "BAC/IP:0",
    macOrMstpId: "3",
    objectCount: 8,
    lastSeen: "7 minutes ago",
    status: DISCOVERY_STATUS.OFFLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
  {
    id: "disc-m8-jace8000",
    parentId: null,
    name: "JACE-8000",
    vendor: "Tridium",
    deviceInstance: "43000",
    network: "BAC/IP:0",
    macOrMstpId: "0",
    objectCount: 128,
    lastSeen: "1 minute ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: true,
    assignedEquipmentId: null,
    children: [
      {
        id: "disc-m8-super1",
        parentId: "disc-m8-jace8000",
        name: "Supervisory Device 1",
        vendor: "Tridium",
        deviceInstance: "43010",
        network: "BAC/IP:0",
        macOrMstpId: "0",
        objectCount: 42,
        lastSeen: "1 minute ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet/IP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
      {
        id: "disc-m8-super2",
        parentId: "disc-m8-jace8000",
        name: "Supervisory Device 2",
        vendor: "Tridium",
        deviceInstance: "43011",
        network: "BAC/IP:0",
        macOrMstpId: "0",
        objectCount: 38,
        lastSeen: "2 minutes ago",
        status: DISCOVERY_STATUS.ONLINE,
        protocol: "BACnet/IP",
        isExpandable: false,
        assignedEquipmentId: null,
        children: [],
      },
    ],
  },
  {
    id: "disc-m9-vav2",
    parentId: null,
    name: "VAV-2",
    vendor: "Johnson Controls",
    deviceInstance: "45004",
    network: "BAC/IP:0",
    macOrMstpId: "0",
    objectCount: 84,
    lastSeen: "2 minutes ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
  {
    id: "disc-m10-ahu1",
    parentId: null,
    name: "AHU-1",
    vendor: "Johnson Controls",
    deviceInstance: "43100",
    network: "BAC/IP:0",
    macOrMstpId: "0",
    objectCount: 96,
    lastSeen: "1 minute ago",
    status: DISCOVERY_STATUS.ONLINE,
    protocol: "BACnet/IP",
    isExpandable: false,
    assignedEquipmentId: null,
    children: [],
  },
];

/** Get mock discovery devices for a site by display name. Returns null for New Site / New Building. */
export function getMockDiscoveryForSite(siteName) {
  if (siteName === "Miami HQ") return MIAMI_HQ_DISCOVERY;
  return null;
}

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

/** Get equipment for a site by display name. Only Miami HQ has data. */
export function getMockEquipmentForSite(siteName) {
  if (siteName === "Miami HQ") return MIAMI_HQ_EQUIPMENT;
  return [];
}

/** Get equipment items for a floor */
export function getEquipmentByFloorId(equipment, floorId) {
  if (!equipment || !floorId) return [];
  return equipment.filter((e) => e.floorId === floorId);
}

/** Get mock site tree for Site Builder by display name (with equipment preview). Only Miami HQ. */
export function getMockSiteTree(siteName) {
  if (siteName === "Miami HQ") return mockSiteToTree(MIAMI_HQ_SITE, MIAMI_HQ_EQUIPMENT);
  return null;
}

/** Check if site name is New Site / New Building (blank/setup mode) */
export function isNewBuildingSite(siteName) {
  return siteName === SITE_SELECTOR_OPTIONS.NEW_BUILDING || siteName === SITE_SELECTOR_OPTIONS.NEW_SITE;
}

/** Alias for isNewBuildingSite */
export function isNewBuildingFlow(siteName) {
  return isNewBuildingSite(siteName);
}

export function treeToSiteStructure(siteTree) {
  if (!siteTree) return { buildings: [] };
  const buildings = (siteTree.children || []).map((b) => ({
    id: b.id,
    name: b.name,
    floors: (b.children || []).map((f) => ({ id: f.id, name: f.name })),
  }));
  return { buildings };
}

/**
 * Enrich equipment with site, building, floor names for Point Mapping.
 * Resolves floorId against the site tree to get hierarchy labels.
 */
export function enrichEquipmentForPointMapping(equipmentList, siteTree, siteName) {
  if (!equipmentList?.length || !siteTree) return [];
  const site = siteTree.name || siteName;
  return equipmentList.map((eq) => {
    let building = "";
    let floor = "";
    if (eq.floorId) {
      for (const b of siteTree.children || []) {
        const f = (b.children || []).find((fl) => fl.id === eq.floorId);
        if (f) {
          building = b.name || "";
          floor = f.name || "";
          break;
        }
      }
    }
    return {
      ...eq,
      site: site || siteName,
      building: building || "—",
      floor: floor || "—",
      displayLabel: eq.displayLabel || eq.name,
      protocol: eq.protocol || "BACnet/IP",
    };
  });
}

/**
 * Operator Trends: equipment rows + floor groups derived from the same engineering mock
 * (Site Builder / equipment library). Uses stable equipment id (eq-m3) for API keys.
 *
 * @param {string} siteDisplayName - e.g. "Miami HQ" (matches SiteProvider)
 * @returns {{ equipment: object[]; floors: { id: string; label: string; floorName: string; buildingName: string }[] }}
 */
export function getTrendEquipmentLibraryForSite(siteDisplayName) {
  const equipment = getMockEquipmentForSite(siteDisplayName);
  const tree = getMockSiteTree(siteDisplayName);
  if (!equipment.length || !tree) {
    return { equipment: [], floors: [] };
  }
  const enriched = enrichEquipmentForPointMapping(equipment, tree, siteDisplayName);
  const floorMap = new Map();
  for (const eq of enriched) {
    if (!eq.floorId) continue;
    if (!floorMap.has(eq.floorId)) {
      floorMap.set(eq.floorId, {
        id: eq.floorId,
        label: `${eq.building} — ${eq.floor}`,
        floorName: eq.floor,
        buildingName: eq.building,
      });
    }
  }
  const floors = Array.from(floorMap.values()).sort((a, b) => {
    const c = a.buildingName.localeCompare(b.buildingName);
    if (c !== 0) return c;
    return a.floorName.localeCompare(b.floorName);
  });
  const trendEquipment = enriched.map((eq) => ({
    id: eq.id,
    name: eq.name,
    type: eq.type,
    label: `${eq.displayLabel || eq.name} · ${eq.building} · ${eq.floor}`,
    floorId: eq.floorId,
    floorName: eq.floor,
    buildingName: eq.building,
    groupId: eq.floorId,
    templateKey: eq.templateName || eq.type || "",
    locationLabel: eq.locationLabel,
  }));
  return { equipment: trendEquipment, floors };
}
