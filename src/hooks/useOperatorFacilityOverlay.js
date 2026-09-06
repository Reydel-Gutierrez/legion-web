import { useEffect, useMemo, useState } from "react";
import { operatorRepository } from "../lib/data";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { isBackendSiteId } from "../lib/data/siteIdUtils";
import * as runtimeApi from "../lib/data/adapters/api/runtimeApiAdapter";
import { annotateFacilityTreeAlarms } from "../lib/operator/pointAlarms";

/**
 * Site-level active alarms + runtime freshness for the facility tree overlay.
 */
export function useOperatorFacilityOverlay(siteId, tree) {
  const [alarms, setAlarms] = useState([]);
  const [runtimeControllers, setRuntimeControllers] = useState([]);

  useEffect(() => {
    if (!siteId || !isBackendSiteId(siteId)) {
      setAlarms([]);
      setRuntimeControllers([]);
      return undefined;
    }
    let cancelled = false;

    async function refresh() {
      try {
        const [alarmRows, controllers] = await Promise.all([
          operatorRepository.fetchAlarmsForSite(siteId).catch(() => []),
          USE_HIERARCHY_API ? runtimeApi.listRuntimeControllers().catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setAlarms(Array.isArray(alarmRows) ? alarmRows : []);
        setRuntimeControllers(Array.isArray(controllers) ? controllers : []);
      } catch {
        if (!cancelled) {
          setAlarms([]);
          setRuntimeControllers([]);
        }
      }
    }

    refresh();
    const t = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [siteId]);

  const annotatedTree = useMemo(
    () => annotateFacilityTreeAlarms(tree, alarms, runtimeControllers),
    [tree, alarms, runtimeControllers]
  );

  return { alarms, annotatedTree };
}
