/**
 * Build a facility tree from an active-release payload for Operator navigation.
 * Equipment stays a flat array on the release; this nests it under floors.
 */

function sortByOrderThenLabel(a, b) {
  const ao = a.sortOrder != null ? Number(a.sortOrder) : 0;
  const bo = b.sortOrder != null ? Number(b.sortOrder) : 0;
  if (ao !== bo) return ao - bo;
  return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });
}

function equipmentNode(eq) {
  return {
    id: String(eq.id),
    kind: "equipment",
    label: eq.displayLabel || eq.name || String(eq.id),
    sortOrder: eq.sortOrder,
    type: eq.type || eq.equipmentType || "",
    status: eq.status || "",
    commStatus: eq.commStatus || eq.equipmentCommStatus || null,
    floorId: eq.floorId || "",
    buildingId: eq.buildingId || "",
    children: [],
  };
}

/**
 * @param {object | null | undefined} releaseData
 * @returns {object | null} root site node
 */
export function buildFacilityTree(releaseData) {
  const site = releaseData?.site;
  if (!site) return null;

  const equipment = Array.isArray(releaseData.equipment) ? releaseData.equipment : [];
  const byFloor = {};
  const unplaced = [];
  equipment.forEach((eq) => {
    const node = equipmentNode(eq);
    node.siteId = String(site.id || "");
    if (eq.floorId) {
      const key = String(eq.floorId);
      if (!byFloor[key]) byFloor[key] = [];
      byFloor[key].push(node);
    } else {
      unplaced.push(node);
    }
  });
  Object.keys(byFloor).forEach((k) => byFloor[k].sort(sortByOrderThenLabel));
  unplaced.sort(sortByOrderThenLabel);

  const buildings = (site.buildings || []).map((b) => {
    const floors = (b.floors || []).map((f) => {
      const kids = byFloor[String(f.id)] || [];
      return {
        id: String(f.id),
        kind: "floor",
        label: f.displayLabel || f.name || String(f.id),
        sortOrder: f.sortOrder,
        buildingId: String(b.id),
        siteId: String(site.id || ""),
        children: kids,
      };
    });
    floors.sort(sortByOrderThenLabel);
    return {
      id: String(b.id),
      kind: "building",
      label: b.name || b.buildingCode || "Building",
      sortOrder: b.sortOrder,
      siteId: String(site.id || ""),
      children: floors,
    };
  });
  buildings.sort(sortByOrderThenLabel);

  const siteChildren = buildings.slice();
  if (unplaced.length) {
    siteChildren.push(...unplaced);
  }

  return {
    id: String(site.id || "site"),
    kind: "site",
    label: "Site",
    name: site.name || "Site",
    siteId: String(site.id || ""),
    children: siteChildren,
  };
}

/**
 * @param {object | null} node
 * @param {(n: object) => void} visit
 */
export function walkFacilityTree(node, visit) {
  if (!node) return;
  visit(node);
  (node.children || []).forEach((child) => walkFacilityTree(child, visit));
}

/**
 * @param {object | null} root
 * @param {string} id
 * @returns {object | null}
 */
export function findFacilityNode(root, id) {
  if (!root || id == null || id === "") return null;
  const key = String(id);
  let found = null;
  walkFacilityTree(root, (n) => {
    if (!found && String(n.id) === key) found = n;
  });
  return found;
}

/**
 * Ancestor ids from root down to (but not including) the target.
 * @param {object | null} root
 * @param {string} id
 * @returns {string[]}
 */
export function getFacilityAncestorIds(root, id) {
  if (!root || id == null) return [];
  const key = String(id);
  const path = [];

  function dfs(node, trail) {
    if (!node) return false;
    if (String(node.id) === key) {
      path.push(...trail);
      return true;
    }
    const next = trail.concat(String(node.id));
    return (node.children || []).some((child) => dfs(child, next));
  }

  dfs(root, []);
  return path;
}

function hasLayoutGraphic(graphics, id) {
  const g = graphics[id];
  return Boolean(g && (g.objects?.length > 0 || g.backgroundImage?.dataUrl));
}

/**
 * Default Operator landing node: first floor with a deployed layout graphic, else first building graphic, else site.
 * @param {object | null} root
 * @param {object | null} releaseData
 */
export function pickDefaultFacilityNode(root, releaseData) {
  if (!root) return null;
  const graphics = releaseData?.siteLayoutGraphics || {};
  let firstFloorWithGraphic = null;
  let firstBuildingWithGraphic = null;
  let firstFloor = null;
  let firstBuilding = null;
  walkFacilityTree(root, (n) => {
    if (n.kind === "building") {
      if (!firstBuilding) firstBuilding = n;
      if (!firstBuildingWithGraphic && hasLayoutGraphic(graphics, n.id)) firstBuildingWithGraphic = n;
      return;
    }
    if (n.kind !== "floor") return;
    if (!firstFloor) firstFloor = n;
    if (!firstFloorWithGraphic && hasLayoutGraphic(graphics, n.id)) firstFloorWithGraphic = n;
  });
  return firstFloorWithGraphic || firstBuildingWithGraphic || firstFloor || firstBuilding || root;
}

export function countFacilityEquipment(node) {
  if (!node) return 0;
  let n = 0;
  walkFacilityTree(node, (x) => {
    if (x.kind === "equipment") n += 1;
  });
  return n;
}

export function countFacilityFloors(node) {
  if (!node) return 0;
  let n = 0;
  walkFacilityTree(node, (x) => {
    if (x.kind === "floor") n += 1;
  });
  return n;
}

export function countFacilityBuildings(node) {
  if (!node) return 0;
  let n = 0;
  walkFacilityTree(node, (x) => {
    if (x.kind === "building") n += 1;
  });
  return n;
}

/**
 * Breadcrumb segments from site to the selected node.
 * @param {object | null} root
 * @param {string} id
 * @returns {{ id: string, label: string, kind: string }[]}
 */
export function getFacilityBreadcrumb(root, id) {
  if (!root) return [];
  const key = String(id);
  let result = [];

  function dfs(node, trail) {
    if (!node) return false;
    const next = trail.concat({ id: String(node.id), label: node.label, kind: node.kind });
    if (String(node.id) === key) {
      result = next;
      return true;
    }
    return (node.children || []).some((child) => dfs(child, next));
  }

  dfs(root, []);
  return result;
}
