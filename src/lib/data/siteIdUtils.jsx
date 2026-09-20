/** A real RFC 4122 UUID, as Prisma's `@default(uuid())` always generates. */
const STRICT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Some Legion reference/seed sites (e.g. Strip Plaza: "strip0000-0000-4000-8000-000000000001")
 * use a memorable, hand-authored id instead of a generated UUID. They keep the same 5-segment
 * hyphenated shape a UUID has, but aren't strict hex or version/variant-correct — this is what the
 * strict pattern above rejects. Segment lengths stay close to canonical (8-4-4-4-12) with slack only
 * on the two outer segments (4-12 chars) for a mnemonic word like "strip0000", never on the
 * hyphen count or shape itself — so this still can't match the human-readable mock/sentinel site
 * names (SITE_IDS, the New Site/New Building placeholders), which contain spaces and don't have
 * this segment structure at all.
 */
const LEGION_VANITY_ID_PATTERN = /^[0-9a-z]{4,12}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4,12}$/i;

/**
 * Detect backend site ids: either a real Prisma-generated UUID, or one of Legion's hand-authored
 * reference-site ids that share a UUID's hyphenated shape. Deliberately NOT "any non-empty string"
 * — that would also accept the app's human-readable mock/sentinel site names (e.g. "Miami HQ",
 * "New Site"), which must keep resolving to the local mock data path, not a backend lookup.
 */
export function isBackendSiteId(site) {
  return (
    typeof site === "string" &&
    (STRICT_UUID_PATTERN.test(site) || LEGION_VANITY_ID_PATTERN.test(site))
  );
}
