/**
 * Human-readable site label for UI. Internal selection state remains site id (UUID or legacy name).
 */

import { SITE_IDS } from "./sites";
import { isBackendSiteId } from "./data/siteIdUtils";

/**
 * @param {string} site - SiteProvider value (UUID or legacy name)
 * @param {{ id: string, name: string }[]} apiSites - from GET /api/sites when available
 * @param {{ workingSiteName?: string }} [options]
 */
export function getSiteDisplayLabel(site, apiSites = [], options = {}) {
  const { workingSiteName } = options;
  if (isBackendSiteId(site)) {
    const row = apiSites.find((s) => s.id === site);
    return row?.name || `Site ${String(site).slice(0, 8)}…`;
  }
  const isBuiltIn =
    site === SITE_IDS.MIAMI_HQ ||
    site === SITE_IDS.BRIGHTLINE ||
    site === SITE_IDS.NEW_SITE ||
    site === "New Building";
  if (!isBuiltIn) return site;
  if (site === SITE_IDS.NEW_SITE && workingSiteName) return workingSiteName;
  return site;
}
