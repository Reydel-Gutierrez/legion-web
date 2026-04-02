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
 * PATCH /api/equipment/:id body aligned with Site Builder single-item save.
 * Sending the full field set avoids empty PATCH bodies; use `overrides` only for fields to change.
 * @param {object} eq - working-version equipment row
 * @param {object} [overrides] - override `instanceNumber` and/or `address` (pass `null` to clear)
 */
export function toApiEquipmentUpdatePayload(eq, overrides = {}) {
  const tmpl =
    eq.templateName != null && String(eq.templateName).trim()
      ? String(eq.templateName).trim()
      : null;

  let addr;
  if (Object.prototype.hasOwnProperty.call(overrides, "address")) {
    addr =
      overrides.address != null && String(overrides.address).trim()
        ? String(overrides.address).trim()
        : null;
  } else {
    addr =
      eq.address != null && String(eq.address).trim() ? String(eq.address).trim() : null;
  }

  let instanceNum;
  if (Object.prototype.hasOwnProperty.call(overrides, "instanceNumber")) {
    instanceNum =
      overrides.instanceNumber != null && String(overrides.instanceNumber).trim()
        ? String(overrides.instanceNumber).trim()
        : null;
  } else {
    instanceNum =
      eq.instanceNumber != null && String(eq.instanceNumber).trim()
        ? String(eq.instanceNumber).trim()
        : null;
  }

  return {
    name: eq.name,
    code: (eq.displayLabel && String(eq.displayLabel).trim()) || eq.name,
    equipmentType: eq.type || eq.equipmentType || "CUSTOM",
    templateName: tmpl,
    address: addr,
    instanceNumber: instanceNum,
  };
}

/**
 * Site-wide order: each building’s floors in tree order, then equipment on that floor in display order.
 * Appends any equipment whose floor is not under the site tree at the end.
 * @param {object} siteTree
 * @param {object[]} equipmentList
 * @returns {object[]}
 */
export function getEquipmentOrderedForSiteWide(siteTree, equipmentList) {
  if (!equipmentList?.length) return [];
  if (!siteTree?.children?.length) return [...equipmentList];
  const byFloor = new Map();
  for (const e of equipmentList) {
    if (!byFloor.has(e.floorId)) byFloor.set(e.floorId, []);
    byFloor.get(e.floorId).push(e);
  }
  const ordered = [];
  for (const b of siteTree.children) {
    for (const f of b.children || []) {
      const chunk = byFloor.get(f.id);
      if (chunk?.length) ordered.push(...sortEquipmentForDisplay(chunk));
    }
  }
  const seen = new Set(ordered.map((e) => e.id));
  for (const e of equipmentList) {
    if (!seen.has(e.id)) ordered.push(e);
  }
  return ordered;
}

/**
 * Sequential labels from a starting pattern: trailing digits increment; optional fixed width (e.g. 001 → 002).
 * @param {string} startRaw
 * @returns {{ ok: true, format: (offset: number) => string } | { ok: false, message: string }}
 */
export function buildSequentialValueFormatter(startRaw) {
  const trimmed = String(startRaw ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a starting value." };
  }
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) {
    return {
      ok: false,
      message: "The value must end with digits (e.g. 350025 or FCU-001).",
    };
  }
  const prefix = match[1];
  const digits = match[2];
  const width = digits.length;
  const startNum = Number.parseInt(digits, 10);
  if (!Number.isFinite(startNum)) {
    return { ok: false, message: "Invalid number in the trailing digits." };
  }
  return {
    ok: true,
    format(offset) {
      const n = startNum + offset;
      const numStr = String(n);
      const padded = numStr.length <= width ? numStr.padStart(width, "0") : numStr;
      return `${prefix}${padded}`;
    },
  };
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
