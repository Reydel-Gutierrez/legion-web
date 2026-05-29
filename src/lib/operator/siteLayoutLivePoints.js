import { isZoneShape } from "../../modules/engineering/graphics-manager/floorZoneModel";
import { operatorRepository } from "../data";
import { USE_HIERARCHY_API } from "../data/config";
import { isBackendSiteId } from "../data/siteIdUtils";
import { applyHierarchyLiveToWorkspaceRows } from "./operatorWorkspaceHierarchyMerge";
import { getEquipmentStatus } from "./statusUtils";

/** Zone widget field → Legion / template point codes and keys (same aliases as workspace merge). */
const ZONE_BINDING_FIELD_CODES = {
  zoneTemp: ["SPACE_TEMP", "ROOM_TEMP", "ZONE_TEMP", "RM-T", "RM_T", "ZONETEMP"],
  spaceTemp: ["SPACE_TEMP", "ROOM_TEMP", "ZONE_TEMP", "RM-T", "RM_T"],
  setpoint: ["SPACE_TEMP_SP", "SETPOINT", "ZONE_SETPOINT", "CLG-SP", "CLG_SP", "COOLING_SETPOINT"],
  occupancy: ["OCCUPIED", "OCCUPANCY", "OCC"],
  alarmState: ["ALARM_STATUS", "ALARM", "ALM"],
  mode: ["UNIT_STATUS", "MODE", "OPERATING_MODE"],
  zoneStatus: ["UNIT_STATUS"],
};

/** @param {string} s */
function normKey(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

/** @param {string} s */
function compactKey(s) {
  return String(s || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/** @param {string} pointKey */
function pointKeyVariants(pointKey) {
  const pk = String(pointKey || "").trim();
  const out = new Set();
  if (!pk) return [];
  out.add(normKey(pk));
  out.add(compactKey(pk));
  const snake = pk
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_");
  out.add(snake.toUpperCase());
  return [...out].filter(Boolean);
}

/**
 * @param {object[]} rows
 * @returns {Map<string, object>}
 */
function indexWorkspaceRows(rows) {
  const byKey = new Map();
  const add = (key, row) => {
    const k = normKey(key);
    if (k && !byKey.has(k)) byKey.set(k, row);
    const c = compactKey(key);
    if (c && !byKey.has(c)) byKey.set(c, row);
  };
  for (const row of rows) {
    add(row.pointId, row);
    add(row.templatePointId, row);
    add(row.databasePointId, row);
    add(row.id, row);
    add(row.pointKey, row);
    add(row.pointReferenceId, row);
    add(row.pointName, row);
    for (const v of pointKeyVariants(row.pointKey)) add(v, row);
    for (const v of pointKeyVariants(row.pointReferenceId)) add(v, row);
  }
  return byKey;
}

/** @param {object|null|undefined} row */
function formatWorkspaceRowForZone(row) {
  if (!row) return null;
  if (row.status === "OFFLINE") return "Offline";
  if (row.status === "Unbound") return "—";
  const v = row.value;
  if (v == null || v === "" || v === "—") return "—";
  return String(v);
}

/**
 * @param {object[]} dbPoints
 * @param {string[]} codes
 */
function findDbPointByCodes(dbPoints, codes) {
  if (!Array.isArray(dbPoints) || !codes?.length) return null;
  const wanted = new Set(codes.map(normKey));
  return (
    dbPoints.find((p) => {
      const code = normKey(p.pointCode || p.code);
      return code && wanted.has(code);
    }) || null
  );
}

/** @param {object} pt */
function formatDbPointForZone(pt) {
  if (!pt || pt.presentValue == null || pt.presentValue === "") return "—";
  const comm = String(pt.commState || "").trim().toUpperCase();
  if (comm === "OFFLINE") return "Offline";
  const val = String(pt.presentValue);
  const unit = pt.unit || pt.units || "";
  return unit ? `${val} ${unit}`.trim() : val;
}

/**
 * @param {Map<string, object>} index
 * @param {string} ref
 * @param {object[]} rows
 */
function lookupWorkspaceRow(index, ref, rows) {
  if (!ref) return null;
  const direct = index.get(normKey(ref)) || index.get(compactKey(ref));
  if (direct) return direct;
  return (
    rows.find(
      (r) =>
        String(r.pointId) === String(ref) ||
        String(r.templatePointId) === String(ref) ||
        String(r.databasePointId) === String(ref) ||
        String(r.id) === String(ref)
    ) || null
  );
}

/**
 * Resolve zone widget fields from hydrated operator workspace rows (+ optional live bundle).
 * Uses explicit pointBindings first, then semantic point-code aliases, then raw DB points.
 *
 * @param {object} zoneConfig
 * @param {object[]} equipmentRows - merged workspace rows for linked equipment
 * @param {{ points?: object[] }|null|undefined} [bundle]
 * @returns {Record<string, string|null>}
 */
export function resolveOperatorZonePointValues(zoneConfig, equipmentRows, bundle = null) {
  if (!Array.isArray(equipmentRows) || equipmentRows.length === 0) {
    return {};
  }
  const pb = zoneConfig?.pointBindings || {};
  const index = indexWorkspaceRows(equipmentRows);
  const out = {};
  const fields = Object.keys(ZONE_BINDING_FIELD_CODES);

  for (const field of fields) {
    const boundId = pb[field];
    let row = boundId ? lookupWorkspaceRow(index, String(boundId), equipmentRows) : null;
    let formatted = formatWorkspaceRowForZone(row);

    if (!formatted || formatted === "—") {
      const codes = ZONE_BINDING_FIELD_CODES[field] || [];
      row =
        codes
          .map((code) => lookupWorkspaceRow(index, code, equipmentRows))
          .find(Boolean) ||
        equipmentRows.find((r) => {
          const variants = new Set([
            ...pointKeyVariants(r.pointKey),
            ...pointKeyVariants(r.pointReferenceId),
            normKey(r.pointId),
          ]);
          return codes.some((code) => variants.has(normKey(code)));
        }) ||
        null;
      formatted = formatWorkspaceRowForZone(row);
    }

    if ((!formatted || formatted === "—") && bundle?.points) {
      const dbPt = findDbPointByCodes(bundle.points, ZONE_BINDING_FIELD_CODES[field]);
      const dbFormatted = formatDbPointForZone(dbPt);
      if (dbFormatted && dbFormatted !== "—") {
        formatted = dbFormatted;
      }
    }

    if (formatted != null) {
      out[field] = formatted;
    }
  }

  return out;
}

/** Empty zone field values — never show fabricated temps in operator layout. */
export function buildEmptyZonePointValues() {
  return {
    zoneTemp: "—",
    spaceTemp: "—",
    setpoint: "—",
    occupancy: "—",
    alarmState: "—",
    mode: "—",
    comms: "Offline",
    zoneStatus: "No Data",
  };
}

/**
 * Collect equipment ids referenced by floor-plan zones and value bindings.
 * @param {object|null|undefined} graphic
 * @param {object|null|undefined} releaseData
 * @returns {string[]}
 */
export function collectLayoutGraphicEquipmentIds(graphic, releaseData) {
  const ids = new Set();
  const objects = graphic?.objects || [];

  objects.forEach((obj) => {
    if (isZoneShape(obj)) {
      const eqId = obj.zoneConfig?.linkedEquipmentId;
      if (eqId) ids.add(String(eqId));
    }
    if (obj.type === "value" && obj.bindings?.[0]?.pointId && releaseData?.equipment) {
      const pointId = String(obj.bindings[0].pointId);
      for (const eq of releaseData.equipment) {
        const rows = operatorRepository.getWorkspacePointsForEquipment(
          eq.id,
          eq.displayLabel || eq.name,
          eq.status,
          { activeRelease: releaseData }
        );
        if (rows.some((r) => String(r.pointId) === pointId)) {
          ids.add(String(eq.id));
          break;
        }
      }
    }
  });

  return [...ids];
}

/**
 * Build workspace rows for all equipment on the layout graphic, merged with live hierarchy data.
 * @param {object|null|undefined} releaseData
 * @param {string[]} equipmentIds
 * @param {Map<string, object>} bundlesByEquipmentId
 * @param {number} now
 * @returns {object[]}
 */
export function buildHydratedLayoutWorkspaceRows(releaseData, equipmentIds, bundlesByEquipmentId, now) {
  if (!releaseData || !Array.isArray(equipmentIds) || equipmentIds.length === 0) return [];

  const allRows = [];
  for (const eqId of equipmentIds) {
    const eq = releaseData.equipment?.find((e) => String(e.id) === String(eqId));
    if (!eq) continue;
    const baseRows = operatorRepository.getWorkspacePointsForEquipment(
      eq.id,
      eq.displayLabel || eq.name,
      eq.status,
      { activeRelease: releaseData }
    );
    allRows.push(...baseRows);
  }

  if (
    !USE_HIERARCHY_API ||
    !bundlesByEquipmentId ||
    bundlesByEquipmentId.size === 0
  ) {
    return allRows;
  }

  return applyHierarchyLiveToWorkspaceRows(allRows, releaseData, bundlesByEquipmentId, now);
}

/**
 * Convert merged workspace rows to DeployedGraphicPreview point rows.
 * @param {object[]} rows
 * @returns {Array<{ pointId: string, value: *, status: string, commFreshnessStatus?: string, lastSeenAt?: string|null }>}
 */
export function workspaceRowsToGraphicPoints(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    pointId: r.pointId,
    value: r.value,
    status: r.status,
    commFreshnessStatus: r.commFreshnessStatus,
    lastSeenAt: r.lastSeenAt ?? null,
    units: r.units,
  }));
}

/**
 * Derive equipment comm label from runtime/controller bundle (LIVE / STALE / OFFLINE).
 * @param {object|null|undefined} bundle
 * @param {number} now
 * @returns {string}
 */
export function equipmentCommLabelFromBundle(bundle, now = Date.now()) {
  if (!bundle) return "Offline";
  const rt = bundle.runtime;
  const ctrl = bundle.controller;
  if (rt?.online === false) return "Offline";
  const lastSeen = rt?.lastSeenAt ?? ctrl?.lastSeenAt ?? null;
  const pollMs = rt?.pollRateMs ?? ctrl?.pollRateMs;
  const status = getEquipmentStatus({ lastSeenAt: lastSeen, pollRateMs: pollMs, now });
  if (status === "LIVE") return "Online";
  if (status === "STALE") return "Stale";
  return "Offline";
}

/**
 * Human-readable comm freshness for zone status pill (matches Equipment page vocabulary).
 * @param {object|null|undefined} bundle
 * @param {number} now
 * @returns {"LIVE"|"STALE"|"OFFLINE"|null}
 */
export function equipmentCommFreshnessFromBundle(bundle, now = Date.now()) {
  if (!bundle) return "OFFLINE";
  const rt = bundle.runtime;
  const ctrl = bundle.controller;
  if (rt?.online === false) return "OFFLINE";
  const lastSeen = rt?.lastSeenAt ?? ctrl?.lastSeenAt ?? null;
  const pollMs = rt?.pollRateMs ?? ctrl?.pollRateMs;
  return getEquipmentStatus({ lastSeenAt: lastSeen, pollRateMs: pollMs, now });
}

/**
 * Enrich zone display values with equipment comm status when linked equipment has a bundle.
 * @param {Record<string, string>} zoneValues
 * @param {string|null|undefined} linkedEquipmentId
 * @param {Map<string, object>} bundlesByEquipmentId
 * @param {number} now
 * @returns {Record<string, string>}
 */
export function enrichZoneValuesWithEquipmentComm(zoneValues, linkedEquipmentId, bundlesByEquipmentId, now) {
  if (!linkedEquipmentId || !bundlesByEquipmentId) return zoneValues;
  const bundle = bundlesByEquipmentId.get(String(linkedEquipmentId));
  if (!bundle) {
    return { ...zoneValues, comms: "Offline", zoneStatus: zoneValues.zoneStatus || "No Data" };
  }
  const commFreshness = equipmentCommFreshnessFromBundle(bundle, now);
  const commLabel =
    commFreshness === "LIVE" ? "Online" : commFreshness === "STALE" ? "Stale" : "Offline";
  const zoneStatus =
    commFreshness === "LIVE"
      ? "LIVE"
      : commFreshness === "STALE"
        ? "Stale"
        : "Offline";
  return { ...zoneValues, comms: commLabel, zoneStatus };
}
