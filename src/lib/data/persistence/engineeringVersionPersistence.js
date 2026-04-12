/**
 * Local persistence for engineering working versions and active releases (snapshots per site).
 * Storage keys are unchanged from early prototypes so existing browser data keeps loading.
 */

import { isBackendSiteId } from "../siteIdUtils";

const STORAGE_KEY_WORKING_VERSIONS = "legion_site_drafts";
const STORAGE_KEY_ACTIVE_RELEASES = "legion_site_deployments";

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function isQuotaError(e) {
  return e && (e.name === "QuotaExceededError" || e.code === 22);
}

function setLocalStorageSafe(key, json) {
  try {
    localStorage.setItem(key, json);
    return true;
  } catch (e) {
    if (isQuotaError(e)) {
      console.warn(
        "[Legion] Working version / release save failed: browser storage quota exceeded. Use smaller images or clear site data.",
        e
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("legion-storage-quota", {
            detail: {
              key,
              message:
                "Storage is full (often due to large images in Graphics Manager). Try a smaller image or remove unused graphics.",
            },
          })
        );
      }
      return false;
    }
    console.error("[Legion] localStorage setItem failed", e);
    return false;
  }
}

export function loadAllWorkingVersions() {
  return safeParse(STORAGE_KEY_WORKING_VERSIONS, {});
}

export function loadWorkingVersionForSite(siteName) {
  if (!siteName) return null;
  const all = loadAllWorkingVersions();
  return all[siteName] ?? null;
}

export function saveWorkingVersionForSite(siteName, workingState) {
  if (!siteName || !workingState) return;
  const all = loadAllWorkingVersions();
  all[siteName] = workingState;
  setLocalStorageSafe(STORAGE_KEY_WORKING_VERSIONS, safeStringify(all));
}

export function loadAllActiveReleases() {
  return safeParse(STORAGE_KEY_ACTIVE_RELEASES, {});
}

export function loadActiveReleaseForSite(siteName) {
  if (!siteName) return null;
  const all = loadAllActiveReleases();
  return all[siteName] ?? null;
}

export function saveActiveReleaseForSite(siteName, snapshot) {
  if (!siteName || !snapshot) return;
  const all = loadAllActiveReleases();
  all[siteName] = snapshot;
  setLocalStorageSafe(STORAGE_KEY_ACTIVE_RELEASES, safeStringify(all));
}

/** Site names that have persisted working-version content (sidebar). */
export function getPersistedWorkingVersionSiteNames() {
  const all = loadAllWorkingVersions();
  return Object.keys(all).filter((k) => {
    const d = all[k];
    return d && (d.site?.name || d.equipment?.length > 0 || Object.keys(d.graphics || {}).length > 0);
  });
}

export function getSitesWithActiveRelease() {
  const all = loadAllActiveReleases();
  return Object.keys(all).filter((k) => all[k] != null);
}

const WIZARD_KEYS = new Set(["New Site", "New Building"]);

/**
 * Remove browser drafts/releases whose keys are not a known API site id or name.
 * Keeps only "New Site" / "New Building" wizard keys and rows tied to `apiSites`.
 * @param {{ id: string, name?: string }[]} apiSites
 */
export function pruneWorkingVersionsNotBoundToApi(apiSites) {
  if (!apiSites?.length) return;
  const idSet = new Set(apiSites.map((s) => s.id).filter(Boolean));
  const nameNorm = new Set(
    apiSites.map((s) => String(s.name || "").trim().toLowerCase()).filter(Boolean)
  );
  const all = loadAllWorkingVersions();
  const next = {};
  for (const [key, value] of Object.entries(all)) {
    if (WIZARD_KEYS.has(key)) {
      next[key] = value;
      continue;
    }
    if (isBackendSiteId(key) && idSet.has(key)) {
      next[key] = value;
      continue;
    }
    const kn = String(key).trim().toLowerCase();
    if (nameNorm.has(kn)) {
      next[key] = value;
      continue;
    }
  }
  if (Object.keys(next).length !== Object.keys(all).length) {
    setLocalStorageSafe(STORAGE_KEY_WORKING_VERSIONS, safeStringify(next));
  }
}

/**
 * @param {{ id: string, name?: string }[]} apiSites
 */
export function pruneActiveReleasesNotBoundToApi(apiSites) {
  if (!apiSites?.length) return;
  const idSet = new Set(apiSites.map((s) => s.id).filter(Boolean));
  const nameNorm = new Set(
    apiSites.map((s) => String(s.name || "").trim().toLowerCase()).filter(Boolean)
  );
  const all = loadAllActiveReleases();
  const next = {};
  for (const [key, value] of Object.entries(all)) {
    if (WIZARD_KEYS.has(key)) {
      next[key] = value;
      continue;
    }
    if (isBackendSiteId(key) && idSet.has(key)) {
      next[key] = value;
      continue;
    }
    const kn = String(key).trim().toLowerCase();
    if (nameNorm.has(kn)) {
      next[key] = value;
      continue;
    }
  }
  if (Object.keys(next).length !== Object.keys(all).length) {
    setLocalStorageSafe(STORAGE_KEY_ACTIVE_RELEASES, safeStringify(next));
  }
}
