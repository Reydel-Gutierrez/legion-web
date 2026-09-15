/**
 * API adapter for the LS-100 deployment pipeline (LC-ARCH-002) and the Engineering-side package
 * workflow. Thin wrappers over `apiFetch`/`getApiBaseUrl` — no shape transformation beyond what the
 * backend already returns, since these are new, backend-shaped payloads with no legacy mock to
 * reconcile against (unlike the older hierarchy adapters).
 */

import { apiFetch } from "../../../api/apiClient";
import { getApiBaseUrl } from "../../../api/apiConfig";

// ---- LS-100 side (backend/src/modules/deployment) ----

export function getLs100Status() {
  return apiFetch("/api/deployment/status", { activity: { logApi: false } });
}

export function getLs100History(siteId) {
  const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  return apiFetch(`/api/deployment/history${qs}`, { activity: { logApi: false } });
}

/** @param {File|Blob} file @param {"DIRECT"|"OFFLINE_IMPORT"} source */
export function importPackage(file, source = "OFFLINE_IMPORT") {
  return apiFetch(`/api/deployment/import?source=${encodeURIComponent(source)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
    activity: { label: "Import Legion Site Package" },
  });
}

export function validatePackageRecord(packageRecordId) {
  return apiFetch(`/api/deployment/packages/${encodeURIComponent(packageRecordId)}/validate`, {
    method: "POST",
    activity: { label: "Validate package" },
  });
}

export function previewPackageRecord(packageRecordId) {
  return apiFetch(`/api/deployment/packages/${encodeURIComponent(packageRecordId)}/preview`, {
    activity: { logApi: false },
  });
}

export function activatePackageRecord(packageRecordId, actor) {
  return apiFetch(`/api/deployment/packages/${encodeURIComponent(packageRecordId)}/activate`, {
    method: "POST",
    body: actor ? { actor } : undefined,
    activity: { label: "Activate package" },
  });
}

export function discardPackageRecord(packageRecordId) {
  return apiFetch(`/api/deployment/packages/${encodeURIComponent(packageRecordId)}/discard`, {
    method: "POST",
    activity: { label: "Discard package" },
  });
}

export function rollbackSite(siteId, actor) {
  return apiFetch("/api/deployment/rollback", {
    method: "POST",
    body: { siteId, actor },
    activity: { label: "Roll back to previous version" },
  });
}

export function recommission(reason, actor) {
  return apiFetch("/api/deployment/recommission", {
    method: "POST",
    body: { reason, actor },
    activity: { label: "Recommission LS-100" },
  });
}

// ---- Engineering side (backend/src/modules/siteVersions) ----

export function validateProjectForPackage(siteId) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/package/validate`, {
    method: "POST",
    activity: { logApi: false },
  });
}

export function buildSitePackage(siteId, { author, releaseNotes, deploymentScope, simulationPackage } = {}) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/package/build`, {
    method: "POST",
    body: { author, releaseNotes, deploymentScope, simulationPackage },
    activity: { label: "Build Site Package" },
  });
}

export function deployPackageDirect(siteId, { targetUrl, author, releaseNotes, simulationPackage } = {}) {
  return apiFetch(`/api/sites/${encodeURIComponent(siteId)}/package/deploy-direct`, {
    method: "POST",
    body: { targetUrl, author, releaseNotes, simulationPackage },
    activity: { label: "Deploy to LS-100" },
  });
}

// ---- Binary download helpers (bypass apiFetch's JSON pipeline) ----

async function downloadBinary(path, fallbackFileName) {
  const base = getApiBaseUrl();
  if (!base) throw new Error("API base URL is not configured (REACT_APP_API_BASE_URL)");
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* response was not JSON (a real binary body) — keep the status text */
    }
    throw new Error(message);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match ? match[1] : fallbackFileName;
  const blob = await res.blob();
  return { blob, fileName };
}

export function exportSitePackage(siteId, packageRecordId) {
  return downloadBinary(`/api/sites/${encodeURIComponent(siteId)}/package/${encodeURIComponent(packageRecordId)}/export`, "site.lspkg");
}

export function downloadBackup(backupId) {
  return downloadBinary(`/api/deployment/backups/${encodeURIComponent(backupId)}/download`, "backup.lspkg");
}

/** Triggers a browser save-as for a blob produced by one of the download helpers above. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
