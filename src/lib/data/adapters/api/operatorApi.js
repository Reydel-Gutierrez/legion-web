/**
 * Operator API adapter (placeholder).
 * When USE_MOCK_DATA is false, repositories will call these instead of mock adapters.
 * Not implemented yet — backend integration upcoming.
 */

function notImplemented(name) {
  return function () {
    throw new Error(`Operator API not implemented: ${name}`);
  };
}

export const getSites = notImplemented("getSites");
export const getSiteById = notImplemented("getSiteById");
export const getOperatorSummary = notImplemented("getOperatorSummary");
export const getOperatorDashboardAlarms = notImplemented("getOperatorDashboardAlarms");
export const getAlarms = notImplemented("getAlarms");
export const getRecentEvents = notImplemented("getRecentEvents");
export const getEquipmentHealth = notImplemented("getEquipmentHealth");
export const getWeather = notImplemented("getWeather");
export const getWorkspacePointsForEquipment = notImplemented("getWorkspacePointsForEquipment");
export const getSchedules = notImplemented("getSchedules");
export const getEvents = notImplemented("getEvents");
export const getCurrentUser = notImplemented("getCurrentUser");
export const getUsers = notImplemented("getUsers");
export const getTrendEquipmentList = notImplemented("getTrendEquipmentList");
export const getTrendData = notImplemented("getTrendData");
