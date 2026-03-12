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

// Schedules (mock list for Schedules page)
export function getSchedulesMock(/* siteId */) {
  return [
    { id: "SCH-10021", name: "AHU-1 Weekday Occupancy", equipment: "AHU-1", equipType: "AHU", point: "Occ Mode", action: "Occupied", startTime: "07:00", endTime: "18:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], enabled: true, updatedAt: "2/22/26 13:10", updatedBy: "reydel" },
    { id: "SCH-10018", name: "VAV-2 Afterhours Setback", equipment: "VAV-2", equipType: "VAV", point: "Space Temp SP", action: "Setback 78°F", startTime: "18:30", endTime: "06:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], enabled: true, updatedAt: "2/21/26 09:22", updatedBy: "tech.jorge" },
    { id: "SCH-09990", name: "OAU-1 Weekend Off", equipment: "OAU-1", equipType: "OAU", point: "Enable", action: "OFF", startTime: "00:00", endTime: "23:59", days: ["Sat", "Sun"], enabled: false, updatedAt: "2/20/26 16:44", updatedBy: "admin" },
  ];
}

// Events (full list for Events page; getRecentEvents is dashboard subset)
export function getEventsMock(/* siteId */) {
  return [
    { id: "EVT-20031", type: "Command", equipName: "VAV-2", equipType: "VAV", point: "Damper Cmd", message: "Command issued: Damper Cmd = 65%", actor: "Operator", state: "New", occurredAt: "2/22/26 14:10", severity: "Info" },
    { id: "EVT-20027", type: "Comm", equipName: "AHU-1", equipType: "AHU", point: "Device Status", message: "Device went OFFLINE (no response)", actor: "Engine", state: "New", occurredAt: "2/22/26 13:42", severity: "Warn" },
    { id: "EVT-20021", type: "Device", equipName: "OAU-1", equipType: "OAU", point: "Filter DP", message: "Point discovered and added to database", actor: "Engineering", state: "Reviewed", occurredAt: "2/22/26 11:08", severity: "Info" },
    { id: "EVT-20015", type: "User", equipName: "Site", equipType: "Miami HQ", point: "Login", message: "User logged in", actor: "reydel", state: "Reviewed", occurredAt: "2/22/26 08:01", severity: "Info" },
    { id: "EVT-20002", type: "System", equipName: "Engine-01", equipType: "System", point: "Restart", message: "Engine restarted successfully", actor: "System", state: "Reviewed", occurredAt: "2/21/26 22:17", severity: "Info" },
    { id: "EVT-19991", type: "Schedule", equipName: "AHU-1", equipType: "AHU", point: "Occ Mode", message: "Occupied Mode = ON", actor: "Schedule", state: "Reviewed", occurredAt: "2/21/26 06:00", severity: "Info" },
    { id: "EVT-19972", type: "Comm", equipName: "CHW-P-1", equipType: "Pump", point: "Device Status", message: "Device back ONLINE", actor: "Engine", state: "Reviewed", occurredAt: "2/20/26 19:33", severity: "Info" },
    { id: "EVT-19965", type: "Alarm", equipName: "OAU-1", equipType: "OAU", point: "Filter DP", message: "Filter dirty - DP high", actor: "Device", state: "Reviewed", occurredAt: "2/20/26 16:10", severity: "Major" },
    { id: "EVT-19950", type: "Command", equipName: "FCU-3", equipType: "FCU", point: "Space Temp SP", message: "Space Temp SP = 72 deg F", actor: "Operator", state: "Reviewed", occurredAt: "2/20/26 14:00", severity: "Info" },
  ];
}

// Users and current user
export function getCurrentUserMock() {
  return { username: "reydel", displayName: "Reydel Gutierrez", role: "Engineer" };
}

export function getUsersMock(/* siteId */) {
  return [
    { id: "USR-1001", username: "reydel", displayName: "Reydel Gutierrez", email: "reydel@legion.local", role: "Engineer", status: "Active", sites: ["Miami HQ", "New Site"], lastLogin: "2/22/26 14:03", createdAt: "2/01/26 09:12" },
    { id: "USR-1002", username: "tech.jorge", displayName: "Jorge M.", email: "jorge@legion.local", role: "Operator", status: "Active", sites: ["Miami HQ"], lastLogin: "2/22/26 12:55", createdAt: "2/10/26 15:41" },
    { id: "USR-1003", username: "admin", displayName: "Site Admin", email: "admin@legion.local", role: "Admin", status: "Active", sites: ["Miami HQ", "New Site"], lastLogin: "2/22/26 08:04", createdAt: "1/18/26 10:00" },
    { id: "USR-1004", username: "viewer.nina", displayName: "Nina R.", email: "nina@legion.local", role: "Viewer", status: "Active", sites: ["Miami HQ"], lastLogin: "2/21/26 19:16", createdAt: "2/15/26 11:20" },
  ];
}

// Trends: equipment list and trend data (timestamps + series)
export function getTrendEquipmentListMock(/* siteId */) {
  return [
    { id: "VAV-2", type: "VAV", label: "VAV-2 (2nd Floor East)" },
    { id: "VAV-7", type: "VAV", label: "VAV-7 (3rd Floor North)" },
    { id: "AHU-1", type: "AHU", label: "AHU-1 (Main Air Handler)" },
    { id: "FCU-3", type: "FCU", label: "FCU-3 (Amenity)" },
    { id: "OAU-1", type: "OAU", label: "OAU-1 (Outdoor Air Unit)" },
  ];
}

/** Returns { timestamps, damper, flow, dat } for given equipment and range (6H|24H|7D|14D). Mock only. */
export function getTrendDataMock(siteId, equipmentId, range) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const ms = now.getTime();
  const config =
    range === "6H" ? { points: 18, stepMin: 20 } : range === "7D" ? { points: 28, stepMin: 6 * 60 } : range === "14D" ? { points: 28, stepMin: 12 * 60 } : { points: 24, stepMin: 60 };
  const stepMs = config.stepMin * 60 * 1000;
  const rounded = Math.floor(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
  const end = new Date(rounded);
  const timestamps = [];
  for (let i = 0; i < config.points; i++) {
    timestamps.push(new Date(end.getTime() - stepMs * (config.points - 1 - i)));
  }
  const seed = (equipmentId || "").length * (range.length + 1);
  const damper = timestamps.map((_, i) => 40 + (i % 35) + (seed % 20));
  const flow = timestamps.map((_, i) => 200 + (i % 250) + ((seed * 2) % 50));
  const dat = timestamps.map((_, i) => 55 + (i % 12) + ((seed * 3) % 5));
  return { timestamps, damper, flow, dat };
}

