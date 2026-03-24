/**
 * Shared site tree helpers for Site Builder and Graphics Manager.
 * Used to add/update/delete Site/Building/Floor nodes and convert tree <-> working site shape.
 */

export function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function findNodeById(tree, id) {
  if (!tree || !id) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNodeInTree(tree, id, updates) {
  if (!tree) return tree;
  if (tree.id === id) return { ...tree, ...updates };
  return {
    ...tree,
    children: (tree.children || []).map((c) => updateNodeInTree(c, id, updates)),
  };
}

export function deleteNodeFromTree(tree, id) {
  if (!tree) return tree;
  if (tree.id === id) return null;
  const newChildren = (tree.children || [])
    .map((c) => deleteNodeFromTree(c, id))
    .filter(Boolean);
  return { ...tree, children: newChildren };
}

/** Collect all floor IDs under a node (for delete: remove equipment on those floors) */
export function collectFloorIdsUnder(node) {
  if (!node) return [];
  if (node.type === "floor") return [node.id];
  const ids = [];
  (node.children || []).forEach((c) => ids.push(...collectFloorIdsUnder(c)));
  return ids;
}
