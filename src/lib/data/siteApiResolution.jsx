/**
 * Map sidebar / localStorage site keys to API site ids so Operator + User Manager hit the backend.
 */

import { isBackendSiteId } from "./siteIdUtils";

/**
 * Match UI labels like "Sunset Strip Plaza" to API rows named "Sunset Strip Plaza Building".
 * @param {string} name
 */
export function normalizeSiteNameForMatch(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+building\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefer the project with real structure when two API sites share the same display name.
 * @param {{ id: string, name?: string, _count?: { buildings?: number } }} a
 * @param {{ id: string, name?: string, _count?: { buildings?: number } }} b
 */
function compareSitesForDisambiguation(a, b) {
  const ba = a._count?.buildings ?? 0;
  const bb = b._count?.buildings ?? 0;
  if (bb !== ba) return bb - ba;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * @param {string|null|undefined} siteKey
 * @param {{ id: string, name?: string, _count?: { buildings?: number } }[]|null|undefined} apiSites
 * @returns {string|null} UUID for API calls, or null if unknown (and not a bare UUID).
 */
export function coerceSiteKeyToApiId(siteKey, apiSites) {
  if (siteKey == null || siteKey === "") return null;
  if (isBackendSiteId(siteKey)) return String(siteKey);
  if (!apiSites?.length) return null;
  const want = normalizeSiteNameForMatch(siteKey);
  if (!want) return null;
  const exact = apiSites.filter((s) => normalizeSiteNameForMatch(s.name) === want);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    return [...exact].sort(compareSitesForDisambiguation)[0].id;
  }
  const fuzzy = apiSites.filter((s) => {
    const n = normalizeSiteNameForMatch(s.name);
    return n && (n === want || n.startsWith(`${want} `) || want.startsWith(`${n} `));
  });
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (fuzzy.length > 1) {
    return [...fuzzy].sort(compareSitesForDisambiguation)[0].id;
  }
  return null;
}
