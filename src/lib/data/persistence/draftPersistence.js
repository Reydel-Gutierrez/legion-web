/**
 * Local persistence for engineering drafts and deployed site snapshots.
 * Backend-ready: same shapes can be sent to API later.
 * Keys: site name (string) — "Miami HQ", "New Site", or custom e.g. "Home Lab".
 */

const STORAGE_KEY_DRAFTS = "legion_site_drafts";
const STORAGE_KEY_DEPLOYMENTS = "legion_site_deployments";

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

/**
 * Load all persisted drafts: { [siteName]: draftState }
 */
export function loadAllDrafts() {
  return safeParse(STORAGE_KEY_DRAFTS, {});
}

/**
 * Load draft for a site. Returns null if none.
 */
export function loadDraftForSite(siteName) {
  if (!siteName) return null;
  const all = loadAllDrafts();
  return all[siteName] ?? null;
}

/**
 * Save draft for a site. Merges into existing drafts.
 */
export function saveDraftForSite(siteName, draftState) {
  if (!siteName || !draftState) return;
  const all = loadAllDrafts();
  all[siteName] = draftState;
  localStorage.setItem(STORAGE_KEY_DRAFTS, safeStringify(all));
}

/**
 * Load all persisted deployments: { [siteName]: deployedSnapshot }
 */
export function loadAllDeployments() {
  return safeParse(STORAGE_KEY_DEPLOYMENTS, {});
}

/**
 * Load deployed snapshot for a site.
 */
export function loadDeploymentForSite(siteName) {
  if (!siteName) return null;
  const all = loadAllDeployments();
  return all[siteName] ?? null;
}

/**
 * Save deployed snapshot for a site.
 */
export function saveDeploymentForSite(siteName, snapshot) {
  if (!siteName || !snapshot) return;
  const all = loadAllDeployments();
  all[siteName] = snapshot;
  localStorage.setItem(STORAGE_KEY_DEPLOYMENTS, safeStringify(all));
}

/**
 * List of site names that have at least one persisted draft (for sidebar).
 */
export function getPersistedDraftSiteNames() {
  const all = loadAllDrafts();
  return Object.keys(all).filter((k) => {
    const d = all[k];
    return d && (d.site?.name || d.equipment?.length > 0 || Object.keys(d.graphics || {}).length > 0);
  });
}

/**
 * List of site names that have a deployed snapshot (for operator site list).
 */
export function getDeployedSiteNames() {
  const all = loadAllDeployments();
  return Object.keys(all).filter((k) => all[k] != null);
}
