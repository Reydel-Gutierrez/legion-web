import { useCallback, useEffect, useMemo, useState } from "react";
import { operatorRepository } from "../lib/data";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { isBackendSiteId } from "../lib/data/siteIdUtils";
import { listPointsByEquipment } from "../lib/data/adapters/api/hierarchyApiAdapter";
import * as runtimeApi from "../lib/data/adapters/api/runtimeApiAdapter";
import { getEquipmentControllerByEquipment } from "../lib/data/adapters/api/equipmentControllerApiAdapter";
import { getPointMappingsByEquipment } from "../lib/data/adapters/api/pointMappingApiAdapter";
import { applyHierarchyLiveToWorkspaceRows } from "../lib/operator/operatorWorkspaceHierarchyMerge";
import { resolveLivePointsSourceEquipmentId } from "../lib/operator/operatorWorkspaceLivePointsSource";
import { resolveEquipmentCommStatus } from "../lib/operator/statusUtils";

export const EQUIPMENT_OOS_LABEL = "Out Of Service";

/** @typedef {{ outOfService?: boolean, pendingDisplay?: string, pendingRaw?: unknown }} PointUiPatch */

/**
 * @param {import("../lib/data/contracts").WorkspaceRow} row
 * @param {Record<string, PointUiPatch>} ui
 */
export function equipmentPointDisplayValue(row, ui) {
  const u = ui[row.id];
  if (u?.outOfService) return EQUIPMENT_OOS_LABEL;
  if (u?.pendingDisplay != null && String(u.pendingDisplay).length > 0) return u.pendingDisplay;
  return row.value;
}

/**
 * Live workspace rows + controller freshness for one equipment object.
 * Extracted from EquipmentDetailPage so Operator workspace and detail share the same poll path.
 */
export function useEquipmentLivePoints({ equipment, releaseData, siteId }) {
  const [pointUiState, setPointUiState] = useState({});
  const [hierarchyLiveBundle, setHierarchyLiveBundle] = useState(null);
  const [runtimeForEquipment, setRuntimeForEquipment] = useState(null);
  const [persistedDbController, setPersistedDbController] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const equipmentId = equipment?.id;

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPointUiState({});
    setHierarchyLiveBundle(null);
    setRuntimeForEquipment(null);
    setPersistedDbController(null);
  }, [equipmentId]);

  useEffect(() => {
    if (!USE_HIERARCHY_API || !equipment?.id || !isBackendSiteId(siteId)) {
      setHierarchyLiveBundle(null);
      setRuntimeForEquipment(null);
      setPersistedDbController(null);
      return undefined;
    }
    let cancelled = false;

    async function refreshLive() {
      try {
        const controllers = await runtimeApi.listRuntimeControllers().catch(() => []);
        const ctrlList = Array.isArray(controllers) ? controllers : [];
        const sourceEqId = resolveLivePointsSourceEquipmentId(equipment.id, releaseData, ctrlList);
        const [dbPoints, mappings, dbCtrl] = await Promise.all([
          listPointsByEquipment(sourceEqId),
          getPointMappingsByEquipment(sourceEqId).catch(() => []),
          getEquipmentControllerByEquipment(equipment.id).catch(() => null),
        ]);
        const rt =
          ctrlList.find((c) => c && String(c.equipmentId) === String(equipment.id)) ||
          ctrlList.find((c) => c && String(c.equipmentId) === String(sourceEqId)) ||
          null;
        if (cancelled) return;
        setPersistedDbController(dbCtrl);
        setHierarchyLiveBundle({
          points: Array.isArray(dbPoints) ? dbPoints : [],
          mappings: Array.isArray(mappings) ? mappings : [],
          controller: dbCtrl,
          runtime: rt || null,
        });
        setRuntimeForEquipment(rt || null);
      } catch {
        // Retain the last real sample and let the ticking freshness rules age it.
        // Falling back to release rows here can restore outdated values/status.
      }
    }

    refreshLive();
    const t = window.setInterval(refreshLive, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [equipment, siteId, releaseData]);

  const points = useMemo(() => {
    if (!releaseData || !equipment) return [];
    return operatorRepository.getWorkspacePointsForEquipment(
      equipment.id,
      equipment.displayLabel || equipment.name,
      equipment.status,
      { activeRelease: releaseData }
    );
  }, [releaseData, equipment]);

  const displayPoints = useMemo(() => {
    if (
      !USE_HIERARCHY_API ||
      !isBackendSiteId(siteId) ||
      !hierarchyLiveBundle ||
      !equipment?.id ||
      !Array.isArray(hierarchyLiveBundle.points)
    ) {
      return points;
    }
    const m = new Map([[String(equipment.id), hierarchyLiveBundle]]);
    return applyHierarchyLiveToWorkspaceRows(points, releaseData, m, nowTick);
  }, [points, releaseData, hierarchyLiveBundle, equipment?.id, siteId, nowTick]);

  const pointsForGraphic = useMemo(() => {
    return displayPoints.map((p) => {
      const v = equipmentPointDisplayValue(p, pointUiState);
      return { ...p, value: v };
    });
  }, [displayPoints, pointUiState]);

  const pollMs = runtimeForEquipment?.pollRateMs ?? persistedDbController?.pollRateMs;
  const lastSeen = runtimeForEquipment?.lastSeenAt ?? persistedDbController?.lastSeenAt;
  const commHeadline =
    USE_HIERARCHY_API
      ? resolveEquipmentCommStatus({
          runtimeController: runtimeForEquipment,
          persistedController: persistedDbController,
          now: nowTick,
        })
      : null;

  const patchPointUi = useCallback((rowId, patch) => {
    setPointUiState((s) => ({
      ...s,
      [rowId]: { ...s[rowId], ...patch },
    }));
  }, []);

  return {
    points,
    displayPoints,
    pointsForGraphic,
    pointUiState,
    patchPointUi,
    setPointUiState,
    runtimeForEquipment,
    persistedDbController,
    nowTick,
    commHeadline,
    lastSeen,
    pollMs,
  };
}
