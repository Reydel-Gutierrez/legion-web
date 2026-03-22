import { getDashboardSummary, getRecentEvents, getDashboardAlarms, getEquipmentHealth, getWeather } from "../../mockDashboard";
import { getWorkspaceRowsFromDeployment } from "../../../activeDeploymentUtils";
import { getTrendEquipmentLibraryForSite } from "../../../../modules/engineering/data/mockEngineeringData";

// NOTE: This module is the only place in the operator stack that should
// know about the concrete mock data sources. Repositories call into this
// adapter and pages call repositories.

const DEFAULT_SITE_ID = "site-miami-hq";

export function getSitesMock() {
  /** @type {import("../../contracts").Site[]} */
  const sites = [
    { id: "site-miami-hq", name: "Miami HQ", timezone: "America/New_York", status: "Active" },
    { id: "site-brightline", name: "Brightline Trains", timezone: "America/New_York", status: "Active" },
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

/**
 * Get workspace points for equipment. When activeDeployment is provided (operator mode),
 * derives rows from deployed snapshot so sites without discovered devices still show logical points with Unbound status.
 */
export function getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status, options = {}) {
  const activeDeployment = options.activeDeployment;
  if (activeDeployment) {
    const rows = getWorkspaceRowsFromDeployment(activeDeployment, equipmentId, equipmentName);
    if (rows.length > 0) return rows;
  }

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
    pointReferenceId: pt.pointId,
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

// Trends: equipment + floor groups from engineering Site Builder mock (see mockEngineeringData).
/** @param {string} siteDisplayName - matches SiteProvider (e.g. "Miami HQ") */
export function getTrendEquipmentListMock(siteDisplayName) {
  const lib = getTrendEquipmentLibraryForSite(siteDisplayName || "");
  return lib.equipment;
}

/** Floor-based groups for bulk assignment (one button per building + floor). */
export function getTrendEquipmentGroupsMock(siteDisplayName) {
  const lib = getTrendEquipmentLibraryForSite(siteDisplayName || "");
  return lib.floors;
}

/**
 * BACnet-style points unique per equipment instance. IDs are `${equipmentId}::slug` so each asset has its own series keys.
 * @param {string} equipmentId
 * @param {{ name?: string; type?: string; label?: string } | null | undefined} eq - row from getTrendEquipmentListMock
 */
export function getTrendPointCatalogMock(equipmentId, eq) {
  const t = ((eq && eq.type) || "").toUpperCase();
  const assetName = (eq && (eq.name || eq.label)) || equipmentId || "Equipment";
  const shortLabel = typeof assetName === "string" ? assetName.split("·")[0].trim() : String(assetName);

  /** @type {{ slug: string; name: string; unit: string; min: number; max: number }[]} */
  let templates = [
    { slug: "cmd_pct", name: "Output command", unit: "%", min: 0, max: 100 },
    { slug: "status_word", name: "Present value / status", unit: "%", min: 0, max: 100 },
    { slug: "occ_mode", name: "Occupancy mode", unit: "enum", min: 0, max: 3 },
  ];

  if (t === "VAV") {
    templates = [
      { slug: "zone_temp", name: "Zone air temperature", unit: "°F", min: 65, max: 78 },
      { slug: "sat", name: "Supply air temperature", unit: "°F", min: 52, max: 65 },
      { slug: "airflow", name: "Airflow (actual)", unit: "CFM", min: 0, max: 2200 },
      { slug: "damper_cmd", name: "Damper position command", unit: "%", min: 0, max: 100 },
      { slug: "reheat_valve", name: "Reheat valve", unit: "%", min: 0, max: 100 },
      { slug: "cooling_cmd", name: "Cooling loop command", unit: "%", min: 0, max: 100 },
      { slug: "heat_cmd", name: "Heating loop command", unit: "%", min: 0, max: 100 },
      { slug: "flow_sp", name: "Airflow setpoint", unit: "CFM", min: 0, max: 2200 },
    ];
  } else if (t === "AHU") {
    templates = [
      { slug: "sat_sp", name: "Supply air temp setpoint", unit: "°F", min: 52, max: 58 },
      { slug: "sat_act", name: "Supply air temperature", unit: "°F", min: 50, max: 60 },
      { slug: "mat", name: "Mixed air temperature", unit: "°F", min: 55, max: 85 },
      { slug: "rat", name: "Return air temperature", unit: "°F", min: 68, max: 78 },
      { slug: "oa_damper", name: "Outside air damper", unit: "%", min: 0, max: 100 },
      { slug: "sa_fan", name: "Supply fan speed command", unit: "%", min: 0, max: 100 },
      { slug: "static_pressure", name: "Duct static pressure", unit: "in w.g.", min: 0.5, max: 3.5 },
      { slug: "humidity", name: "Supply humidity", unit: "%RH", min: 30, max: 70 },
    ];
  } else if (t === "FCU") {
    templates = [
      { slug: "space_temp", name: "Space temperature", unit: "°F", min: 68, max: 76 },
      { slug: "cw_valve", name: "Chilled water valve", unit: "%", min: 0, max: 100 },
      { slug: "hw_valve", name: "Hot water valve", unit: "%", min: 0, max: 100 },
      { slug: "fan_speed", name: "Fan speed command", unit: "%", min: 0, max: 100 },
      { slug: "entering_water", name: "Entering water temperature", unit: "°F", min: 42, max: 52 },
      { slug: "leaving_water", name: "Leaving water temperature", unit: "°F", min: 52, max: 62 },
    ];
  } else if (t === "CH" || t === "CHWP" || t === "BL" || t === "CT") {
    templates = [
      { slug: "tons", name: "Chiller load / tons", unit: "tons", min: 0, max: 500 },
      { slug: "kw", name: "Compressor power", unit: "kW", min: 0, max: 400 },
      { slug: "chw_leaving", name: "Chilled water leaving temp", unit: "°F", min: 40, max: 48 },
      { slug: "chw_entering", name: "Chilled water entering temp", unit: "°F", min: 48, max: 58 },
      { slug: "cw_entering", name: "Condenser water entering", unit: "°F", min: 75, max: 95 },
      { slug: "cw_leaving", name: "Condenser water leaving", unit: "°F", min: 85, max: 105 },
      { slug: "evap_pressure", name: "Evaporator pressure", unit: "PSIG", min: 20, max: 45 },
      { slug: "cond_pressure", name: "Condenser pressure", unit: "PSIG", min: 80, max: 180 },
    ];
  } else if (t === "EF") {
    templates = [
      { slug: "fan_cmd", name: "Fan speed command", unit: "%", min: 0, max: 100 },
      { slug: "airflow", name: "Exhaust airflow", unit: "CFM", min: 0, max: 15000 },
      { slug: "static", name: "Fan static pressure", unit: "in w.g.", min: 0.2, max: 4 },
      { slug: "motor_amps", name: "Motor current", unit: "A", min: 0, max: 45 },
      { slug: "vfd_hz", name: "VFD output frequency", unit: "Hz", min: 0, max: 60 },
    ];
  } else if (t === "HX") {
    templates = [
      { slug: "pri_enter", name: "Primary entering temp", unit: "°F", min: 40, max: 95 },
      { slug: "pri_leave", name: "Primary leaving temp", unit: "°F", min: 45, max: 100 },
      { slug: "sec_enter", name: "Secondary entering temp", unit: "°F", min: 40, max: 95 },
      { slug: "sec_leave", name: "Secondary leaving temp", unit: "°F", min: 45, max: 100 },
      { slug: "valve_pct", name: "Isolation / mixing valve", unit: "%", min: 0, max: 100 },
      { slug: "flow_gpm", name: "Water flow", unit: "GPM", min: 0, max: 900 },
    ];
  } else if (t === "SENSOR") {
    templates = [
      { slug: "co_ppm", name: "CO concentration", unit: "PPM", min: 0, max: 250 },
      { slug: "co2_ppm", name: "CO₂ concentration", unit: "PPM", min: 400, max: 2000 },
      { slug: "space_temp", name: "Space temperature", unit: "°F", min: 65, max: 80 },
      { slug: "humidity", name: "Relative humidity", unit: "%RH", min: 30, max: 70 },
    ];
  }

  const seed = (equipmentId || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return templates.map((p, i) => {
    const id = `${equipmentId}::${p.slug}`;
    const label = `${shortLabel} · ${p.name}`;
    return {
      id,
      label,
      unit: p.unit,
      min: p.min + ((seed + i) % 3),
      max: p.max + ((seed + i * 2) % 5),
    };
  });
}

function buildTrendMockEvents(pointCount, equipmentId) {
  const n = Math.max(2, pointCount);
  const seed = (equipmentId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const clamp = (v) => Math.max(0, Math.min(n - 1, v));
  const a = clamp(5 + (seed % 4));
  const b = clamp(8 + (seed % 4));
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return [
    { kind: "alarm", atIdx: clamp(3 + (seed % 6)), label: "Limit" },
    { kind: "comm_loss", startIdx: lo, endIdx: hi },
    { kind: "schedule", atIdx: clamp(Math.floor(n * 0.35) + (seed % 3)), label: "Schedule" },
    { kind: "mode", atIdx: clamp(Math.floor(n * 0.72)), label: "Mode" },
  ];
}

const TREND_WARMUP_MS = 800;
const TREND_HISTORY_READY_MS = 2200;

/**
 * Live point values (not trend history) — same equipment as real-time displays elsewhere.
 * @returns {Record<string, { value: number; unit: string }>}
 */
export function getTrendLiveSnapshotMock(siteDisplayName, equipmentId) {
  const list = getTrendEquipmentListMock(siteDisplayName);
  if (!list.length) return {};
  const eq = list.find((e) => e.id === equipmentId) || list[0];
  const catalog = getTrendPointCatalogMock(equipmentId, eq);
  const seed = (equipmentId || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = {};
  catalog.forEach((pt, i) => {
    const mid = (pt.min + pt.max) / 2;
    const w = ((seed + i * 13) % 100) / 100;
    const v = mid + (pt.max - pt.min) * 0.15 * (w - 0.5);
    out[pt.id] = { value: Math.round(Math.max(pt.min, Math.min(pt.max, v)) * 10) / 10, unit: pt.unit };
  });
  return out;
}

function parseDaysRange(range) {
  const m = typeof range === "string" && /^(\d+)D$/.exec(range);
  return m ? parseInt(m[1], 10) : null;
}

function trendRangeConfig(range) {
  if (range === "6H") return { points: 18, stepMin: 20 };
  const days = parseDaysRange(range);
  if (days != null && days > 0) {
    const stepMin = Math.max(60, Math.round((days * 24 * 60) / 28));
    return { points: 28, stepMin };
  }
  return { points: 24, stepMin: 60 };
}

/** Display window length for rolling history (aligned with toolbar ranges). */
function trendRangeSpanMs(range) {
  if (range === "6H") return 6 * 60 * 60 * 1000;
  const days = parseDaysRange(range);
  if (days != null && days > 0) return days * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function buildTrendSeriesFromTimestamps(catalog, timestamps, equipmentId, range, requireEightForEvents) {
  const seed = (equipmentId || "").length * (range.length + 1);
  const series = catalog.map((pt, pi) => {
    const values = timestamps.map((_, i) => {
      const phase = i / Math.max(1, timestamps.length - 1);
      const mid = (pt.min + pt.max) / 2;
      const amp = (pt.max - pt.min) * 0.38;
      const v =
        mid +
        amp * Math.sin(phase * Math.PI * 2.2 + seed * 0.08 + pi * 0.7) +
        ((seed + i + pi * 3) % 5);
      const clamped = Math.max(pt.min, Math.min(pt.max, v));
      return Math.round(clamped * 10) / 10;
    });
    return { pointId: pt.id, label: pt.label, unit: pt.unit, min: pt.min, max: pt.max, values };
  });
  const events =
    requireEightForEvents && timestamps.length < 8
      ? []
      : buildTrendMockEvents(timestamps.length, equipmentId);
  const damper = series[0]?.values || [];
  const flow = series[1]?.values || [];
  const dat = series[2]?.values || [];
  return { series, events, damper, flow, dat };
}

/** Evenly spaced samples from window start through window end (inclusive), trend-only — no samples before recording. */
function buildEvenlySpacedTimestamps(windowStartMs, windowEndMs, pointCount) {
  const start = Math.min(windowStartMs, windowEndMs);
  const end = Math.max(windowEndMs, start + 1);
  const n = Math.max(2, pointCount);
  const timestamps = [];
  for (let i = 0; i < n; i++) {
    timestamps.push(new Date(start + (i / (n - 1)) * (end - start)));
  }
  return timestamps;
}

function buildTrendHistoryPayload(siteDisplayName, equipmentId, range) {
  const list = getTrendEquipmentListMock(siteDisplayName);
  if (!list.length) {
    return { timestamps: [], series: [], events: [], damper: [], flow: [], dat: [] };
  }
  const eq = list.find((e) => e.id === equipmentId) || list[0];
  const catalog = getTrendPointCatalogMock(equipmentId, eq);
  const now = new Date();
  const config = trendRangeConfig(range);
  const stepMs = config.stepMin * 60 * 1000;
  const rounded = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
  const end = new Date(rounded);
  const timestamps = [];
  for (let i = 0; i < config.points; i++) {
    timestamps.push(new Date(end.getTime() - stepMs * (config.points - 1 - i)));
  }
  const { series, events, damper, flow, dat } = buildTrendSeriesFromTimestamps(
    catalog,
    timestamps,
    equipmentId,
    range,
    false
  );
  return { timestamps, series, events, damper, flow, dat };
}

/**
 * Historical samples only after `recordingStartedAt`, within the selected range window ending at `nowMs`.
 * Timestamps run from max(recordingStartedAt, now - span) through now — never before the trend was started.
 */
function buildTrendHistoryPayloadFromRecording(siteDisplayName, equipmentId, range, recordingStartedAt, nowMs, pointCount) {
  const list = getTrendEquipmentListMock(siteDisplayName);
  if (!list.length) {
    return { timestamps: [], series: [], events: [], damper: [], flow: [], dat: [] };
  }
  const eq = list.find((e) => e.id === equipmentId) || list[0];
  const catalog = getTrendPointCatalogMock(equipmentId, eq);
  const config = trendRangeConfig(range);
  const maxPoints = config.points;
  const span = trendRangeSpanMs(range);
  const windowStart = Math.max(recordingStartedAt, nowMs - span);
  const windowEnd = nowMs;
  const n = Math.min(maxPoints, Math.max(2, pointCount));
  const timestamps = buildEvenlySpacedTimestamps(windowStart, windowEnd, n);
  const { series, events, damper, flow, dat } = buildTrendSeriesFromTimestamps(
    catalog,
    timestamps,
    equipmentId,
    range,
    true
  );
  return { timestamps, series, events, damper, flow, dat };
}

/**
 * Returns { timestamps, series, events, collecting?, historyLoggingActive? }.
 * When `options.recordingStartedAt` is set, historical samples only exist after logging has run (mock warmup + ramp),
 * and timestamps never precede the moment the trend was started.
 * @param {{ recordingStartedAt?: number }} [options]
 */
export function getTrendDataMock(siteDisplayName, equipmentId, range, options = {}) {
  const full = buildTrendHistoryPayload(siteDisplayName, equipmentId, range);
  const { recordingStartedAt } = options;
  const nowMs = Date.now();
  const config = trendRangeConfig(range);
  const maxPoints = config.points;

  if (recordingStartedAt == null) {
    return { ...full, collecting: false, historyLoggingActive: false };
  }

  const elapsed = nowMs - recordingStartedAt;

  if (elapsed < TREND_WARMUP_MS) {
    return {
      timestamps: [],
      series: [],
      events: [],
      damper: [],
      flow: [],
      dat: [],
      collecting: true,
      historyLoggingActive: true,
    };
  }

  if (elapsed < TREND_HISTORY_READY_MS) {
    const t = (elapsed - TREND_WARMUP_MS) / (TREND_HISTORY_READY_MS - TREND_WARMUP_MS);
    const keep = Math.max(3, Math.min(maxPoints, Math.floor(3 + t * (maxPoints - 3))));
    return {
      ...buildTrendHistoryPayloadFromRecording(siteDisplayName, equipmentId, range, recordingStartedAt, nowMs, keep),
      collecting: true,
      historyLoggingActive: true,
    };
  }

  return {
    ...buildTrendHistoryPayloadFromRecording(siteDisplayName, equipmentId, range, recordingStartedAt, nowMs, maxPoints),
    collecting: false,
    historyLoggingActive: true,
  };
}

