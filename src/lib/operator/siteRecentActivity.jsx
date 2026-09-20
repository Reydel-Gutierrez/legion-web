import { LOG_CATEGORY } from "../app-activity/types";
import { formatLastSyncTime } from "./equipmentDetails";
import { findFacilityNode, walkFacilityTree } from "./facilityTree";

function toSortAt(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatTime(sortAt) {
  return formatLastSyncTime(sortAt) || "—";
}

function findNodeByLabel(tree, label) {
  if (!tree || !label) return null;
  const want = String(label).trim().toLowerCase();
  if (!want) return null;
  let found = null;
  walkFacilityTree(tree, (n) => {
    if (found) return;
    if (String(n.label || "").trim().toLowerCase() === want) found = n;
  });
  return found;
}

/**
 * Build Recent Activity rows from existing events, alarms, and app logs. No synthetic messages.
 * @param {{ events?: object[], alarms?: object[], logs?: object[], tree?: object|null }} input
 */
export function collectSiteRecentActivity({ events = [], alarms = [], logs = [], tree = null } = {}) {
  const rows = [];

  (events || []).forEach((e) => {
    const message = e.message || e.point || "";
    if (!message) return;
    const objectLabel = e.equipName || e.object || e.actor || "System";
    const sortAt = toSortAt(e.occurredAt || e.timestamp);
    rows.push({
      id: `event-${e.id || `${objectLabel}-${sortAt}`}`,
      sortAt,
      time: formatTime(sortAt),
      object: objectLabel,
      message: String(message),
      node: e.equipmentId ? findFacilityNode(tree, e.equipmentId) : findNodeByLabel(tree, objectLabel),
    });
  });

  (alarms || []).forEach((a) => {
    const message = a.message || a.point || "";
    if (!message) return;
    const objectLabel = a.equipmentName || "Equipment";
    const sortAt = toSortAt(a.occurredAt);
    rows.push({
      id: `alarm-${a.id || `${objectLabel}-${sortAt}`}`,
      sortAt,
      time: formatTime(sortAt),
      object: objectLabel,
      message: String(message),
      node: findNodeByLabel(tree, objectLabel),
    });
  });

  (logs || []).forEach((entry) => {
    if (!entry || entry.category === LOG_CATEGORY.API) return;
    const message = entry.message;
    if (!message) return;
    const objectLabel = entry.meta?.area || "System";
    const sortAt = toSortAt(entry.timestamp);
    rows.push({
      id: `log-${entry.id || `${objectLabel}-${sortAt}`}`,
      sortAt,
      time: formatTime(sortAt),
      object: objectLabel,
      message: String(message),
      node: findNodeByLabel(tree, objectLabel),
    });
  });

  rows.sort((a, b) => b.sortAt - a.sortAt);
  return rows.slice(0, 12);
}
