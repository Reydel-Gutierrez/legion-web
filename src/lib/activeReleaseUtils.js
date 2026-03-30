/**
 * Helpers to derive Operator UI data from an active release payload (`activeRelease.data`).
 */

import {
  getTemplatePoints,
  getDiscoveredObjects,
} from "../modules/engineering/data/mockPointMappingData";
import { formatOperatorWorkspaceValue } from "./equipmentTemplatePointModel";
import { USE_HIERARCHY_API } from "./data/config";

/** Binding status for logical points when no physical device is mapped */
export const BINDING_STATUS = {
  LIVE: "live",
  MAPPED: "mapped",
  UNBOUND: "unbound",
  SIMULATED: "simulated",
};

/**
 * Resolve site / building / floor labels and ids for an equipment row in a deployment snapshot.
 * @returns {{ siteName: string, siteId: string, buildingName: string, buildingId: string, floorName: string, floorId: string, equipmentLabel: string }}
 */
export function resolveEquipmentLocationInRelease(releaseData, equipmentId) {
  const empty = {
    siteName: "",
    siteId: "",
    buildingName: "",
    buildingId: "",
    floorName: "",
    floorId: "",
    equipmentLabel: "",
  };
  const eq = releaseData?.equipment?.find((e) => String(e.id) === String(equipmentId));
  if (!eq) return empty;
  const site = releaseData?.site;
  const siteName = site?.name || "";
  const siteId = site?.id || "";
  let buildingName = "";
  let buildingId = eq.buildingId || "";
  let floorName = "";
  const floorId = eq.floorId || "";
  for (const b of site?.buildings || []) {
    for (const f of b.floors || []) {
      if (String(f.id) === String(eq.floorId)) {
        buildingName = b.name || "";
        buildingId = b.id || buildingId;
        floorName = f.name || "";
        break;
      }
    }
    if (floorName) break;
  }
  const equipmentLabel = eq.displayLabel || eq.name || String(equipmentId);
  return {
    siteName,
    siteId,
    buildingName,
    buildingId,
    floorName,
    floorId,
    equipmentLabel,
  };
}

/** Human-readable path for operators: Site / Building / Floor / Equipment / pointId */
export function buildPointHierarchyAddress(releaseData, equipmentId, pointId) {
  const pid = pointId != null ? String(pointId) : "";
  if (!releaseData?.equipment) return pid;
  const loc = resolveEquipmentLocationInRelease(releaseData, equipmentId);
  const parts = [loc.siteName, loc.buildingName, loc.floorName, loc.equipmentLabel, pid].filter(
    (x) => x != null && String(x).trim().length > 0
  );
  if (parts.length <= 1 && loc.equipmentLabel) {
    return [loc.equipmentLabel, pid].filter((x) => String(x || "").length > 0).join("/");
  }
  return parts.length > 0 ? parts.join("/") : pid;
}

/** Stable id path for APIs / tooltips: siteId/buildingId/floorId/equipmentId/pointId */
export function buildPointPathKey(releaseData, equipmentId, pointId) {
  const pid = pointId != null ? String(pointId) : "";
  if (!releaseData?.equipment) return [equipmentId, pid].filter((x) => String(x ?? "").length > 0).join("/");
  const loc = resolveEquipmentLocationInRelease(releaseData, equipmentId);
  const parts = [loc.siteId, loc.buildingId, loc.floorId, String(equipmentId ?? ""), pid].filter(
    (x) => x != null && String(x).trim().length > 0
  );
  return parts.join("/");
}

/**
 * Match a workspace row (API live point or release row) to a normalized template point.
 */
export function findTemplatePointForWorkspaceRow(row, templatePoints) {
  if (!row || !Array.isArray(templatePoints) || templatePoints.length === 0) return null;
  const pid = String(row.pointId ?? "").trim();
  const pref = String(row.pointReferenceId ?? "").trim();
  const pk = String(row.pointKey ?? "").trim().toLowerCase();

  let tp = templatePoints.find((t) => String(t.id) === pid);
  if (tp) return tp;
  tp = templatePoints.find((t) => String(t.id) === pref);
  if (tp) return tp;

  if (pk) {
    tp = templatePoints.find((t) => String(t.key || "").trim().toLowerCase() === pk);
    if (tp) return tp;
    tp = templatePoints.find((t) => String(t.mappingHint || "").trim().toLowerCase() === pk);
    if (tp) return tp;
    tp = templatePoints.find((t) => String(t.referenceId || "").trim().toLowerCase() === pk);
    if (tp) return tp;
  }

  const pname = String(row.pointDescription || row.pointName || "").trim().toLowerCase();
  if (pname) {
    tp = templatePoints.find((t) => String(t.label || "").trim().toLowerCase() === pname);
    if (tp) return tp;
    tp = templatePoints.find((t) => String(t.displayName || "").trim().toLowerCase() === pname);
    if (tp) return tp;
  }
  return null;
}

/**
 * Derive operator control value from row display string when presentValueRaw is missing (e.g. API merge).
 * @param {import("../data/contracts").WorkspaceRow} row
 * @param {object} tp - normalized template point from getTemplatePoints
 */
export function resolvePresentValueRawFromWorkspaceRow(row, tp) {
  const ct = (tp && tp.commandType) || row.commandType || "none";
  const cfg = (tp && tp.commandConfig) || row.commandConfig || {};

  if (row.presentValueRaw !== undefined && row.presentValueRaw !== null) {
    return row.presentValueRaw;
  }

  const v = row.value;
  if (v === null || v === undefined || v === "—") {
    if (ct === "numeric" || ct === "percentage") return "";
    if (ct === "boolean") return false;
    return null;
  }

  const s = String(v).trim();

  if (ct === "boolean") {
    const sl = s.toLowerCase();
    if (sl === "on" || sl === "true" || sl === "active" || s === "1") return true;
    if (sl === "off" || sl === "false" || sl === "inactive" || s === "0") return false;
    return false;
  }

  if (ct === "enum") {
    const opts = cfg.options || [];
    const match = opts.find((o) => o.label === s || String(o.value) === s);
    if (match) return match.value;
    const num = Number(s);
    if (s !== "" && !Number.isNaN(num)) return num;
    return s;
  }

  if (ct === "numeric" || ct === "percentage") {
    const m = s.match(/^-?\d*\.?\d+/);
    return m ? parseFloat(m[0]) : "";
  }

  return row.presentValueRaw ?? s;
}

/**
 * Attach commandType / commandConfig / writable / presentValueRaw from equipment template when API live rows omit them.
 * @param {object} releaseData
 * @param {string|number} equipmentId
 * @param {import("../data/contracts").WorkspaceRow[]} rows
 */
export function mergeTemplateCommandMetaIntoWorkspaceRows(releaseData, equipmentId, rows) {
  if (!releaseData || !Array.isArray(rows) || rows.length === 0) return rows;
  const eq = releaseData.equipment?.find((e) => String(e.id) === String(equipmentId));
  if (!eq?.templateName) return rows;
  const templatePoints = getTemplatePoints(eq.templateName, releaseData.templates?.equipmentTemplates);
  if (!templatePoints.length) return rows;

  return rows.map((row) => {
    const tp = findTemplatePointForWorkspaceRow(row, templatePoints);
    if (!tp) return row;
    const presentValueRaw = resolvePresentValueRawFromWorkspaceRow(row, tp);
    return {
      ...row,
      commandType: tp.commandType,
      commandConfig: tp.commandConfig,
      expectedType: tp.expectedObjectType,
      presentValueRaw,
      templatePointId: tp.id,
    };
  });
}

/**
 * Human-readable "Mapped to" for operator workspace (controller ref + BACnet object ref when discoverable).
 * @param {object} releaseData
 * @param {string|number} equipmentId
 * @param {import("../data/contracts").WorkspaceRow[]} rows
 */
export function enrichWorkspaceRowsWithMappedTo(releaseData, equipmentId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const eq = releaseData?.equipment?.find((e) => String(e.id) === String(equipmentId));
  const mapRoot = releaseData?.mappings;
  if (!mapRoot || typeof mapRoot !== "object") {
    return rows.map((r) => ({ ...r, mappedToLabel: "—" }));
  }
  const eid = String(equipmentId);
  const mappingsForEq = mapRoot[equipmentId] ?? mapRoot[eid] ?? {};
  const controllerRef = eq?.controllerRef ?? null;
  const discovered =
    USE_HIERARCHY_API || !controllerRef ? [] : getDiscoveredObjects(controllerRef);

  return rows.map((row) => {
    const tid = row.templatePointId != null ? String(row.templatePointId) : "";
    const pid = row.pointId != null ? String(row.pointId) : "";
    const mappedObjectId =
      (tid && mappingsForEq[tid]) || (pid && mappingsForEq[pid]) || undefined;
    if (!mappedObjectId) {
      return { ...row, mappedToLabel: "—" };
    }
    const obj = discovered.find((o) => o.id === mappedObjectId);
    const refPart = obj
      ? String(obj.bacnetRef || obj.displayName || mappedObjectId).trim()
      : String(mappedObjectId);
    const ctrl =
      controllerRef != null && String(controllerRef).trim() !== "" ? String(controllerRef).trim() : "";
    const label = ctrl ? `${ctrl} → ${refPart}` : refPart;
    return { ...row, mappedToLabel: label };
  });
}

/** Attach pointAddress / pointPathKey when missing (e.g. API livePoints rows). */
export function enrichWorkspaceRowsWithAddresses(releaseData, equipmentId, rows) {
  if (!Array.isArray(rows)) return [];
  const hasDeploy = Boolean(releaseData?.equipment && Array.isArray(releaseData.equipment));
  return rows.map((r) => {
    const pid = r.pointId != null ? String(r.pointId) : "";
    const pointAddress =
      r.pointAddress ??
      (hasDeploy
        ? buildPointHierarchyAddress(releaseData, equipmentId, pid)
        : [r.equipmentName, pid].filter((x) => String(x || "").trim().length > 0).join("/"));
    const pointPathKey =
      r.pointPathKey ??
      (hasDeploy
        ? buildPointPathKey(releaseData, equipmentId, pid)
        : [equipmentId, pid].filter((x) => String(x || "").trim().length > 0).join("/"));
    return {
      ...r,
      pointAddress,
      pointPathKey,
    };
  });
}

/**
 * @param {object} releaseData - Snapshot payload (site, equipment, templates, …)
 */
export function getLogicalPointsForEquipmentFromRelease(releaseData, equipmentId) {
  if (!releaseData?.equipment) return [];
  const eq = releaseData.equipment.find((e) => String(e.id) === String(equipmentId));
  if (!eq?.templateName) return [];
  const templatePoints = getTemplatePoints(eq.templateName, releaseData.templates?.equipmentTemplates);
  return templatePoints.map((tp) => ({
    id: tp.id,
    name: tp.displayName,
    key: tp.key,
    pointKey: tp.key,
    pointDescription: (tp.label || tp.displayName || "").trim(),
    referenceId: tp.mappingHint || tp.referenceId || tp.key || tp.id,
    units: tp.units || "",
    valueType: tp.expectedObjectType,
    writable: tp.writable,
    commandType: tp.commandType,
    commandConfig: tp.commandConfig,
  }));
}

export function getWorkspaceRowsFromRelease(releaseData, equipmentId, equipmentName) {
  if (!releaseData?.equipment) return [];
  const eq = releaseData.equipment.find((e) => String(e.id) === String(equipmentId));
  if (!eq?.templateName) return [];
  const templatePoints = getTemplatePoints(eq.templateName, releaseData.templates?.equipmentTemplates);
  if (templatePoints.length === 0) return [];
  const mappings = releaseData?.mappings?.[equipmentId] || {};
  const controllerRef = eq.controllerRef;
  // Mock discovery is for local engineering demos only; API deployments must not show fake "live" BACnet.
  const discovered =
    USE_HIERARCHY_API || !controllerRef ? [] : getDiscoveredObjects(controllerRef);
  /** @type {import("../data/contracts").WorkspaceRow[]} */
  const rows = templatePoints.map((tp) => {
    const bacnetId = mappings[tp.id];
    const bacnetObj = bacnetId && discovered.find((o) => o.id === bacnetId);
    const hasLive = bacnetObj && (bacnetObj.status || "").toLowerCase() !== "offline";
    // No placeholder numerics for unmapped points — operators should see "—", not fake 72°F / 50%.
    const displayValue = hasLive ? bacnetObj.presentValue : null;
    const valueStr = formatOperatorWorkspaceValue(displayValue, tp);
    const addrRef = tp.mappingHint || tp.referenceId || tp.key || tp.id;
    const pointAddress = buildPointHierarchyAddress(releaseData, equipmentId, tp.id);
    const pointPathKey = buildPointPathKey(releaseData, equipmentId, tp.id);
    const pointDescription = (tp.label || tp.displayName || "").trim();
    const pointKey = String(tp.key || "").trim();
    return {
      id: `${equipmentId}-${tp.id}`,
      equipmentId,
      equipmentName,
      pointId: tp.id,
      pointKey,
      pointDescription,
      pointName: pointDescription || pointKey || String(tp.id),
      pointReferenceId: addrRef,
      pointAddress,
      pointPathKey,
      value: valueStr,
      units: tp.units || "",
      status: hasLive ? "OK" : "Unbound",
      writable: tp.writable,
      commandType: tp.commandType,
      commandConfig: tp.commandConfig,
      expectedType: tp.expectedObjectType,
      presentValueRaw: displayValue,
    };
  });
  return rows;
}

export function getEquipmentFromRelease(releaseData, equipmentIdOrInstance) {
  if (!releaseData?.equipment || !equipmentIdOrInstance) return null;
  const key = String(equipmentIdOrInstance).trim();
  return (
    releaseData.equipment.find(
      (e) => String(e.id) === key || String(e.instanceNumber || "").trim() === key
    ) || null
  );
}

/**
 * Operator equipment sidebar: Building → Floor → Equipment so duplicate floor names
 * across towers stay unambiguous (e.g. Tower A / Deck vs Tower B / Deck).
 */
export function activeReleaseDataToEquipmentTree(releaseData) {
  if (!releaseData?.site?.buildings?.length || !Array.isArray(releaseData.equipment)) {
    return [];
  }
  const equipment = releaseData.equipment;
  const byFloor = {};
  equipment.forEach((eq) => {
    const floorId = eq.floorId || "unknown";
    if (!byFloor[floorId]) byFloor[floorId] = [];
    byFloor[floorId].push({
      id: eq.id,
      instanceNumber: eq.instanceNumber || null,
      label: eq.displayLabel || eq.name || eq.id,
      status: eq.status || "Normal",
      type: "equip",
    });
  });

  const buildingNodes = [];
  releaseData.site.buildings.forEach((b) => {
    const floorChildren = [];
    (b.floors || []).forEach((f) => {
      const eqList = byFloor[f.id] || [];
      const sub = eqList.length
        ? eqList
            .slice(0, 3)
            .map((e) => e.label)
            .join(" • ") + (eqList.length > 3 ? ` +${eqList.length - 3}` : "")
        : "No equipment";
      floorChildren.push({
        id: f.id,
        label: f.name || f.label || String(f.id),
        sub,
        type: "floor",
        children: eqList,
      });
    });
    const buildingLabel = b.name || b.buildingCode || "Building";
    buildingNodes.push({
      id: b.id,
      label: buildingLabel,
      sub:
        floorChildren.length > 0
          ? `${floorChildren.length} floor${floorChildren.length === 1 ? "" : "s"}`
          : "No floors",
      type: "building",
      children: floorChildren,
    });
  });

  const chillerPlant = equipment.filter((e) => (e.type || "").toLowerCase().includes("ch"));
  if (chillerPlant.length > 0) {
    return [
      {
        id: "plant",
        label: "Chiller Plant",
        sub: "Chiller",
        type: "group",
        children: chillerPlant.map((e) => ({
          id: e.id,
          instanceNumber: e.instanceNumber || null,
          label: e.displayLabel || e.name,
          status: e.status || "Online",
          type: "equip",
        })),
      },
      ...buildingNodes,
    ];
  }
  return buildingNodes;
}

export function getSummaryFromActiveRelease(releaseData) {
  const equipment = releaseData?.equipment ?? [];
  return {
    equipmentCount: equipment.length,
    activeAlarms: 0,
    unackedAlarms: 0,
    devicesOffline: 0,
    openTasks: 0,
    energyRuntime: null,
  };
}

export function getFloorCommunicationHealthFromRelease(releaseData) {
  if (!releaseData?.site?.buildings?.length) return [];
  const equipment = releaseData.equipment ?? [];
  const rows = [];
  for (const b of releaseData.site.buildings) {
    for (const f of b.floors || []) {
      const onFloor = equipment.filter((e) => e.floorId === f.id);
      const total = onFloor.length;
      const online = onFloor.filter((e) => Boolean(e.controllerRef)).length;
      const pct = total === 0 ? 100 : Math.round((100 * online) / total);
      const offline = total - online;
      rows.push({
        id: f.id,
        label: f.name || f.label || String(f.id),
        buildingLabel: b.name || "",
        pct,
        offline,
        total,
        online,
      });
    }
  }
  return rows;
}

export function getEquipmentHealthFromActiveRelease(releaseData) {
  const equipment = releaseData.equipment ?? [];
  return equipment.slice(0, 12).map((eq) => ({
    id: eq.id,
    name: eq.displayLabel || eq.name,
    status: eq.status === "CONTROLLER_ASSIGNED" || eq.status === "READY_FOR_MAPPING" ? "OK" : "Warn",
    comm: eq.controllerRef ? "Online" : "Offline",
    lastUpdate: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }),
  }));
}
