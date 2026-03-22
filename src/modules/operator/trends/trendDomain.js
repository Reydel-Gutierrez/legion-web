/** @typedef {{ id: string; pointId: string; min: number; max: number; label: string; enabled: boolean; showOnChart: boolean }} TrendReferenceBand */

/** @typedef {{ alarms: boolean; schedule: boolean; commLoss: boolean; modeChange: boolean }} TrendOverlaySettings */

/**
 * Reusable trend configuration (may be a one-off or a template).
 * Assignments link definitions to assets — see `TrendAssignment`.
 *
 * @typedef {{
 *   id: string;
 *   name: string;
 *   isTemplate: boolean;
 *   pointIds: string[];
 *   defaultRange: string;
 *   chartStyle: string;
 *   referenceBands: TrendReferenceBand[];
 *   overlaySettings: TrendOverlaySettings;
 *   templateKey?: string | null;
 * }} TrendDefinition
 */

/**
 * Links a trend definition to one asset. Logging and history are scoped here.
 *
 * @typedef {{
 *   id: string;
 *   trendDefinitionId: string;
 *   assetId: string;
 *   assignedAt: string;
 *   loggingEnabled: boolean;
 *   isDefault: boolean;
 *   recordingStartedAt: number | null;
 *   recordingDurationDays: number;
 * }} TrendAssignment
 */

/** @typedef {{ updatedAt?: string; sampleCount?: number }} TrendHistoryEntry */

/** Prefix for scoped keys; unscoped `localStorage` entry is legacy (pre–per-site). */
const STORAGE_KEY = "legion.trend.definitions.v1";

/**
 * Stable localStorage key per site / project (SiteProvider display name, e.g. "Miami HQ").
 * @param {string} [siteDisplayName]
 */
export function trendDefinitionsStorageKey(siteDisplayName) {
  const s = (siteDisplayName || "").trim() || "__default__";
  return `${STORAGE_KEY}::${encodeURIComponent(s)}`;
}

export function newTrendId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `trend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function newBandId() {
  return newTrendId();
}

/** @returns {TrendDefinition} */
export function createDefaultTrendDefinition(pointIds = []) {
  return {
    id: newTrendId(),
    name: "Untitled trend",
    isTemplate: false,
    pointIds: pointIds.length ? [...pointIds] : [],
    defaultRange: "24H",
    chartStyle: "line",
    referenceBands: [],
    overlaySettings: {
      alarms: true,
      schedule: true,
      commLoss: true,
      modeChange: true,
    },
    templateKey: null,
  };
}

/** @returns {TrendAssignment} */
export function createDefaultTrendAssignment(trendDefinitionId, assetId, options = {}) {
  const started = options.recordingStartedAt;
  const hasStarted = typeof started === "number";
  return {
    id: newTrendId(),
    trendDefinitionId,
    assetId,
    assignedAt: new Date().toISOString(),
    loggingEnabled: options.loggingEnabled ?? hasStarted,
    isDefault: !!options.isDefault,
    recordingStartedAt: hasStarted ? started : null,
    recordingDurationDays: options.recordingDurationDays ?? 14,
  };
}

/** @returns {TrendDefinition[]} */
export function loadSavedTrendDefinitions(siteDisplayName) {
  try {
    const key = trendDefinitionsStorageKey(siteDisplayName);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy && legacy.startsWith("[")) {
        const miamiKey = trendDefinitionsStorageKey("Miami HQ");
        if (!localStorage.getItem(miamiKey)) {
          localStorage.setItem(miamiKey, legacy);
        }
        localStorage.removeItem(STORAGE_KEY);
        raw = localStorage.getItem(key);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {string} siteDisplayName @param {TrendDefinition[]} list */
export function persistTrendDefinitions(siteDisplayName, list) {
  try {
    localStorage.setItem(trendDefinitionsStorageKey(siteDisplayName), JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/** @param {TrendDefinition} def */
export function cloneTrendDefinition(def) {
  return {
    ...def,
    id: newTrendId(),
    name: `${def.name} (copy)`,
    referenceBands: (def.referenceBands || []).map((b) => ({
      ...b,
      id: b.id || newBandId(),
    })),
    pointIds: [...(def.pointIds || [])],
  };
}
