/**
 * Human-readable site label for UI. Internal selection state remains site id (UUID or legacy name).
 */

import { SITE_IDS } from "./sites";
import { isBackendSiteId } from "./data/siteIdUtils";

const SIDEBAR_LABEL_MAX = 36;

/**
 * Shorten UUIDs and very long strings for sidebar / dropdowns (selection value stays unchanged).
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function formatSiteNameForDisplay(value) {
  if (value == null || value === "") return "";
  const t = String(value).trim();
  if (!t) return "";
  if (isBackendSiteId(t)) return `Site ${t.slice(0, 8)}…`;
  if (t.length > SIDEBAR_LABEL_MAX) return `${t.slice(0, SIDEBAR_LABEL_MAX - 1)}…`;
  return t;
}

/**
 * @param {string} site - SiteProvider value (UUID or legacy name)
 * @param {{ id: string, name: string }[]} apiSites - from GET /api/sites when available
 * @param {{ workingSiteName?: string }} [options]
 */
export function getSiteDisplayLabel(site, apiSites = [], options = {}) {
  const { workingSiteName } = options;
  if (isBackendSiteId(site)) {
    const row = apiSites.find((s) => s.id === site);
    const raw = row?.name || `Site ${String(site).slice(0, 8)}…`;
    return formatSiteNameForDisplay(raw);
  }
  const isBuiltIn =
    site === SITE_IDS.MIAMI_HQ ||
    site === SITE_IDS.BRIGHTLINE ||
    site === SITE_IDS.NEW_SITE ||
    site === "New Building";
  if (!isBuiltIn) return formatSiteNameForDisplay(site);
  if (site === SITE_IDS.NEW_SITE && workingSiteName) return formatSiteNameForDisplay(workingSiteName);
  return formatSiteNameForDisplay(site);
}
