import React from "react";
import FacilityTreeNode from "./FacilityTreeNode";

export default function FacilityTree({ root, selectedId, expandedIds, onToggleExpand, onSelect }) {
  if (!root) {
    return <div className="facility-tree__empty">No deployed facility hierarchy.</div>;
  }

  return (
    <ul className="facility-tree" role="tree">
      <FacilityTreeNode
        node={root}
        depth={0}
        isLast
        selectedId={selectedId}
        expandedIds={expandedIds}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
      />
    </ul>
  );
}
