import { USE_MOCK_DATA, USE_HIERARCHY_API } from "../config";
import * as hierarchyRepository from "./hierarchyRepository";
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
  getTrendPointCatalogMock,
  getTrendEquipmentGroupsMock,
  getTrendLiveSnapshotMock,
} from "../adapters/mock/operatorAdapter";

export { USE_MOCK_DATA, USE_HIERARCHY_API };

// Sites — sync helpers remain mock-only; use fetchSites when USE_HIERARCHY_API is set.
export function getSites() {
  return getSitesMock();
}

export function getSiteById(siteId) {
  return getSiteByIdMock(siteId);
}

/** @returns {Promise<import("../contracts").Site[]>} */
export async function fetchSites() {
  if (USE_HIERARCHY_API) {
    return hierarchyRepository.listSites();
  }
  return Promise.resolve(getSitesMock());
}

/** @returns {Promise<import("../contracts").Site | null>} */
export async function fetchSiteById(siteId) {
  if (USE_HIERARCHY_API) {
    return hierarchyRepository.getSiteById(siteId);
  }
  return Promise.resolve(getSiteByIdMock(siteId));
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

// Equipment workspace. options.activeRelease: when set (operator), points derived from active release snapshot.
export function getWorkspacePointsForEquipment(equipmentId, equipmentName, status, options = {}) {
  const releaseData = options.activeRelease ?? options.activeDeployment;
  if (releaseData) {
    return getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status, options);
  }
  if (USE_HIERARCHY_API) {
    return [];
  }
  if (USE_MOCK_DATA) return getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status, options);
  return getWorkspacePointsForEquipmentMock(equipmentId, equipmentName, status, options);
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

/**
 * @param {string} siteId
 * @param {string} equipmentId
 * @param {string} range
 * @param {{ recordingStartedAt?: number }} [options] When set, mock delays historical samples until after logging warmup (trend session).
 */
export function getTrendData(siteId, equipmentId, range, options) {
  if (USE_MOCK_DATA) return getTrendDataMock(siteId, equipmentId, range, options);
  return getTrendDataMock(siteId, equipmentId, range, options);
}

/** Live point values (not historian) for current-value displays. */
export function getTrendLiveSnapshot(siteId, equipmentId) {
  if (USE_MOCK_DATA) return getTrendLiveSnapshotMock(siteId, equipmentId);
  return getTrendLiveSnapshotMock(siteId, equipmentId);
}

/** Point metadata for the selected equipment/device (for trend configuration). */
export function getTrendPointCatalog(siteId, equipmentId) {
  const list = getTrendEquipmentList(siteId);
  const eq = list.find((e) => e.id === equipmentId);
  if (USE_MOCK_DATA) return getTrendPointCatalogMock(equipmentId, eq);
  return getTrendPointCatalogMock(equipmentId, eq);
}

/** Equipment groups for bulk assignment (mock). */
export function getTrendEquipmentGroups(siteId) {
  if (USE_MOCK_DATA) return getTrendEquipmentGroupsMock(siteId);
  return getTrendEquipmentGroupsMock(siteId);
}

/**
 * Active release for Operator Mode. When USE_HIERARCHY_API, calls GET .../active-release.
 * Returns `{ versionNumber, status, data }` where `data` is the deployment payload, or null.
 * When the hierarchy API is off, returns null — UI uses in-memory activeRelease from EngineeringVersionProvider.
 */
export async function fetchActiveRelease(siteId) {
  if (USE_HIERARCHY_API) {
    return hierarchyRepository.fetchActiveRelease(siteId);
  }
  return null;
}

