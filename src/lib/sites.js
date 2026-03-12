/**
 * Shared site/project list — single source of truth for Phase 1.
 * Only Miami HQ (populated) and New Site (empty) exist.
 * Engineering = author draft; Operator = consume active deployed data.
 */

export const SITE_IDS = {
  MIAMI_HQ: "Miami HQ",
  NEW_SITE: "New Site",
};

/** Sites available in the app (for header/sidebar dropdown) */
export const SITE_LIST = [
  { id: SITE_IDS.MIAMI_HQ, name: "Miami HQ", isEmpty: false },
  { id: SITE_IDS.NEW_SITE, name: "New Site", isEmpty: true },
];

/** Display name for empty/create-new flow (used in draft seed as "New Building" internally) */
export const NEW_SITE_DRAFT_KEY = "New Building";

export function isMiamiHQ(siteName) {
  return siteName === SITE_IDS.MIAMI_HQ;
}

export function isEmptySite(siteName) {
  return !siteName || siteName === SITE_IDS.NEW_SITE || siteName === NEW_SITE_DRAFT_KEY;
}
