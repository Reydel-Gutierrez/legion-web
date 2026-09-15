/**
 * Operator workspace rows derived from an active release / deployment snapshot only.
 * No standalone fabricated points — those will come from runtime API later.
 */

import { USE_HIERARCHY_API } from "./config";
import {
  getWorkspaceRowsFromRelease,
  enrichWorkspaceRowsWithAddresses,
  mergeTemplateCommandMetaIntoWorkspaceRows,
  enrichWorkspaceRowsWithMappedTo,
} from "../activeReleaseUtils";

function isOfflineStatusLabel(s) {
  const x = String(s || "").trim().toLowerCase();
  if (!x) return false;
  return ["offline", "down", "disabled"].includes(x) || x.includes("offline");
}

function isEquipmentOfflineInRelease(eq) {
  if (!eq) return false;
  if (isOfflineStatusLabel(eq.status)) return true;
  if (isOfflineStatusLabel(eq.commStatus)) return true;
  if (eq.controllerOnline === false) return true;
  return false;
}

function blankWorkspaceRowsForCommLoss(rows) {
  return rows.map((r) => ({
    ...r,
    value: "—",
    presentValueRaw: null,
    status: "OFFLINE",
  }));
}

function hasControllerAssigned(eq) {
  if (!eq) return false;
  const ref = eq.controllerRef;
  if (ref == null) return false;
  return String(ref).trim().length > 0;
}

function hasPersistedPointMappingsInRelease(releaseData, equipmentId) {
  const m =
    releaseData?.mappings?.[equipmentId] ??
    releaseData?.mappings?.[String(equipmentId)] ??
    {};
  if (!m || typeof m !== "object") return false;
  return Object.values(m).some((v) => v != null && String(v).trim() !== "");
}

function stripWorkspaceRowsWhenNoController(rows) {
  return rows.map((r) => ({
    ...r,
    value: "—",
    presentValueRaw: null,
    status: "Unbound",
  }));
}

/**
 * @param {string|number} equipmentId
 * @param {string} equipmentName
 * @param {string} [status]
 * @param {{ activeRelease?: object, activeDeployment?: object }} [options]
 * @returns {import("./contracts").WorkspaceRow[]}
 */
export function getWorkspacePointsForEquipmentFromRelease(equipmentId, equipmentName, status, options = {}) {
  const releaseData = options.activeRelease ?? options.activeDeployment;
  if (!releaseData) return [];

  const eqFromRelease = releaseData?.equipment?.find((e) => String(e.id) === String(equipmentId)) ?? null;
  const commOffline = isOfflineStatusLabel(status) || isEquipmentOfflineInRelease(eqFromRelease);

  const eq = eqFromRelease;
  let rows = [];
  if (eq?.livePoints && Array.isArray(eq.livePoints) && eq.livePoints.length > 0) {
    rows = eq.livePoints;
  } else {
    rows = getWorkspaceRowsFromRelease(releaseData, equipmentId, equipmentName);
  }

  if (rows.length === 0) {
    return [];
  }

  let out = enrichWorkspaceRowsWithAddresses(releaseData, equipmentId, rows);
  out = mergeTemplateCommandMetaIntoWorkspaceRows(releaseData, equipmentId, out);
  out = enrichWorkspaceRowsWithMappedTo(releaseData, equipmentId, out);
  if (commOffline) {
    out = blankWorkspaceRowsForCommLoss(out);
  } else if (
    USE_HIERARCHY_API &&
    !hasControllerAssigned(eqFromRelease) &&
    !hasPersistedPointMappingsInRelease(releaseData, equipmentId)
  ) {
    out = stripWorkspaceRowsWhenNoController(out);
  }
  return out;
}
