/**
 * Merge DB points + Phase 2 point mappings into operator workspace rows (API-backed sites).
 */

import { pointToWorkspaceRow } from "../data/adapters/api/hierarchyApiAdapter";
import { getTemplatePoints } from "../../modules/engineering/data/mockPointMappingData";
import { getEquipmentStatus, getOfflineThresholdMs, DEFAULT_OPERATOR_POLL_MS } from "./statusUtils";

/**
 * Template library keys (often camelCase) vs Legion / SIM `pointCode` (SCREAMING_SNAKE) when mappingHint is blank.
 * Keys: alphanumeric-only uppercase form of `pointKey` (e.g. zoneTemp → ZONETEMP).
 */
const COMPACT_TEMPLATE_KEY_TO_DB = {
  ZONETEMP: ["SPACE_TEMP", "ROOM_TEMP", "ZONE_TEMP"],
  ZONESETPOINT: ["SPACE_TEMP_SP", "SETPOINT", "ZONE_SETPOINT"],
  SPACEZONETSETPOINT: ["SPACE_TEMP_SP", "SETPOINT"],
  FANSTATUS: ["FAN_STATUS"],
  FANCOMMAND: ["FAN_CMD", "FAN_COMMAND"],
  DISCHARGEAIRTEMP: ["DISCHARGE_AIR_TEMP", "SUPPLY_AIR_TEMP", "DAT"],
  SYSTEMENABLE: ["UNIT_STATUS", "OCCUPIED", "SYSTEM_ENABLE"],
  CHWVALVECOMMAND: ["VALVE_CMD", "CHW_VALVE_CMD"],
  CWVALVECOMMAND: ["VALVE_CMD", "CHW_VALVE_CMD"],
  CHILLWATERVALVECOMMAND: ["VALVE_CMD"],
  ALARMSTATUS: ["ALARM_STATUS"],
  COOLINGCALL: ["COOL_CALL"],
  HEATINGCALL: ["HEAT_CALL"],
  OCCUPIED: ["OCCUPIED"],
  UNITSTATUS: ["UNIT_STATUS"],
};

/** @param {string} s */
function normKey(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

/**
 * Template keys are often camelCase (zoneTemp); DB pointCode is often SCREAMING_SNAKE.
 * @param {string} s
 */
function guessSnakeUpperFromCamel(s) {
  const x = String(s || "").trim();
  if (!x) return "";
  const snake = x
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_");
  return snake.toUpperCase();
}

/**
 * Variants of a template / UI point key for matching legionPointCode / fieldPointKey.
 * @param {string} pointKey
 */
function pointKeyMatchVariants(pointKey) {
  const pk = String(pointKey || "").trim();
  const out = new Set();
  if (!pk) return [];
  out.add(normKey(pk));
  out.add(guessSnakeUpperFromCamel(pk));
  out.add(pk.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
  return [...out].filter(Boolean);
}

/**
 * All DB `pointCode` candidates to try for this workspace row (template + common FCU/VAV aliases).
 * @param {object} row
 * @param {object|null|undefined} releaseData
 * @param {string|number} equipmentId
 * @returns {Set<string>} uppercase codes
 */
function collectDbPointCodeHints(row, releaseData, equipmentId) {
  /** @type {Set<string>} */
  const hints = new Set();
  const add = (s) => {
    const n = normKey(s);
    if (n) hints.add(n);
  };

  for (const v of pointKeyMatchVariants(row.pointKey)) add(v);
  for (const v of pointKeyMatchVariants(row.pointReferenceId)) add(v);

  const compact = String(row.pointKey || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const aliasList = COMPACT_TEMPLATE_KEY_TO_DB[compact];
  if (aliasList) aliasList.forEach(add);

  const bid = String(equipmentId ?? "");
  const eq = releaseData?.equipment?.find((e) => String(e.id) === bid);
  if (eq?.templateName) {
    const tps = getTemplatePoints(eq.templateName, releaseData?.templates?.equipmentTemplates);
    const tp = tps.find(
      (t) =>
        String(t.id) === String(row.templatePointId) ||
        String(t.id) === String(row.pointId) ||
        String(t.key || "").toLowerCase() === String(row.pointKey || "").toLowerCase()
    );
    if (tp) {
      if (tp.mappingHint) add(tp.mappingHint);
      if (tp.referenceId) add(tp.referenceId);
      for (const v of pointKeyMatchVariants(tp.key)) add(v);
    }
  }

  return hints;
}

/**
 * Operator-facing controller label: friendly name, not raw BACnet instance when avoidable.
 * @param {{ controller?: object|null }|null} bundle
 * @param {object|null|undefined} eqMeta - equipment row from active release
 */
export function resolveControllerDisplayLabel(bundle, eqMeta) {
  const c = bundle?.controller;
  const dn = c?.displayName != null && String(c.displayName).trim() !== "" ? String(c.displayName).trim() : "";
  if (dn) return dn;
  const eqName = (eqMeta?.displayLabel || eqMeta?.name || "").trim();
  if (eqName) return eqName;
  const code = c?.controllerCode != null && String(c.controllerCode).trim() !== "" ? String(c.controllerCode).trim() : "";
  if (code) return code;
  return "Controller";
}

/**
 * Resolve PointsMapped row for a workspace row.
 * Preferred order: explicit DB / release ids → exact pointCode/key ↔ fieldPointKey → template-hint fallback.
 * @param {object} row
 * @param {object[]} mappings
 * @param {string} mappedIdFromRelease - Legion point UUID from engineering mappings[templateId]
 */
function findPointMappingForRow(row, mappings, mappedIdFromRelease, releaseData, equipmentId) {
  const list = Array.isArray(mappings) ? mappings : [];
  if (!list.length) return null;

  if (row.databasePointId) {
    const hit = list.find((m) => m && String(m.pointId) === String(row.databasePointId));
    if (hit) return hit;
  }
  if (mappedIdFromRelease) {
    const hit = list.find((m) => m && String(m.pointId) === String(mappedIdFromRelease));
    if (hit) return hit;
  }

  const pk = normKey(row.pointKey);
  const pr = normKey(row.pointReferenceId);
  for (const m of list) {
    if (!m) continue;
    const fk = normKey(m.fieldPointKey);
    const lk = normKey(m.legionPointCode);
    if (pk && (fk === pk || lk === pk)) return m;
    if (pr && (fk === pr || lk === pr)) return m;
  }

  const variantArr = [
    ...collectDbPointCodeHints(row, releaseData, equipmentId),
    ...pointKeyMatchVariants(row.pointKey),
    ...pointKeyMatchVariants(row.pointReferenceId),
  ].filter(Boolean);
  const variantSet = new Set(variantArr);
  for (const m of list) {
    if (!m) continue;
    const fk = normKey(m.fieldPointKey);
    const lk = normKey(m.legionPointCode);
    if (fk && variantSet.has(fk)) return m;
    if (lk && variantSet.has(lk)) return m;
  }
  return null;
}

/**
 * @param {object[]} points - raw API point rows
 * @returns {{ byId: Map<string, object>, byCodeNorm: Map<string, object> }}
 */
function indexDbPoints(points) {
  const byId = new Map();
  const byCodeNorm = new Map();
  for (const p of points || []) {
    if (!p || p.id == null) continue;
    byId.set(String(p.id), p);
    const k = normKey(p.pointCode);
    if (k) byCodeNorm.set(k, p);
  }
  return { byId, byCodeNorm };
}

/**
 * @param {string} controllerLabel - operator-facing controller name (not raw device instance when possible)
 * @param {object} m - point mapping DTO
 */
/**
 * Offline band (legacy name): max(90000, poll*4). Used by diagnostics; freshness UI uses {@link getEquipmentStatus}.
 * @param {unknown} pollRateMs
 */
export function staleThresholdMsFromPollRate(pollRateMs) {
  return getOfflineThresholdMs(pollRateMs);
}

function pollMsFromBundle(bundle) {
  return bundle?.controller?.pollRateMs ?? bundle?.runtime?.pollRateMs ?? DEFAULT_OPERATOR_POLL_MS;
}

function isRuntimeHardOffline(bundle) {
  const c = bundle?.controller;
  const rt = bundle?.runtime;
  if (c && String(c.status || "").trim().toUpperCase() === "OFFLINE") return true;
  if (rt && rt.online === false) return true;
  return false;
}

/**
 * Controller LIVE or STALE (still allowed to show last values); OFFLINE blocks the bundle.
 *
 * @param {{ controller?: object|null, runtime?: object|null }|null|undefined} bundle
 * @param {number} [now]
 */
export function isControllerFresh(bundle, now = Date.now()) {
  if (!bundle) return false;
  if (isRuntimeHardOffline(bundle)) return false;
  const rt = bundle.runtime;
  const c = bundle.controller;
  const lastSeen = rt?.lastSeenAt || c?.lastSeenAt;
  const s = getEquipmentStatus({ lastSeenAt: lastSeen, pollRateMs: pollMsFromBundle(bundle), now });
  return s === "LIVE" || s === "STALE";
}

/**
 * Point freshness for merged rows (comm OFFLINE forces OFFLINE; else {@link getEquipmentStatus} on lastSeenAt).
 *
 * @param {object|null|undefined} point - normalized DB point
 * @param {{ controller?: object|null, runtime?: object|null }|null|undefined} bundle
 * @param {number} [now]
 * @returns {"LIVE"|"STALE"|"OFFLINE"}
 */
export function getPointCommFreshness(point, bundle, now = Date.now()) {
  if (!point) return "OFFLINE";
  const comm = String(point.commState || "").trim().toUpperCase();
  if (comm === "OFFLINE") return "OFFLINE";
  return getEquipmentStatus({
    lastSeenAt: point.lastSeenAt,
    pollRateMs: pollMsFromBundle(bundle),
    now,
  });
}

/**
 * @param {object|null|undefined} point
 * @param {{ controller?: object|null, runtime?: object|null }|null|undefined} bundle
 * @param {number} [now]
 */
export function isPointFresh(point, bundle, now = Date.now()) {
  const s = getPointCommFreshness(point, bundle, now);
  return s === "LIVE" || s === "STALE";
}

export function formatHierarchyMappedToLabel(controllerLabel, m) {
  const ctrl =
    controllerLabel != null && String(controllerLabel).trim() !== "" ? String(controllerLabel).trim() : "Controller";
  const name = m.fieldPointName || m.fieldPointKey || m.legionPointCode || "field point";
  const obj =
    m.fieldObjectType && m.fieldObjectInstance != null && String(m.fieldObjectInstance).trim() !== ""
      ? `${m.fieldObjectType} ${m.fieldObjectInstance}`
      : null;
  return obj ? `${ctrl} → ${name} (${obj})` : `${ctrl} → ${name}`;
}

/**
 * Resolve Legion DB point row for a workspace row using release mappings + point codes.
 * @param {object} row
 * @param {object} releaseData
 * @param {string|number} equipmentId
 * @param {{ byId: Map<string, object>, byCodeNorm: Map<string, object> }} idx
 */
function resolveDbPointForWorkspaceRow(row, releaseData, equipmentId, idx, mappingRow) {
  const codeHints = collectDbPointCodeHints(row, releaseData, equipmentId);
  const eid = String(equipmentId);
  const mapEq = releaseData?.mappings?.[equipmentId] ?? releaseData?.mappings?.[eid] ?? {};
  /** Engineering `mappings[equipmentId]` is keyed by template point id (not live pointCode). */
  const templateMapKey =
    row.templatePointId != null && String(row.templatePointId).trim() !== ""
      ? String(row.templatePointId)
      : row.pointId != null && String(row.pointId).trim() !== ""
        ? String(row.pointId)
        : "";
  const mappedIdRaw = templateMapKey
    ? mapEq[row.templatePointId] ?? mapEq[row.pointId] ?? mapEq[templateMapKey]
    : undefined;
  let mappedId =
    mappedIdRaw != null && String(mappedIdRaw).trim() !== "" ? String(mappedIdRaw).trim() : "";

  /** 1) Explicit Phase-2 mapping → Point by id, then by legionPointCode (canonical SIM code). */
  if (mappingRow?.pointId) {
    mappedId = String(mappingRow.pointId).trim() || mappedId;
    const hit = idx.byId.get(String(mappingRow.pointId));
    if (hit) return { pt: hit, mappedId: String(hit.id) };
    if (mappingRow.legionPointCode) {
      const codeHit = idx.byCodeNorm.get(normKey(mappingRow.legionPointCode));
      if (codeHit) return { pt: codeHit, mappedId: String(codeHit.id) };
    }
  }

  if (row.databasePointId) {
    const hit = idx.byId.get(String(row.databasePointId));
    if (hit) return { pt: hit, mappedId: mappedId || String(row.databasePointId) };
  }
  if (mappedId) {
    const hit = idx.byId.get(mappedId);
    if (hit) return { pt: hit, mappedId };
  }
  const pk = row.pointKey != null ? String(row.pointKey) : "";
  const candidates = [
    ...new Set([
      ...codeHints,
      ...pointKeyMatchVariants(pk),
      ...pointKeyMatchVariants(row.pointReferenceId),
    ]),
  ];
  for (const c of candidates) {
    const hit = idx.byCodeNorm.get(c);
    if (hit) return { pt: hit, mappedId: mappedId || String(hit.id) };
  }
  return { pt: null, mappedId };
}

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

/**
 * @param {object[]} rows
 * @param {object|null|undefined} releaseData
 * @param {Map<string, { points?: object[], mappings?: object[], controller?: object|null }>} bundlesByEquipmentId
 * @param {number} [now] - pass a ticking timestamp so LIVE→STALE transitions without waiting on API
 * @returns {object[]}
 */
export function applyHierarchyLiveToWorkspaceRows(rows, releaseData, bundlesByEquipmentId, now = Date.now()) {
  if (!Array.isArray(rows) || rows.length === 0 || !bundlesByEquipmentId || bundlesByEquipmentId.size === 0) {
    return rows;
  }

  const devDiag = isDev ? [] : null;

  const out = rows.map((row) => {
    const bid = String(row.equipmentId ?? "");
    const bundle = bid ? bundlesByEquipmentId.get(bid) : null;
    if (!bundle || !Array.isArray(bundle.points)) {
      if (devDiag) {
        devDiag.push({
          equipmentId: bid,
          templatePointId: row.templatePointId ?? null,
          rowPointKey: row.pointKey,
          rowPointId: row.pointId,
          skip: "no_bundle_or_points",
        });
      }
      return row;
    }

    const idx = indexDbPoints(bundle.points);
    const eqMeta = releaseData?.equipment?.find((e) => String(e.id) === bid);
    const eid = String(row.equipmentId);
    const mapEq = releaseData?.mappings?.[row.equipmentId] ?? releaseData?.mappings?.[eid] ?? {};
    const templateMapKey =
      row.templatePointId != null && String(row.templatePointId).trim() !== ""
        ? String(row.templatePointId)
        : row.pointId != null && String(row.pointId).trim() !== ""
          ? String(row.pointId)
          : "";
    const mappedIdFromRelease =
      templateMapKey && (mapEq[row.templatePointId] ?? mapEq[row.pointId] ?? mapEq[templateMapKey]) != null
        ? String(mapEq[row.templatePointId] ?? mapEq[row.pointId] ?? mapEq[templateMapKey]).trim()
        : "";

    const mappingRow = findPointMappingForRow(
      row,
      bundle.mappings,
      mappedIdFromRelease,
      releaseData,
      row.equipmentId
    );
    const { pt, mappedId } = resolveDbPointForWorkspaceRow(
      row,
      releaseData,
      row.equipmentId,
      idx,
      mappingRow
    );

    const ctrlLabel = resolveControllerDisplayLabel(bundle, eqMeta);

    let mappedToLabel = row.mappedToLabel;
    if (mappingRow) {
      mappedToLabel = formatHierarchyMappedToLabel(ctrlLabel, mappingRow);
    } else if (pt) {
      const code = pt.pointCode != null ? String(pt.pointCode).trim() : "";
      const nm = pt.pointName != null ? String(pt.pointName).trim() : "";
      mappedToLabel = nm
        ? `${ctrlLabel} → ${code || "point"} (${nm})`
        : `${ctrlLabel} → ${code || "point"}`;
    } else if (mappedId || mappedIdFromRelease) {
      const mid = mappedId || mappedIdFromRelease;
      mappedToLabel = `${ctrlLabel} → Legion point (${mid.slice(0, 8)}…)`;
    }

    const pushDiag = (extra) => {
      if (!devDiag) return;
      devDiag.push({
        equipmentId: bid,
        templatePointId: row.templatePointId ?? null,
        rowPointKey: row.pointKey,
        rowPointId: row.pointId,
        databasePointIdOnRow: row.databasePointId ?? null,
        mappingId: mappingRow?.id ?? null,
        mappingFieldKey: mappingRow?.fieldPointKey ?? null,
        mappingPointId: mappingRow?.pointId ?? null,
        resolvedPointId: pt?.id ?? null,
        resolvedPointCode: pt?.pointCode ?? null,
        presentValue: pt?.presentValue ?? null,
        commState: pt?.commState ?? null,
        lastSeenAt: pt?.lastSeenAt ?? null,
        controllerFresh: isControllerFresh(bundle, now),
        ...extra,
      });
    };

    if (!pt) {
      const hasBinding = Boolean(mappedId || mappedIdFromRelease || mappingRow);
      const dbg = hasBinding ? "bound_but_point_row_missing" : "unbound";
      const result = {
        ...row,
        mappedToLabel: hasBinding ? mappedToLabel : "—",
        /** Binding exists in engineering DB but point row missing — comm loss, not an "unmapped" template state. */
        status: hasBinding ? "OFFLINE" : "Unbound",
        ...(isDev && hasBinding ? { __liveDebug: dbg } : {}),
      };
      pushDiag({
        finalStatus: result.status,
        valueShown: result.value,
        dashReason: hasBinding ? "no_relational_point_for_binding" : "unbound",
        __liveDebug: dbg,
      });
      return result;
    }

    if (!isControllerFresh(bundle, now)) {
      const result = {
        ...row,
        mappedToLabel,
        value: "—",
        presentValueRaw: null,
        status: "OFFLINE",
        commFreshnessStatus: "OFFLINE",
        ...(isDev ? { __liveDebug: "controller_stale_or_offline" } : {}),
      };
      pushDiag({
        finalStatus: result.status,
        valueShown: "—",
        dashReason: "controller_stale_or_offline",
        __liveDebug: "controller_stale_or_offline",
      });
      return result;
    }

    const pointFreshness = getPointCommFreshness(pt, bundle, now);
    if (pointFreshness === "OFFLINE") {
      const comm = String(pt.commState || "").trim().toUpperCase();
      const reason = comm === "OFFLINE" ? "point_comm_state_offline" : "point_last_seen_stale_or_unknown";
      const result = {
        ...row,
        mappedToLabel,
        value: "—",
        presentValueRaw: null,
        status: "OFFLINE",
        commFreshnessStatus: "OFFLINE",
        lastSeenAt: pt.lastSeenAt ?? null,
        commState: pt.commState ?? null,
        ...(isDev ? { __liveDebug: reason } : {}),
      };
      pushDiag({
        finalStatus: result.status,
        valueShown: "—",
        dashReason: reason,
        __liveDebug: reason,
      });
      return result;
    }

    const ws = pointToWorkspaceRow(row.equipmentId, row.equipmentName, pt);
    if (!ws) {
      const result = { ...row, mappedToLabel, ...(isDev ? { __liveDebug: "workspace_adapter_rejected" } : {}) };
      pushDiag({
        finalStatus: result.status,
        valueShown: result.value,
        dashReason: "workspace_adapter_rejected",
        __liveDebug: "workspace_adapter_rejected",
      });
      return result;
    }

    const result = {
      ...row,
      value: ws.value,
      presentValueRaw: ws.presentValueRaw,
      databasePointId: ws.databasePointId,
      status: "OK",
      mappedToLabel,
      lastSeenAt: pt.lastSeenAt ?? null,
      commState: pt.commState ?? null,
      commFreshnessStatus: pointFreshness,
    };
    pushDiag({
      finalStatus: "OK",
      valueShown: ws.value,
      dashReason: null,
    });
    return result;
  });

  if (isDev && devDiag && devDiag.length) {
    // eslint-disable-next-line no-console
    console.debug("[operator merge cycle]", {
      workspaceRowCount: devDiag.length,
      perRow: devDiag,
    });
  }

  return out;
}
