/**
 * Shared site/project list — single source of truth for Phase 1.
 * Only Miami HQ (populated) and New Site (empty) exist.
 * Engineering = author working version; Operator = consume active release.
 */

export const SITE_IDS = {
  MIAMI_HQ: "Miami HQ",
  BRIGHTLINE: "Brightline Trains",
  NEW_SITE: "New Site",
};

/** Matches backend `prisma/seed.js` Demo Campus id when using fixed seed (API + User Manager mock). */
export const DEMO_CAMPUS_SITE_ID =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_DEMO_CAMPUS_SITE_ID) ||
  "cafe0000-0000-4000-8000-00000000babe";

/** Sites available in the app (for header/sidebar dropdown) */
export const SITE_LIST = [
  { id: SITE_IDS.MIAMI_HQ, name: "Miami HQ", isEmpty: false },
  { id: SITE_IDS.BRIGHTLINE, name: "Brightline Trains", isEmpty: false },
  { id: SITE_IDS.NEW_SITE, name: "New Site", isEmpty: true },
];

/** Display name for empty/create-new flow (legacy persisted site key) */
export const NEW_SITE_PLACEHOLDER_NAME = "New Building";

/** @deprecated use NEW_SITE_PLACEHOLDER_NAME */
export const NEW_SITE_DRAFT_KEY = NEW_SITE_PLACEHOLDER_NAME;

export function isMiamiHQ(siteName) {
  return siteName === SITE_IDS.MIAMI_HQ;
}

export function isEmptySite(siteName) {
  return !siteName || siteName === SITE_IDS.NEW_SITE || siteName === NEW_SITE_PLACEHOLDER_NAME;
}
