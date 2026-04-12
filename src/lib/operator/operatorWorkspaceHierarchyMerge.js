/**
 * Merge DB points + Phase 2 point mappings into operator workspace rows (API-backed sites).
 */

import { pointToWorkspaceRow } from "../data/adapters/api/hierarchyApiAdapter";
import { getTemplatePoints } from "../../modules/engineering/data/mockPointMappingData";

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
 * Find Phase 2 mapping row for this workspace row.
 * @param {object} row
 * @param {object[]} mappings
 * @param {string} mappedIdFromRelease - Legion point UUID from engineering mappings[templateId]
 */
function findPointMappingForRow(row, mappings, mappedIdFromRelease, releaseData, equipmentId) {
  const list = Array.isArray(mappings) ? mappings : [];
  if (mappedIdFromRelease) {
    const hit = list.find((m) => m && String(m.pointId) === String(mappedIdFromRelease));
    if (hit) return hit;
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
 * Runtime API already folds poll staleness into `online` for SIM controllers.
 * @param {{ controller?: object|null, runtime?: object|null }|null|undefined} bundle
 */
function isSimEquipmentRuntimeOffline(bundle) {
  if (!bundle?.controller) return false;
  const proto = String(bundle.controller.protocol || "").trim().toUpperCase();
  if (proto !== "SIM") return false;
  const rt = bundle.runtime;
  if (rt == null) return true;
  return rt.online !== true;
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

/**
 * @param {object[]} rows
 * @param {object|null|undefined} releaseData
 * @param {Map<string, { points?: object[], mappings?: object[], controller?: object|null }>} bundlesByEquipmentId
 * @returns {object[]}
 */
export function applyHierarchyLiveToWorkspaceRows(rows, releaseData, bundlesByEquipmentId) {
  if (!Array.isArray(rows) || rows.length === 0 || !bundlesByEquipmentId || bundlesByEquipmentId.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    const bid = String(row.equipmentId ?? "");
    const bundle = bid ? bundlesByEquipmentId.get(bid) : null;
    if (!bundle || !Array.isArray(bundle.points)) return row;

    if (isSimEquipmentRuntimeOffline(bundle)) {
      return {
        ...row,
        value: "—",
        presentValueRaw: null,
        status: "OFFLINE",
      };
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

    if (!pt) {
      const hasBinding = Boolean(mappedId || mappedIdFromRelease || mappingRow);
      return {
        ...row,
        mappedToLabel: hasBinding ? mappedToLabel : "—",
        /** Binding exists in engineering DB but point row missing — comm loss, not an "unmapped" template state. */
        status: hasBinding ? "OFFLINE" : "Unbound",
      };
    }

    const ws = pointToWorkspaceRow(row.equipmentId, row.equipmentName, pt);
    if (!ws) return { ...row, mappedToLabel };

    return {
      ...row,
      value: ws.value,
      presentValueRaw: ws.presentValueRaw,
      databasePointId: ws.databasePointId,
      status: "OK",
      mappedToLabel,
    };
  });
}
