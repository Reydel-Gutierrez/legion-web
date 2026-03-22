/**
 * Trend point ids in mock data are `${equipmentId}::${slug}`. Templates are stored with slug-only ids
 * so the same definition can be assigned to many assets; we resolve to each asset's catalog on load.
 */

/**
 * @param {string | undefined} pointId
 * @returns {string | undefined}
 */
function toSlug(pointId) {
  if (!pointId || typeof pointId !== "string") return pointId;
  return pointId.includes("::") ? pointId.split("::").pop() : pointId;
}

/**
 * @param {string} pointId
 * @param {{ id: string }[]} catalog
 * @param {string} equipmentId
 * @returns {string}
 */
export function resolvePointIdForCatalog(pointId, catalog, equipmentId) {
  if (!pointId || !catalog?.length) return pointId;
  if (catalog.some((c) => c.id === pointId)) return pointId;
  const slug = toSlug(pointId);
  if (!slug) return pointId;
  const match = catalog.find(
    (c) => c.id === `${equipmentId}::${slug}` || (c.id && c.id.endsWith(`::${slug}`))
  );
  return match ? match.id : pointId;
}

/**
 * @param {string[]} pointIds
 * @param {{ id: string }[]} catalog
 * @param {string} equipmentId
 * @returns {string[]}
 */
export function resolvePointIdsForCatalog(pointIds, catalog, equipmentId) {
  if (!pointIds?.length || !catalog?.length) return [];
  const out = [];
  const seen = new Set();
  for (const p of pointIds) {
    if (!p || typeof p !== "string") continue;
    const resolved = resolvePointIdForCatalog(p, catalog, equipmentId);
    if (catalog.some((c) => c.id === resolved) && !seen.has(resolved)) {
      out.push(resolved);
      seen.add(resolved);
    }
  }
  return out;
}

/**
 * @param {import("./trendDomain").TrendReferenceBand[] | undefined} bands
 * @param {{ id: string }[]} catalog
 * @param {string} equipmentId
 */
export function resolveReferenceBandsForCatalog(bands, catalog, equipmentId) {
  return (bands || []).map((b) => ({
    ...b,
    pointId: resolvePointIdForCatalog(b.pointId, catalog, equipmentId),
  }));
}

/**
 * Persist template definitions with slug-only point ids so assignments on other equipment resolve correctly.
 * @param {import("./trendDomain").TrendDefinition} def
 * @returns {{ pointIds: string[]; referenceBands: import("./trendDomain").TrendReferenceBand[] }}
 */
export function normalizeDefinitionForTemplateStore(def) {
  const normPid = (id) => toSlug(id) || id;
  return {
    pointIds: (def.pointIds || []).map(normPid),
    referenceBands: (def.referenceBands || []).map((b) => ({
      ...b,
      pointId: normPid(b.pointId),
    })),
  };
}

/**
 * Stable JSON for comparing definition state (after resolving ids for current catalog).
 * @param {import("./trendDomain").TrendDefinition} def
 * @param {{ id: string }[]} catalog
 * @param {string} equipmentId
 */
export function serializeDefinitionForCompare(def, catalog, equipmentId) {
  const pointIds = catalog.length
    ? [...resolvePointIdsForCatalog(def.pointIds || [], catalog, equipmentId)].sort()
    : [...(def.pointIds || [])].sort();
  const bands = catalog.length
    ? resolveReferenceBandsForCatalog(def.referenceBands || [], catalog, equipmentId)
    : def.referenceBands || [];
  return JSON.stringify({
    name: def.name,
    pointIds,
    defaultRange: def.defaultRange,
    chartStyle: def.chartStyle,
    referenceBands: bands,
    overlaySettings: def.overlaySettings,
    isTemplate: def.isTemplate,
  });
}

/**
 * Compare template definitions stored as slugs (no equipment catalog).
 * @param {import("./trendDomain").TrendDefinition} def
 */
export function serializeTemplateDefinitionSnapshot(def) {
  return JSON.stringify({
    name: def.name,
    pointIds: [...(def.pointIds || [])].map(String).sort(),
    defaultRange: def.defaultRange,
    chartStyle: def.chartStyle,
    referenceBands: def.referenceBands || [],
    overlaySettings: def.overlaySettings,
    isTemplate: def.isTemplate,
  });
}
