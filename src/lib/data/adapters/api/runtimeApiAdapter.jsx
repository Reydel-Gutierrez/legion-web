/**
 * Simulated / field-style controller runtime API (Phase 1 SIM protocol).
 */

import { apiFetch } from "../../../api/apiClient";

/** @returns {Promise<object[]>} */
export async function listRuntimeControllers() {
  const raw = await apiFetch("/api/runtime/controllers");
  return Array.isArray(raw) ? raw : [];
}

/** @returns {Promise<object | null>} */
export async function getRuntimeController(code) {
  try {
    return await apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}`);
  } catch {
    return null;
  }
}

export async function setRuntimeControllerOnline(code) {
  return apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}/online`, { method: "POST" });
}

export async function setRuntimeControllerOffline(code) {
  return apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}/offline`, { method: "POST" });
}

export async function startRuntimeController(code) {
  return apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}/start`, { method: "POST" });
}

export async function stopRuntimeController(code) {
  return apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}/stop`, { method: "POST" });
}

export async function pollRuntimeControllerNow(code) {
  return apiFetch(`/api/runtime/controllers/${encodeURIComponent(code)}/poll-now`, { method: "POST" });
}

/**
 * Controllers exposed for Network Discovery (Scan Network).
 * Legion SIM devices are included for every project (trunk-style scan). `siteId` is reserved for future non-SIM scoping.
 * @param {string} [siteId]
 * @returns {Promise<object[]>}
 */
export async function fetchRuntimeDiscoveryDevices(siteId) {
  const q = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  const raw = await apiFetch(`/api/runtime/discovery-devices${q}`);
  const list = raw?.devices ?? raw;
  return Array.isArray(list) ? list : [];
}

/**
 * Canonical field-point list for a runtime controller (SIM: FCU-1 keys).
 * @param {string} code
 * @returns {Promise<object[]>}
 */
export async function fetchRuntimeFieldPoints(code) {
  const raw = await apiFetch(
    `/api/runtime/controllers/${encodeURIComponent(code)}/field-points`
  );
  const list = raw?.points ?? raw;
  return Array.isArray(list) ? list : [];
}
