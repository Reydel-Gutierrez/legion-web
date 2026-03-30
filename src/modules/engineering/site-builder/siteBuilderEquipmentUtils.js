/**
 * Site Builder: ordering equipment per floor (sortOrder + display helpers).
 */

/**
 * @param {object[]} equipmentOnFloor - equipment sharing the same floorId
 * @returns {object[]} sorted copy
 */
export function sortEquipmentForDisplay(equipmentOnFloor) {
  return [...equipmentOnFloor].sort((a, b) => {
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    const aNum = typeof ao === "number" && !Number.isNaN(ao) ? ao : null;
    const bNum = typeof bo === "number" && !Number.isNaN(bo) ? bo : null;
    if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
    if (aNum != null && bNum == null) return -1;
    if (aNum == null && bNum != null) return 1;
    return String(a.displayLabel || a.name || "").localeCompare(
      String(b.displayLabel || b.name || ""),
      undefined,
      { sensitivity: "base", numeric: true }
    );
  });
}

/**
 * @param {object[]} equipmentList
 * @param {string} floorId
 * @param {string[]} orderedIds - equipment ids on this floor in display order
 */
export function reorderEquipmentIds(equipmentList, floorId, orderedIds) {
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  return equipmentList.map((e) => {
    if (e.floorId !== floorId) return e;
    const o = orderMap.get(e.id);
    if (o === undefined) return e;
    return { ...e, sortOrder: o };
  });
}

/**
 * @param {object[]} equipmentList
 * @param {string} floorId
 * @param {string} draggedId
 * @param {string} targetId - insert before this row; if not found, append
 */
export function reorderAfterDrag(equipmentList, floorId, draggedId, targetId) {
  const sorted = sortEquipmentForDisplay(equipmentList.filter((e) => e.floorId === floorId));
  const ids = sorted.map((e) => e.id);
  const fromIndex = ids.indexOf(draggedId);
  if (fromIndex < 0) return equipmentList;
  const nextIds = [...ids];
  nextIds.splice(fromIndex, 1);
  let insertTo = targetId == null ? nextIds.length : nextIds.indexOf(targetId);
  if (insertTo < 0) insertTo = nextIds.length;
  nextIds.splice(insertTo, 0, draggedId);
  return reorderEquipmentIds(equipmentList, floorId, nextIds);
}

/**
 * @param {object[]} equipmentList
 * @param {string} floorId
 * @param {string} equipmentId
 * @param {number} direction -1 | 1
 */
export function moveEquipmentRelative(equipmentList, floorId, equipmentId, direction) {
  const sorted = sortEquipmentForDisplay(equipmentList.filter((e) => e.floorId === floorId));
  const ids = sorted.map((e) => e.id);
  const idx = ids.indexOf(equipmentId);
  if (idx < 0) return equipmentList;
  const to = idx + direction;
  if (to < 0 || to >= ids.length) return equipmentList;
  const nextIds = [...ids];
  const [removed] = nextIds.splice(idx, 1);
  nextIds.splice(to, 0, removed);
  return reorderEquipmentIds(equipmentList, floorId, nextIds);
}

/**
 * @param {'name'|'address'|'instanceNumber'} field
 * @param {'asc'|'desc'} direction
 */
export function sortEquipmentOnFloorByField(equipmentList, floorId, field, direction) {
  const onFloor = equipmentList.filter((e) => e.floorId === floorId);
  const sorted = [...onFloor].sort((a, b) => {
    let va;
    let vb;
    if (field === "name") {
      va = String(a.displayLabel || a.name || "");
      vb = String(b.displayLabel || b.name || "");
    } else if (field === "address") {
      va = String(a.address ?? "");
      vb = String(b.address ?? "");
    } else if (field === "instanceNumber") {
      va = String(a.instanceNumber ?? "");
      vb = String(b.instanceNumber ?? "");
    } else {
      return 0;
    }
    const cmp = va.localeCompare(vb, undefined, { sensitivity: "base", numeric: true });
    return direction === "asc" ? cmp : -cmp;
  });
  const orderedIds = sorted.map((e) => e.id);
  return reorderEquipmentIds(equipmentList, floorId, orderedIds);
}

/**
 * @param {'asc'|'desc'} direction
 */
export function sortEquipmentOnFloorByName(equipmentList, floorId, direction) {
  return sortEquipmentOnFloorByField(equipmentList, floorId, "name", direction);
}

/**
 * Insert a duplicate immediately after the source row and renumber sortOrder for the floor.
 * @param {object[]} equipmentList
 * @param {string} sourceId
 * @param {string} newId
 * @param {object} newEquipment - full equipment object for the new row (id must be newId)
 */
export function insertDuplicateAfterSource(equipmentList, sourceId, newId, newEquipment) {
  const source = equipmentList.find((e) => e.id === sourceId);
  if (!source) return equipmentList;
  const floorId = source.floorId;
  const others = equipmentList.filter((e) => e.floorId !== floorId);
  const floorItems = sortEquipmentForDisplay(equipmentList.filter((e) => e.floorId === floorId));
  const idx = floorItems.findIndex((e) => e.id === sourceId);
  const newFloorItems =
    idx >= 0
      ? [...floorItems.slice(0, idx + 1), newEquipment, ...floorItems.slice(idx + 1)]
      : [...floorItems, newEquipment];
  const withOrder = newFloorItems.map((e, i) => ({ ...e, sortOrder: i }));
  return [...others, ...withOrder];
}
