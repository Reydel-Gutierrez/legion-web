/**
 * Reserved site key meaning "no archive is open". Used as the default site (fresh browser, or
 * after New/Close/Delete Archive) so Engineering can render with nothing loaded. Deliberately not
 * hyphenated like a UUID/vanity id (see isBackendSiteId) and not a human-readable site name, so it
 * never collides with a real site and always falls through to the plain local-draft load path.
 */
const ARCHIVE_KEY_PREFIX = "legion_archive_";

export const ARCHIVE_NONE_SITE_KEY = `${ARCHIVE_KEY_PREFIX}none`;

/** Generates a fresh, guaranteed-unused local site key for a new or imported archive. */
export function generateArchiveSiteKey() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ARCHIVE_KEY_PREFIX}${Date.now().toString(36)}_${rand}`;
}

/**
 * True for the "no archive" sentinel or any locally-generated archive id. Both SiteProvider (its
 * hierarchy-API site-selection guard) and EngineeringVersionProvider (its load/autosave effects)
 * need this to treat local archives as a legitimate site selection instead of "unrecognized,
 * fall back to a real backend site" / "not a backend site, load nothing."
 */
export function isLocalArchiveSiteKey(key) {
  return typeof key === "string" && key.startsWith(ARCHIVE_KEY_PREFIX);
}
