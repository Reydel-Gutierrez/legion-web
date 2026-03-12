import { USE_MOCK_DATA } from "../config";
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
  getSchedulesMock,
  getEventsMock,
  getUsersMock,
  getCurrentUserMock,
  getTrendEquipmentListMock,
  getTrendDataMock,
} from "../adapters/mock/operatorAdapter";

export { USE_MOCK_DATA };

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

// Schedules
export function getSchedules(siteId) {
  if (USE_MOCK_DATA) return getSchedulesMock(siteId);
  return getSchedulesMock(siteId);
}

// Events (full list)
export function getEvents(siteId) {
  if (USE_MOCK_DATA) return getEventsMock(siteId);
  return getEventsMock(siteId);
}

// Users
export function getCurrentUser() {
  if (USE_MOCK_DATA) return getCurrentUserMock();
  return getCurrentUserMock();
}

export function getUsers(siteId) {
  if (USE_MOCK_DATA) return getUsersMock(siteId);
  return getUsersMock(siteId);
}

// Trends
export function getTrendEquipmentList(siteId) {
  if (USE_MOCK_DATA) return getTrendEquipmentListMock(siteId);
  return getTrendEquipmentListMock(siteId);
}

export function getTrendData(siteId, equipmentId, range) {
  if (USE_MOCK_DATA) return getTrendDataMock(siteId, equipmentId, range);
  return getTrendDataMock(siteId, equipmentId, range);
}

