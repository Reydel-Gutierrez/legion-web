/**
 * Persisted controller ↔ equipment assignment (Phase 2).
 */

import { apiFetch, ApiError } from "../../../api/apiClient";

export async function assignEquipmentController(payload) {
  return apiFetch("/api/equipment-controllers/assign", {
    method: "POST",
    body: payload,
  });
}

/** @returns {Promise<object | null>} */
export async function getEquipmentControllerByEquipment(equipmentId) {
  try {
    return await apiFetch(
      `/api/equipment-controllers/by-equipment/${encodeURIComponent(equipmentId)}`
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function listEquipmentControllers() {
  const raw = await apiFetch("/api/equipment-controllers");
  return Array.isArray(raw) ? raw : [];
}

export async function updateEquipmentController(id, payload) {
  return apiFetch(`/api/equipment-controllers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEquipmentController(id) {
  await apiFetch(`/api/equipment-controllers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
