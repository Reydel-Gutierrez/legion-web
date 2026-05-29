import { useEffect, useMemo, useRef, useState } from "react";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { isBackendSiteId } from "../lib/data/siteIdUtils";
import { listRuntimeControllers } from "../lib/data/adapters/api/runtimeApiAdapter";
import { listPointsByEquipment } from "../lib/data/adapters/api/hierarchyApiAdapter";
import { getPointMappingsByEquipment } from "../lib/data/adapters/api/pointMappingApiAdapter";
import { getEquipmentControllerByEquipment } from "../lib/data/adapters/api/equipmentControllerApiAdapter";
import { resolveLivePointsSourceEquipmentId } from "../lib/operator/operatorWorkspaceLivePointsSource";
import {
  collectLayoutGraphicEquipmentIds,
  buildHydratedLayoutWorkspaceRows,
  workspaceRowsToGraphicPoints,
} from "../lib/operator/siteLayoutLivePoints";

const REFRESH_MS = 5000;

/**
 * Load live equipment/point values for Site Layout floor-plan widgets using the same
 * hierarchy + runtime sources as the Equipment page.
 *
 * @param {{ releaseData?: object|null, layoutGraphic?: object|null, siteId?: string|null }} args
 * @returns {{ points: object[], equipmentLiveBundles: Map<string, object>, nowTick: number }}
 */
export function useSiteLayoutLivePoints({ releaseData, layoutGraphic, siteId }) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [runtimeControllersList, setRuntimeControllersList] = useState([]);
  const [equipmentLiveBundles, setEquipmentLiveBundles] = useState(() => new Map());
  const loadLiveBundlesRef = useRef(async () => {});

  const equipmentIdsKey = useMemo(() => {
    const ids = collectLayoutGraphicEquipmentIds(layoutGraphic, releaseData);
    return ids.sort().join(",");
  }, [layoutGraphic, releaseData]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!USE_HIERARCHY_API) return undefined;
    let cancelled = false;

    function tick() {
      listRuntimeControllers()
        .then((rows) => {
          if (cancelled) return;
          setRuntimeControllersList(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (!cancelled) setRuntimeControllersList([]);
        });
    }

    tick();
    const id = window.setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!USE_HIERARCHY_API || !isBackendSiteId(siteId) || !releaseData || !equipmentIdsKey) {
      setEquipmentLiveBundles(new Map());
      loadLiveBundlesRef.current = async () => {};
      return undefined;
    }

    const eqIds = equipmentIdsKey.split(",").filter(Boolean);
    let cancelled = false;

    async function load() {
      const next = new Map();
      const rtList = Array.isArray(runtimeControllersList) ? runtimeControllersList : [];
      await Promise.all(
        eqIds.map(async (eqId) => {
          try {
            const sourceEqId = resolveLivePointsSourceEquipmentId(eqId, releaseData, rtList);
            const [dbPoints, mappings, ctrl] = await Promise.all([
              listPointsByEquipment(sourceEqId),
              getPointMappingsByEquipment(sourceEqId).catch(() => []),
              getEquipmentControllerByEquipment(eqId).catch(() => null),
            ]);
            const rt =
              rtList.find((c) => c && String(c.equipmentId) === String(eqId)) ||
              rtList.find((c) => c && String(c.equipmentId) === String(sourceEqId)) ||
              null;
            if (!cancelled) {
              next.set(eqId, {
                points: Array.isArray(dbPoints) ? dbPoints : [],
                mappings: Array.isArray(mappings) ? mappings : [],
                controller: ctrl,
                runtime: rt,
              });
            }
          } catch {
            /* keep previous bundle for this id */
          }
        })
      );
      if (!cancelled) setEquipmentLiveBundles(next);
    }

    loadLiveBundlesRef.current = load;
    load();
    const t = window.setInterval(() => {
      loadLiveBundlesRef.current();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      loadLiveBundlesRef.current = async () => {};
    };
  }, [siteId, releaseData, equipmentIdsKey, runtimeControllersList]);

  const hydratedWorkspaceRows = useMemo(() => {
    const equipmentIds = equipmentIdsKey ? equipmentIdsKey.split(",").filter(Boolean) : [];
    return buildHydratedLayoutWorkspaceRows(
      releaseData,
      equipmentIds,
      equipmentLiveBundles,
      nowTick
    );
  }, [releaseData, equipmentIdsKey, equipmentLiveBundles, nowTick]);

  const points = useMemo(
    () => workspaceRowsToGraphicPoints(hydratedWorkspaceRows),
    [hydratedWorkspaceRows]
  );

  return { points, hydratedWorkspaceRows, equipmentLiveBundles, nowTick };
}
