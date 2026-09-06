import { Routes } from "../../routes";

export const SECONDARY_OPERATOR_PATHS = {
  [Routes.LegionAlarms.path]: "alarms",
  [Routes.LegionTrends.path]: "trends",
  [Routes.LegionSchedules.path]: "schedules",
  [Routes.LegionEvents.path]: "events",
  [Routes.LegionSettings.path]: "settings",
  [Routes.LegionUsers.path]: "users",
  [Routes.LegionDashboard.path]: "insights",
  [Routes.LegionEquipment.path]: "workspace",
};

export function isOperatorHierarchyPath(pathname) {
  if (!pathname) return false;
  if (pathname === Routes.LegionSite.path) return true;
  if (pathname.startsWith("/legion/equipment/") && pathname !== Routes.LegionEquipment.path) return true;
  return false;
}

export function isSecondaryOperatorPath(pathname) {
  if (!pathname) return false;
  return Boolean(SECONDARY_OPERATOR_PATHS[pathname]);
}

/**
 * @param {string} pathname
 * @param {string} [search]
 * @returns {{ kind: "site"|"building"|"floor"|"equipment"|null, id: string|null }}
 */
export function parseOperatorSelection(pathname, search) {
  if (!pathname) return { kind: null, id: null };

  const equipPrefix = "/legion/equipment/";
  if (pathname.startsWith(equipPrefix) && pathname !== Routes.LegionEquipment.path) {
    const raw = pathname.slice(equipPrefix.length);
    const id = decodeURIComponent(raw.split("/")[0] || "");
    return id ? { kind: "equipment", id } : { kind: null, id: null };
  }

  if (pathname === Routes.LegionSite.path) {
    const params = new URLSearchParams(search || "");
    const node = params.get("node");
    if (node) return { kind: null, id: node };
    return { kind: "site", id: null };
  }

  return { kind: null, id: null };
}

/**
 * @param {{ kind: string, id: string }} node
 * @returns {{ pathname: string, search?: string }}
 */
export function locationForFacilityNode(node) {
  if (!node?.id) {
    return { pathname: Routes.LegionSite.path };
  }
  if (node.kind === "equipment") {
    return {
      pathname: Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(node.id)),
    };
  }
  const params = new URLSearchParams();
  params.set("node", node.id);
  return { pathname: Routes.LegionSite.path, search: `?${params.toString()}` };
}
