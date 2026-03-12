import {
  getSitesMock,
  getSiteByIdMock,
  getOperatorSummaryMock,
  getOperatorDashboardAlarmsMock,
  getAlarmsMock,
  getRecentEventsMock,
  getEquipmentHealthMock,
  getWeatherMock,
  getWorkspacePointsForEquipmentMock,
} from "../adapters/mock/operatorAdapter";

// Simple toggle so we can swap mock -> API later without touching pages.
// By default we use mock data until a backend is available.
export const USE_MOCK_DATA =
  typeof process !== "undefined" && process.env && process.env.REACT_APP_USE_MOCK_DATA === "false"
    ? false
    : true;

// Sites
export function getSites() {
  if (USE_MOCK_DATA) return getSitesMock();
  // TODO: replace with real API adapter
  return getSitesMock();
}

export function getSiteById(siteId) {
  if (USE_MOCK_DATA) return getSiteByIdMock(siteId);
  return getSiteByIdMock(siteId);
}

// Dashboard
export function getOperatorSummary(siteId) {
  if (USE_MOCK_DATA) return getOperatorSummaryMock(siteId);
  return getOperatorSummaryMock(siteId);
}

export function getOperatorDashboardAlarms(siteId) {
  if (USE_MOCK_DATA) return getOperatorDashboardAlarmsMock(siteId);
  return getOperatorDashboardAlarmsMock(siteId);
}

export function getRecentEvents(siteId) {
  if (USE_MOCK_DATA) return getRecentEventsMock(siteId);
  return getRecentEventsMock(siteId);
}

export function getEquipmentHealth(siteId) {
  if (USE_MOCK_DATA) return getEquipmentHealthMock(siteId);
  return getEquipmentHealthMock(siteId);
}

export function getWeather(siteId) {
  if (USE_MOCK_DATA) return getWeatherMock(siteId);
  return getWeatherMock(siteId);
}

// Alarms
export function getAlarms(siteId) {
  if (USE_MOCK_DATA) return getAlarmsMock(siteId);
  return getAlarmsMock(siteId);
}

// Equipment workspace
export function getWorkspacePointsForEquipment(equipmentId, equipmentName, status) {
  if (USE_MOCK_DATA) return getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status);
  return getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status);
}

