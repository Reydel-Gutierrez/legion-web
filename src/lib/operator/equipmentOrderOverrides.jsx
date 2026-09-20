/**
 * Client-side equipment display order for the Operator sidebar tree.
 * The active release's sortOrder is fixed at deploy time, so this lets an operator
 * locally reorder equipment within a floor without touching the deployed hierarchy.
 */

const STORAGE_KEY = (siteId) => `legion.operator.equipmentOrder.v1.${siteId || "default"}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
}

/** @returns {{ [floorId: string]: string[] }} */
export function loadEquipmentOrderOverrides(siteId) {
  const overrides = readJson(STORAGE_KEY(siteId), {});
  return overrides && typeof overrides === "object" ? overrides : {};
}

export function saveEquipmentOrderOverrides(siteId, overrides) {
  return writeJson(STORAGE_KEY(siteId), overrides || {});
}

/**
 * Reorders each floor's equipment children per the stored id order. Ids not present
 * in the override (e.g. newly deployed equipment) keep their natural position, appended at the end.
 * @param {object | null} tree
 * @param {{ [floorId: string]: string[] }} overrides
 */
export function applyEquipmentOrderOverrides(tree, overrides) {
  if (!tree || !overrides || Object.keys(overrides).length === 0) return tree;

  function walk(node) {
    if (!node || !Array.isArray(node.children) || node.children.length === 0) return node;
    if (node.kind === "floor") {
      const order = overrides[node.id];
      if (!order || !order.length) return node;
      const byId = new Map(node.children.map((c) => [String(c.id), c]));
      const ordered = [];
      order.forEach((id) => {
        const c = byId.get(String(id));
        if (c) {
          ordered.push(c);
          byId.delete(String(id));
        }
      });
      byId.forEach((c) => ordered.push(c));
      return { ...node, children: ordered };
    }
    return { ...node, children: node.children.map(walk) };
  }

  return walk(tree);
}

/**
 * Equipment can only move within its own floor; it can never leave. Returns null when the
 * move would go past the first/last position (no-op).
 * @param {object[]} currentFloorChildren - equipment nodes in current display order
 * @param {string} equipmentId
 * @param {-1 | 1} direction
 * @returns {string[] | null} new ordered ids, or null if the move is not possible
 */
export function moveEquipmentIdWithinFloor(currentFloorChildren, equipmentId, direction) {
  const ids = (currentFloorChildren || []).map((c) => String(c.id));
  const idx = ids.indexOf(String(equipmentId));
  if (idx < 0) return null;
  const to = idx + direction;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  const [removed] = next.splice(idx, 1);
  next.splice(to, 0, removed);
  return next;
}
