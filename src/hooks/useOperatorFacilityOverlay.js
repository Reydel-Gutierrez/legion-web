import { useEffect, useMemo, useState } from "react";
import { operatorRepository } from "../lib/data";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { isBackendSiteId } from "../lib/data/siteIdUtils";
import * as runtimeApi from "../lib/data/adapters/api/runtimeApiAdapter";
import * as equipmentControllerApi from "../lib/data/adapters/api/equipmentControllerApiAdapter";
import { annotateFacilityTreeAlarms } from "../lib/operator/pointAlarms";

/**
 * Site-level active alarms + runtime freshness for the facility tree overlay.
 */
export function useOperatorFacilityOverlay(siteId, tree) {
  const [alarms, setAlarms] = useState([]);
  const [runtimeControllers, setRuntimeControllers] = useState([]);
  const [persistedControllers, setPersistedControllers] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now);

  useEffect(() => {
    setAlarms([]);
    setRuntimeControllers([]);
    setPersistedControllers([]);
    if (!siteId || !isBackendSiteId(siteId)) {
      return undefined;
    }
    let cancelled = false;

    async function refresh() {
      try {
        const [alarmRows, controllers, persisted] = await Promise.all([
          operatorRepository.fetchAlarmsForSite(siteId, { state: "active" }).catch(() => null),
          USE_HIERARCHY_API ? runtimeApi.listRuntimeControllers().catch(() => null) : Promise.resolve([]),
          USE_HIERARCHY_API ? equipmentControllerApi.listEquipmentControllers().catch(() => null) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        // A failed request must not falsely clear an active alarm.
        if (Array.isArray(alarmRows)) setAlarms(alarmRows);
        if (Array.isArray(controllers)) setRuntimeControllers(controllers);
        if (Array.isArray(persisted)) setPersistedControllers(persisted);
      } catch {
        // Preserve the last known alarm state while communication recovers.
      } finally {
        if (!cancelled) setNowTick(Date.now());
      }
    }

    refresh();
    const onAlarmChange = () => refresh();
    window.addEventListener("legion:operator-alarms-changed", onAlarmChange);
    const t = window.setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      window.removeEventListener("legion:operator-alarms-changed", onAlarmChange);
    };
  }, [siteId]);

  const annotatedTree = useMemo(
    () => annotateFacilityTreeAlarms(tree, alarms, runtimeControllers, nowTick, persistedControllers),
    [tree, alarms, runtimeControllers, persistedControllers, nowTick]
  );

  return { alarms, annotatedTree };
}
