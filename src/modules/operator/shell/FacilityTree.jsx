import React from "react";
import FacilityTreeNode from "./FacilityTreeNode";

export default function FacilityTree({
  root,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  reorderMode = false,
  onMoveEquipment,
}) {
  if (!root) {
    return null;
  }

  return (
    <ul className="facility-tree" role="tree">
      <FacilityTreeNode
        node={root}
        depth={0}
        isLast
        isFirst
        selectedId={selectedId}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        reorderMode={reorderMode}
        onMoveEquipment={onMoveEquipment}
      />
    </ul>
  );
}
