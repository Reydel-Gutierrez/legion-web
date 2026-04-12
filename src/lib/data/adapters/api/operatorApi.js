/**
 * Operator API adapter — HTTP calls will live here (GET dashboard, trends, schedules, etc.).
 * Stubs return empty or minimal shapes so the UI stays stable until endpoints exist.
 *
 * `operatorRepository` delegates to this module for data that is not already served
 * elsewhere (e.g. hierarchy for sites, alarm API for alarm events).
 */

export function getSites() {
  return [];
}

export function getSiteById(/* siteId */) {
  return null;
}

export function getOperatorSummary(/* siteId */) {
  return {
    activeAlarms: 0,
    unackedAlarms: 0,
    devicesOffline: 0,
    openTasks: 0,
    energyRuntime: null,
  };
}

export function getOperatorDashboardAlarms(/* siteId */) {
  return [];
}

export function getRecentEvents(/* siteId */) {
  return [];
}

export function getEquipmentHealth(/* siteId */) {
  return [];
}

/** @returns {Promise<null>} Replace with fetch when a weather endpoint exists. */
export function getWeather(/* siteId */) {
  return Promise.resolve(null);
}

/**
 * Workspace points without a deployment snapshot — future: runtime / historian API.
 * @returns {import("../../contracts").WorkspaceRow[]}
 */
export function getWorkspacePointsForEquipment(/* equipmentId, equipmentName, status, options */) {
  return [];
}

export function getSchedules(/* siteId */) {
  return [];
}

export function getEvents(/* siteId */) {
  return [];
}

export function getCurrentUser() {
  return { username: "", displayName: "", role: "" };
}

export function getUsers(/* siteId */) {
  return [];
}

export function getTrendEquipmentList(/* siteDisplayName */) {
  return [];
}

export function getTrendData(/* siteId, equipmentId, range, options */) {
  return {
    timestamps: [],
    series: [],
    events: [],
    damper: [],
    flow: [],
    dat: [],
    collecting: false,
    historyLoggingActive: false,
  };
}

export function getTrendPointCatalog(/* equipmentId, eq */) {
  return [];
}

export function getTrendEquipmentGroups(/* siteDisplayName */) {
  return [];
}

export function getTrendLiveSnapshot(/* siteId, equipmentId */) {
  return {};
}

export function getAlarms(/* siteId */) {
  return [];
}
