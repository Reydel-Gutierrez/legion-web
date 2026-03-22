/**
 * Site Layout (operator) — buildings for global map and related helpers.
 * Reads from active deployment snapshot; keeps shape stable for future API swap.
 */

/** @typedef {"normal"|"warning"|"alert"} BuildingHealthStatus */

const STATUS_MAP = {
  alert: "alert",
  critical: "alert",
  error: "alert",
  warning: "warning",
  warn: "warning",
  normal: "normal",
  ok: "normal",
  active: "normal",
};

/**
 * Known building ids → geo when legacy deployments omit coordinates (hydration safety net).
 */
export const BUILDING_GEO_FALLBACK_BY_ID = {
  "bldg-miami-tower-a": { lat: 25.76185, lng: -80.19145, city: "Miami", state: "FL", address: "100 Legion Way" },
  "bldg-miami-tower-b": { lat: 25.76225, lng: -80.19205, city: "Miami", state: "FL", address: "120 Legion Way" },
  "bldg-miami-garage": { lat: 25.76135, lng: -80.19265, city: "Miami", state: "FL", address: "90 Legion Way" },
};

/**
 * Normalize raw status from deployment or engineering mock to map/list vocabulary.
 * @param {string} [raw]
 * @returns {BuildingHealthStatus}
 */
export function normalizeBuildingLayoutStatus(raw) {
  if (raw == null || raw === "") return "normal";
  const key = String(raw).toLowerCase();
  return STATUS_MAP[key] || "normal";
}

/**
 * All buildings for Site Layout list + map metadata (includes entries without coordinates).
 * @param {object|null} activeDeployment
 * @returns {Array<import("../contracts").SiteLayoutBuilding>}
 */
export function getSiteLayoutBuildingsList(activeDeployment) {
  const site = activeDeployment?.site;
  if (!site?.buildings?.length) return [];
  const siteId = site.id;
  return site.buildings.map((b) => {
    const fallback = BUILDING_GEO_FALLBACK_BY_ID[b.id] || {};
    const lat = Number(b.lat ?? fallback.lat);
    const lng = Number(b.lng ?? fallback.lng);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const cityState = [b.city || fallback.city, b.state || fallback.state].filter(Boolean).join(", ");
    const addressLine = [b.address || fallback.address, cityState].filter(Boolean).join(" · ");
    return {
      id: b.id,
      siteId,
      name: b.name || "Building",
      address: b.address || fallback.address || "",
      city: b.city || fallback.city || "",
      state: b.state || fallback.state || "",
      lat: hasGeo ? lat : null,
      lng: hasGeo ? lng : null,
      hasGeo,
      addressLine: addressLine || "",
      status: normalizeBuildingLayoutStatus(b.status ?? fallback.status),
      hasFloors: b.hasFloors !== false && (b.floors?.length ?? 0) > 0,
      thumbnail: b.thumbnail ?? null,
    };
  });
}

/**
 * Buildings that can be drawn as map markers (have valid coordinates).
 * @param {object|null} activeDeployment
 * @returns {Array<import("../contracts").SiteLayoutBuilding>}
 */
export function getBuildingsForGlobalMap(activeDeployment) {
  return getSiteLayoutBuildingsList(activeDeployment).filter((b) => b.hasGeo);
}

export const siteLayoutRepository = {
  getSiteLayoutBuildingsList,
  getBuildingsForGlobalMap,
  normalizeBuildingLayoutStatus,
};

export default siteLayoutRepository;
