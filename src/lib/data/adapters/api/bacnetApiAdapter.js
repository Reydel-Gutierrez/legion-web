/**
 * BACnet runtime / engineering explorer API.
 */

import { apiFetch } from "../../../api/apiClient";

/** @returns {Promise<object[]>} */
export async function fetchExplorerDevices() {
  const raw = await apiFetch("/api/runtime/bacnet/explorer/devices");
  return Array.isArray(raw) ? raw : [];
}

/** @returns {Promise<object>} */
export async function fetchDeviceTree(deviceId) {
  return apiFetch(`/api/runtime/bacnet/explorer/devices/${encodeURIComponent(deviceId)}/tree`);
}

/** @returns {Promise<object>} */
export async function fetchExplorerObject(objectId) {
  return apiFetch(`/api/runtime/bacnet/explorer/objects/${encodeURIComponent(objectId)}`);
}

/** @returns {Promise<object>} */
export async function readBacnetProperty(payload) {
  return apiFetch("/api/runtime/bacnet/read-property", {
    method: "POST",
    body: payload,
  });
}

/** @returns {Promise<object>} */
export async function readDeviceProperties(payload) {
  return apiFetch("/api/runtime/bacnet/read-device-properties", {
    method: "POST",
    body: payload,
  });
}

/** @returns {Promise<object>} */
export async function importBacnetDiscovery(payload) {
  return apiFetch("/api/runtime/bacnet/import-discovery", {
    method: "POST",
    body: payload,
    activity: { label: "Import BACnet discovery" },
  });
}

/** @returns {Promise<object>} */
export async function discoverBacnetDevices(payload = {}) {
  return apiFetch("/api/runtime/bacnet/discover", {
    method: "POST",
    body: payload,
    activity: { label: "BACnet Who-Is discovery" },
  });
}

/** @returns {Promise<object>} */
export async function checkDeviceHealth(payload) {
  return apiFetch("/api/runtime/bacnet/check-device-health", {
    method: "POST",
    body: payload,
    activity: { silent: true },
  });
}

/** @returns {Promise<object>} */
export async function checkDevicesHealth(payload = {}) {
  return apiFetch("/api/runtime/bacnet/check-devices-health", {
    method: "POST",
    body: payload,
    activity: { silent: true },
  });
}
