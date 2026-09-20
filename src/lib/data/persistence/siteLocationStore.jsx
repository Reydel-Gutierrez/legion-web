/**
 * Site-level location (a plain address string — no map/geocoding, since most BMS deployments run
 * with no internet access) — stored separately from the working-version payload.
 *
 * In hierarchy-API mode, saving a site node (name/description/timezone) re-fetches the working
 * version from the relational `/api/sites` model, which has no address column; anything merged into
 * `workingState.site` directly would be wiped out on the next save. Keeping location in its own
 * localStorage map, keyed by site id, sidesteps that entirely and works the same way in both local
 * and hierarchy-API modes.
 */

const STORAGE_KEY = "legion_site_locations";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota/serialization errors — location is a non-critical convenience field */
  }
}

/** @returns {{ address?: string } | null} */
export function getSiteLocation(siteId) {
  if (!siteId) return null;
  const all = loadAll();
  return all[siteId] ?? null;
}

export function setSiteLocation(siteId, location) {
  if (!siteId) return;
  const all = loadAll();
  if (!location || !location.address) {
    delete all[siteId];
  } else {
    all[siteId] = location;
  }
  saveAll(all);
}

export function deleteSiteLocation(siteId) {
  if (!siteId) return;
  const all = loadAll();
  if (siteId in all) {
    delete all[siteId];
    saveAll(all);
  }
}
