/**
 * Field point ↔ Legion Point mappings (Phase 2).
 */

import { apiFetch } from "../../../api/apiClient";

export async function bindPointMapping(payload) {
  return apiFetch("/api/point-mappings/bind", {
    method: "POST",
    body: payload,
  });
}

export async function getPointMappingsByController(equipmentControllerId) {
  const raw = await apiFetch(
    `/api/point-mappings/by-controller/${encodeURIComponent(equipmentControllerId)}`
  );
  return Array.isArray(raw) ? raw : [];
}

export async function getPointMappingsByEquipment(equipmentId) {
  const raw = await apiFetch(`/api/point-mappings/by-equipment/${encodeURIComponent(equipmentId)}`);
  return Array.isArray(raw) ? raw : [];
}

export async function updatePointMapping(id, payload) {
  return apiFetch(`/api/point-mappings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deletePointMapping(id) {
  await apiFetch(`/api/point-mappings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
