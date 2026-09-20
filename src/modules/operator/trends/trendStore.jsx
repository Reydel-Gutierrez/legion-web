/**
 * Persistent trend store: definitions + assignments (+ optional history metadata).
 * Scoped per site (SiteProvider display name).
 */

import {
  newTrendId,
  trendDefinitionsStorageKey,
  createDefaultTrendDefinition,
} from "./trendDomain";

const STORE_KEY = "legion.trend.store.v1";

/** @typedef {import("./trendDomain").TrendDefinition} TrendDefinition */
/** @typedef {import("./trendDomain").TrendAssignment} TrendAssignment */
/** @typedef {import("./trendDomain").TrendHistoryEntry} TrendHistoryEntry */

/**
 * @typedef {{
 *   definitions: TrendDefinition[];
 *   assignments: TrendAssignment[];
 *   trendHistory: Record<string, TrendHistoryEntry>;
 * }} TrendDataStore
 */

/** @param {string} [siteDisplayName] */
export function trendStoreStorageKey(siteDisplayName) {
  const s = (siteDisplayName || "").trim() || "__default__";
  return `${STORE_KEY}::${encodeURIComponent(s)}`;
}

/** @returns {TrendDataStore} */
export function emptyTrendStore() {
  return { definitions: [], assignments: [], trendHistory: {} };
}

/**
 * @param {string} siteDisplayName
 * @returns {TrendDataStore}
 */
export function loadTrendDataStore(siteDisplayName) {
  try {
    const key = trendStoreStorageKey(siteDisplayName);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const migrated = migrateLegacyDefinitionsIntoStore(siteDisplayName);
      if (migrated.definitions.length || migrated.assignments.length) {
        persistTrendDataStore(siteDisplayName, migrated);
        return migrated;
      }
      return emptyTrendStore();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyTrendStore();
    return normalizeStore(parsed);
  } catch {
    return emptyTrendStore();
  }
}

/**
 * @param {string} siteDisplayName
 * @param {TrendDataStore} store
 */
export function persistTrendDataStore(siteDisplayName, store) {
  try {
    localStorage.setItem(trendStoreStorageKey(siteDisplayName), JSON.stringify(normalizeStore(store)));
  } catch {
    /* quota */
  }
}

/** @param {Partial<TrendDataStore>} s */
function normalizeStore(s) {
  const definitions = Array.isArray(s.definitions) ? s.definitions : [];
  const rawAssignments = Array.isArray(s.assignments) ? s.assignments : [];
  const assignments = rawAssignments.map((a) => ({
    ...a,
    recordingDurationDays: a.recordingDurationDays ?? 14,
  }));
  const trendHistory = s.trendHistory && typeof s.trendHistory === "object" ? s.trendHistory : {};
  return { definitions, assignments, trendHistory };
}

/**
 * Migrate `legion.trend.definitions.v1` list into definitions + assignments.
 * @param {string} siteDisplayName
 * @returns {TrendDataStore}
 */
function migrateLegacyDefinitionsIntoStore(siteDisplayName) {
  /** @type {TrendDefinition[]} */
  const definitions = [];
  /** @type {TrendAssignment[]} */
  const assignments = [];

  try {
    const legacyKey = trendDefinitionsStorageKey(siteDisplayName);
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return emptyTrendStore();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return emptyTrendStore();

    parsed.forEach((def) => {
      if (!def || typeof def !== "object" || !def.id) return;
      const { assignment: legacyAssignment, ...legacyRest } = def;
      const base = createDefaultTrendDefinition();
      const nextDef = {
        ...base,
        ...legacyRest,
        id: def.id,
        pointIds: Array.isArray(def.pointIds) ? [...def.pointIds] : [],
        referenceBands: Array.isArray(def.referenceBands) ? def.referenceBands : [],
        overlaySettings: { ...base.overlaySettings, ...(def.overlaySettings || {}) },
      };
      definitions.push(nextDef);

      const eqIds = legacyAssignment?.equipmentIds;
      if (Array.isArray(eqIds) && eqIds.length) {
        const started = Date.now() - 120000;
        eqIds.forEach((assetId, idx) => {
          assignments.push({
            id: newTrendId(),
            trendDefinitionId: def.id,
            assetId,
            assignedAt: new Date().toISOString(),
            loggingEnabled: true,
            isDefault: idx === 0,
            recordingStartedAt: started,
            recordingDurationDays: 14,
          });
        });
      }
    });
  } catch {
    return emptyTrendStore();
  }

  return { definitions, assignments, trendHistory: {} };
}

/**
 * @param {TrendDataStore} store
 * @param {string} assetId
 * @returns {TrendAssignment[]}
 */
export function getAssignmentsForAsset(store, assetId) {
  return store.assignments.filter((a) => a.assetId === assetId);
}

/**
 * @param {TrendDataStore} store
 * @param {string} id
 * @returns {TrendDefinition | undefined}
 */
export function getDefinitionById(store, id) {
  return store.definitions.find((d) => d.id === id);
}

/**
 * @param {TrendDataStore} store
 * @param {string} assignmentId
 * @returns {{ assignment: TrendAssignment; definition: TrendDefinition } | null}
 */
export function resolveAssignment(store, assignmentId) {
  const assignment = store.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return null;
  const definition = getDefinitionById(store, assignment.trendDefinitionId);
  if (!definition) return null;
  return { assignment, definition };
}

/**
 * Ensure a single default assignment per asset.
 * @param {TrendAssignment[]} list
 * @param {string} assetId
 * @param {string} defaultId
 */
export function markDefaultAssignment(list, assetId, defaultId) {
  return list.map((a) =>
    a.assetId === assetId ? { ...a, isDefault: a.id === defaultId } : a
  );
}

/**
 * @param {TrendDataStore} store
 * @param {string} siteDisplayName
 * @param {string} assetId
 * @param {string} assignmentId
 */
export function rememberSelectedAssignment(siteDisplayName, assetId, assignmentId) {
  try {
    const k = selectionSessionKey(siteDisplayName, assetId);
    sessionStorage.setItem(k, assignmentId);
  } catch {
    /* */
  }
}

/**
 * @param {string} siteDisplayName
 * @param {string} assetId
 */
export function readSelectedAssignment(siteDisplayName, assetId) {
  try {
    return sessionStorage.getItem(selectionSessionKey(siteDisplayName, assetId)) || "";
  } catch {
    return "";
  }
}

/** @param {string} siteDisplayName @param {string} assetId */
function selectionSessionKey(siteDisplayName, assetId) {
  return `legion.trends.selection::${encodeURIComponent(siteDisplayName || "__")}::${encodeURIComponent(assetId)}`;
}
