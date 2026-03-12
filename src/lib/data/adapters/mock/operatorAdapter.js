import { getDashboardSummary, getRecentEvents, getDashboardAlarms, getEquipmentHealth, getWeather } from "../../mockDashboard";

// NOTE: This module is the only place in the operator stack that should
// know about the concrete mock data sources. Repositories call into this
// adapter and pages call repositories.

const DEFAULT_SITE_ID = "site-miami-hq";

export function getSitesMock() {
  /** @type {import("../../contracts").Site[]} */
  const sites = [
    { id: "site-miami-hq", name: "Miami HQ", timezone: "America/New_York", status: "Active" },
    { id: "site-new", name: "New Site", timezone: "America/New_York", status: "Draft" },
  ];
  return sites;
}

export function getSiteByIdMock(siteId) {
  const sites = getSitesMock();
  return sites.find((s) => s.id === siteId) || sites.find((s) => s.id === DEFAULT_SITE_ID) || null;
}

export function getOperatorSummaryMock(/* siteId */) {
  // Current mock summary is not site-specific.
  return getDashboardSummary();
}

export function getOperatorDashboardAlarmsMock(/* siteId */) {
  return getDashboardAlarms().map((a) => ({
    id: a.id,
    siteId: DEFAULT_SITE_ID,
    equipmentName: a.equipment,
    equipmentType: "", // not provided in dashboard mock, can be enriched later
    point: "",
    message: a.message,
    severity: a.severity,
    state: "Active",
    ack: !!a.ack,
    value: "",
    occurredAt: a.time,
    clearedAt: null,
    durationMin: null,
  }));
}

export function getAlarmsMock(/* siteId */) {
  // Centralized alarm list used by the Alarms page. This keeps the shape
  // aligned with the Alarm contract and allows reuse from the dashboard.
  /** @type {import("../../contracts").Alarm[]} */
  const alarms = [
    {
      id: "ALM-10021",
      siteId: DEFAULT_SITE_ID,
      equipmentName: "AHU-1",
      equipmentType: "AHU",
      point: "Supply Air Temp",
      message: "High SAT — above limit",
      severity: "Major",
      state: "Active",
      ack: false,
      value: "78.4°F",
      occurredAt: "2026-02-22 14:11",
      clearedAt: null,
      durationMin: null,
    },
    {
      id: "ALM-10018",
      siteId: DEFAULT_SITE_ID,
      equipmentName: "VAV-2",
      equipmentType: "VAV",
      point: "Damper Position",
      message: "Stuck damper suspected",
      severity: "Minor",
      state: "Active",
      ack: true,
      value: "0%",
      occurredAt: "2026-02-22 12:42",
      clearedAt: null,
      durationMin: null,
    },
    {
      id: "ALM-09987",
      siteId: DEFAULT_SITE_ID,
      equipmentName: "CHW-P-1",
      equipmentType: "Pump",
      point: "Run Status",
      message: "Fail to start",
      severity: "Critical",
      state: "History",
      ack: true,
      value: "OFF",
      occurredAt: "2026-02-21 09:05",
      clearedAt: "2026-02-21 09:22",
      durationMin: 17,
    },
    {
      id: "ALM-09955",
      siteId: DEFAULT_SITE_ID,
      equipmentName: "OAU-1",
      equipmentType: "OAU",
      point: "Filter DP",
      message: "Filter dirty — DP high",
      severity: "Major",
      state: "History",
      ack: false,
      value: "1.42 in.w.c.",
      occurredAt: "2026-02-20 16:10",
      clearedAt: "2026-02-20 18:41",
      durationMin: 151,
    },
    {
      id: "ALM-09902",
      siteId: DEFAULT_SITE_ID,
      equipmentName: "FCU-3",
      equipmentType: "FCU",
      point: "Condensate",
      message: "High condensate level",
      severity: "Minor",
      state: "History",
      ack: true,
      value: "TRIP",
      occurredAt: "2026-02-18 07:54",
      clearedAt: "2026-02-18 08:03",
      durationMin: 9,
    },
  ];

  return alarms;
}

export function getRecentEventsMock(/* siteId */) {
  return getRecentEvents();
}

export function getEquipmentHealthMock(/* siteId */) {
  return getEquipmentHealth();
}

export function getWeatherMock(/* siteId */) {
  return getWeather();
}

// Workspace points for operator equipment workspaces
const WORKSPACE_POINTS_BY_TYPE = {
  vav: [
    { pointId: "DA-T", name: "Discharge Air Temp", value: "72.5", unit: "°F" },
    { pointId: "SA-T", name: "Supply Air Temp", value: "55.2", unit: "°F" },
    { pointId: "Space-T", name: "Space Temperature", value: "71.0", unit: "°F" },
    { pointId: "Flow", name: "Airflow", value: "245", unit: "CFM" },
    { pointId: "Damper-Cmd", name: "Damper Command", value: "62", unit: "%" },
  ],
  ahu: [
    { pointId: "SAT", name: "Supply Air Temp", value: "55.0", unit: "°F" },
    { pointId: "MAT", name: "Mixed Air Temp", value: "62.5", unit: "°F" },
    { pointId: "Fan-Cmd", name: "Fan Command", value: "85", unit: "%" },
    { pointId: "Status", name: "Run Status", value: "On", unit: "" },
    { pointId: "Economizer", name: "Economizer Pos", value: "45", unit: "%" },
  ],
  chiller: [
    { pointId: "CWST", name: "CHW Supply Temp", value: "44.0", unit: "°F" },
    { pointId: "CWRT", name: "CHW Return Temp", value: "54.2", unit: "°F" },
    { pointId: "Status", name: "Run Status", value: "On", unit: "" },
    { pointId: "Cap", name: "Capacity", value: "78", unit: "%" },
    { pointId: "Alarms", name: "Active Alarms", value: "0", unit: "" },
  ],
};

function workspaceRowId(equipmentId, pointId) {
  return `${equipmentId}-${pointId}`;
}

export function getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status) {
  const idStr = String(equipmentId || "").toLowerCase();
  const isChiller = typeof equipmentId === "number" && equipmentId >= 9000;
  const isAhu = idStr.includes("ahu");
  let points;
  if (isChiller) points = WORKSPACE_POINTS_BY_TYPE.chiller;
  else if (isAhu) points = WORKSPACE_POINTS_BY_TYPE.ahu;
  else points = WORKSPACE_POINTS_BY_TYPE.vav;

  /** @type {import("../../contracts").WorkspaceRow[]} */
  const rows = points.map((pt) => ({
    id: workspaceRowId(equipmentId, pt.pointId),
    equipmentId,
    equipmentName,
    pointId: pt.pointId,
    pointName: pt.name,
    value: pt.unit ? `${pt.value} ${pt.unit}`.trim() : pt.value,
    units: pt.unit || "",
    status: status || "OK",
    writable: false,
  }));

  return rows;
}

