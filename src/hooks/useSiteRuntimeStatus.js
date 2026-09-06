import { useEffect, useState } from "react";
import { USE_HIERARCHY_API } from "../lib/data/config";
import * as runtimeApi from "../lib/data/adapters/api/runtimeApiAdapter";
import { getEquipmentStatus } from "../lib/operator/statusUtils";
import { formatLastSyncTime } from "../lib/operator/equipmentDetails";

/**
 * Site-level online / last-sync from runtime controllers (same freshness rules as equipment).
 */
export function useSiteRuntimeStatus() {
  const [controllers, setControllers] = useState([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!USE_HIERARCHY_API) {
      setControllers([]);
      return undefined;
    }
    let cancelled = false;

    async function refresh() {
      try {
        const list = await runtimeApi.listRuntimeControllers().catch(() => []);
        if (!cancelled) setControllers(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setControllers([]);
      }
    }

    refresh();
    const t = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (!USE_HIERARCHY_API || controllers.length === 0) {
    return {
      siteStatus: "UNKNOWN",
      siteStatusLabel: "Site Unknown",
      lastSyncLabel: null,
      lastSeenAt: null,
    };
  }

  const statuses = controllers.map((c) => {
    if (c?.online === false) return "OFFLINE";
    return getEquipmentStatus({
      lastSeenAt: c.lastSeenAt,
      pollRateMs: c.pollRateMs,
      now: nowTick,
    });
  });

  let siteStatus = "LIVE";
  if (statuses.every((s) => s === "OFFLINE")) siteStatus = "OFFLINE";
  else if (statuses.some((s) => s === "OFFLINE" || s === "STALE")) siteStatus = "STALE";

  const lastSeenAt = controllers
    .map((c) => c.lastSeenAt)
    .filter(Boolean)
    .map((v) => new Date(v).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];

  const label =
    siteStatus === "LIVE" ? "Site Online" : siteStatus === "STALE" ? "Site Stale" : "Site Offline";

  return {
    siteStatus,
    siteStatusLabel: label,
    lastSyncLabel: lastSeenAt ? formatLastSyncTime(lastSeenAt) : null,
    lastSeenAt: lastSeenAt || null,
  };
}
