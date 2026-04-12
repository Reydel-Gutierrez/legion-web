import { USE_HIERARCHY_API } from "../config";
import { isBackendSiteId } from "../siteIdUtils";
import * as hierarchyRepository from "./hierarchyRepository";
import * as alarmApi from "../adapters/api/alarmApiAdapter";
import * as operatorApi from "../adapters/api/operatorApi";
import { getWorkspacePointsForEquipmentFromRelease } from "../workspacePointsFromRelease";

export { USE_MOCK_DATA, USE_HIERARCHY_API } from "../config";

// Sites — prefer fetchSites / fetchSiteById; sync helpers match operatorApi until backed by cache.
export function getSites() {
  return operatorApi.getSites();
}

export function getSiteById(siteId) {
  return operatorApi.getSiteById(siteId);
}

/** @returns {Promise<import("../contracts").Site[]>} */
export async function fetchSites() {
  if (USE_HIERARCHY_API) {
    return hierarchyRepository.listSites();
  }
  return Promise.resolve(operatorApi.getSites());
}

/** @returns {Promise<import("../contracts").Site | null>} */
export async function fetchSiteById(siteId) {
  if (USE_HIERARCHY_API) {
    return hierarchyRepository.getSiteById(siteId);
  }
  return Promise.resolve(operatorApi.getSiteById(siteId));
}

// Dashboard
export function getOperatorSummary(siteId) {
  return operatorApi.getOperatorSummary(siteId);
}

export function getOperatorDashboardAlarms(siteId) {
  return operatorApi.getOperatorDashboardAlarms(siteId);
}

export function getRecentEvents(siteId) {
  return operatorApi.getRecentEvents(siteId);
}

export function getEquipmentHealth(siteId) {
  return operatorApi.getEquipmentHealth(siteId);
}

export function getWeather(siteId) {
  return operatorApi.getWeather(siteId);
}

// Alarms — real `AlarmEvent` rows from the API/DB (no mock fallback).
/** @returns {import("../contracts").Alarm[]} */
export function getAlarms() {
  return [];
}

/** @returns {Promise<import("../contracts").Alarm[]>} */
export async function fetchAlarmsForSite(siteId) {
  if (!siteId || !isBackendSiteId(siteId)) {
    return [];
  }
  const events = await alarmApi.listAlarmEvents(siteId, {});
  const list = Array.isArray(events) ? events : [];
  return list.map(alarmApi.mapAlarmEventToAlarmRow);
}

export async function createOperatorAlarmDefinition(siteId, body) {
  if (!isBackendSiteId(siteId)) {
    throw new Error("Alarm configuration requires an API-backed site");
  }
  return alarmApi.createAlarmDefinition(siteId, body);
}

/** @returns {Promise<object[]>} */
export async function listOperatorAlarmDefinitions(siteId, query = {}) {
  if (!siteId || !isBackendSiteId(siteId)) {
    return [];
  }
  const rows = await alarmApi.listAlarmDefinitions(siteId, query);
  return Array.isArray(rows) ? rows : [];
}

export async function updateOperatorAlarmDefinition(siteId, definitionId, body) {
  if (!isBackendSiteId(siteId)) {
    throw new Error("Alarm configuration requires an API-backed site");
  }
  return alarmApi.updateAlarmDefinition(siteId, definitionId, body);
}

export async function deleteOperatorAlarmDefinition(siteId, definitionId) {
  if (!isBackendSiteId(siteId)) {
    throw new Error("Alarm configuration requires an API-backed site");
  }
  return alarmApi.deleteAlarmDefinition(siteId, definitionId);
}

export async function acknowledgeOperatorAlarmEvent(siteId, eventId) {
  if (!isBackendSiteId(siteId)) return;
  await alarmApi.acknowledgeAlarmEvent(siteId, eventId);
}

export async function triggerOperatorAlarmEvaluate(siteId, pointIds) {
  if (!isBackendSiteId(siteId)) return;
  await alarmApi.triggerAlarmEvaluate(siteId, pointIds || []);
}

// Equipment workspace: snapshot-driven rows from release payload; otherwise future runtime API.
export function getWorkspacePointsForEquipment(equipmentId, equipmentName, status, options = {}) {
  const releaseData = options.activeRelease ?? options.activeDeployment;
  if (releaseData) {
    return getWorkspacePointsForEquipmentFromRelease(equipmentId, equipmentName, status, options);
  }
  return operatorApi.getWorkspacePointsForEquipment(equipmentId, equipmentName, status, options);
}

// Schedules
export function getSchedules(siteId) {
  return operatorApi.getSchedules(siteId);
}

// Events (full list)
export function getEvents(siteId) {
  return operatorApi.getEvents(siteId);
}

// Users
export function getCurrentUser() {
  return operatorApi.getCurrentUser();
}

export function getUsers(siteId) {
  return operatorApi.getUsers(siteId);
}

// Trends
export function getTrendEquipmentList(siteId) {
  return operatorApi.getTrendEquipmentList(siteId);
}

/**
 * @param {string} siteId
 * @param {string} equipmentId
 * @param {string} range
 * @param {{ recordingStartedAt?: number }} [options]
 */
export function getTrendData(siteId, equipmentId, range, options) {
  return operatorApi.getTrendData(siteId, equipmentId, range, options);
}

/** Live point values (not historian) for current-value displays. */
export function getTrendLiveSnapshot(siteId, equipmentId) {
  return operatorApi.getTrendLiveSnapshot(siteId, equipmentId);
}

/** Point metadata for the selected equipment/device (for trend configuration). */
export function getTrendPointCatalog(siteId, equipmentId) {
  const list = getTrendEquipmentList(siteId);
  const eq = list.find((e) => e.id === equipmentId);
  return operatorApi.getTrendPointCatalog(equipmentId, eq);
}

/** Equipment groups for bulk assignment. */
export function getTrendEquipmentGroups(siteId) {
  return operatorApi.getTrendEquipmentGroups(siteId);
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
