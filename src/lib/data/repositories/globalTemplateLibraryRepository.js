/**
 * Global Template Library — backend `/api/global-template-library/*`.
 * Requires REACT_APP_API_BASE_URL (same as hierarchy API).
 */

import { apiFetch } from "../../api/apiClient";

export async function listGlobalEquipmentTemplates() {
  const rows = await apiFetch("/api/global-template-library/equipment-templates");
  return Array.isArray(rows) ? rows : [];
}

export async function getGlobalEquipmentTemplate(id) {
  return apiFetch(`/api/global-template-library/equipment-templates/${encodeURIComponent(id)}`);
}

export async function pushGlobalEquipmentTemplate(siteTemplate) {
  return apiFetch("/api/global-template-library/equipment-templates", {
    method: "POST",
    body: siteTemplate,
  });
}

export async function patchGlobalEquipmentTemplate(id, body) {
  return apiFetch(`/api/global-template-library/equipment-templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: body ?? {},
  });
}

export async function deleteGlobalEquipmentTemplate(id) {
  await apiFetch(`/api/global-template-library/equipment-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listGlobalGraphicTemplates() {
  const rows = await apiFetch("/api/global-template-library/graphic-templates");
  return Array.isArray(rows) ? rows : [];
}

export async function getGlobalGraphicTemplate(id) {
  return apiFetch(`/api/global-template-library/graphic-templates/${encodeURIComponent(id)}`);
}

export async function pushGlobalGraphicTemplate(siteTemplate, equipmentTemplates) {
  return apiFetch("/api/global-template-library/graphic-templates", {
    method: "POST",
    body: {
      template: siteTemplate,
      equipmentTemplates: Array.isArray(equipmentTemplates) ? equipmentTemplates : [],
    },
  });
}

export async function patchGlobalGraphicTemplate(id, body) {
  return apiFetch(`/api/global-template-library/graphic-templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: body ?? {},
  });
}

export async function deleteGlobalGraphicTemplate(id) {
  await apiFetch(`/api/global-template-library/graphic-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
