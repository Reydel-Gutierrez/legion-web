import React from "react";
import SiteTreeNode from "./SiteTreeNode";

/**
 * Site hierarchy tree: Site → Building → Floor
 */
export default function SiteTree({
  site,
  expandedIds,
  selectedId,
  selectedEquipmentId,
  onToggleExpand,
  onSelect,
  onSelectEquipment,
  onAddChild,
  onAddEquipment,
  onEdit,
  onDelete,
  compactEquipment = false,
  onReorderEquipment,
  onSortFloorEquipment,
  onDuplicateEquipment,
}) {
  if (!site) return null;

  return (
    <div className="legion-equipment-tree site-builder-tree">
      <SiteTreeNode
        node={site}
        level={0}
        expandedIds={expandedIds}
        selectedId={selectedId}
        selectedEquipmentId={selectedEquipmentId}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        onSelectEquipment={onSelectEquipment}
        onAddChild={onAddChild}
        onAddEquipment={onAddEquipment}
        onEdit={onEdit}
        onDelete={onDelete}
        compactEquipment={compactEquipment}
        onReorderEquipment={onReorderEquipment}
        onSortFloorEquipment={onSortFloorEquipment}
        onDuplicateEquipment={onDuplicateEquipment}
      />
    </div>
  );
}
