import { ZONE_RUNTIME_STATES } from "../../modules/engineering/graphics-manager/floorZoneModel";

/**
 * Map zone/runtime/comm into the four Operator floor-legend states.
 * @returns {"normal"|"fault"|"offline"|"unknown"}
 */
export function floorWidgetLegendStatus({ runtimeState, comms, zoneStatus } = {}) {
  const comm = String(comms || "").toLowerCase();
  const zs = String(zoneStatus || "").toLowerCase();
  const rt = String(runtimeState || "").toLowerCase();

  if (
    rt === ZONE_RUNTIME_STATES.OFFLINE ||
    comm === "offline" ||
    zs === "offline" ||
    zs === "no data"
  ) {
    return "offline";
  }
  if (rt === ZONE_RUNTIME_STATES.ALARM || rt === ZONE_RUNTIME_STATES.WARNING || comm === "stale" || zs === "stale") {
    return "fault";
  }
  if (
    rt === ZONE_RUNTIME_STATES.NORMAL ||
    rt === ZONE_RUNTIME_STATES.COOLING ||
    rt === ZONE_RUNTIME_STATES.HEATING ||
    comm === "online" ||
    zs === "live" ||
    zs === "online"
  ) {
    return "normal";
  }
  return "unknown";
}

export function floorWidgetStatusLabel(legendStatus, runtimeState) {
  const rt = String(runtimeState || "").toLowerCase();
  if (legendStatus === "offline") return "Offline";
  if (legendStatus === "fault") return rt === "warning" ? "Fault" : "Fault";
  if (rt === "cooling") return "Cooling";
  if (rt === "heating") return "Heating";
  if (legendStatus === "normal") return "On";
  return "Unknown";
}

export function equipmentWidgetAccent(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("vav")) return "vav";
  if (t.includes("ahu") || t.includes("air handle")) return "ahu";
  if (t.includes("pump")) return "pump";
  if (t.includes("fcu") || t.includes("fan coil")) return "fcu";
  return "eq";
}
