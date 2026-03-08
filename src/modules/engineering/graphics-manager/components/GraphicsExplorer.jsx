import React from "react";
import SiteTree from "../../site-builder/components/SiteTree";

/**
 * Graphics Explorer - reuses Site Builder's site equipment tree.
 * Site → Building → Floor → Equipment. Click equipment to load its graphics in the canvas.
 * No Add/Edit/Delete actions - browse-only for graphics context.
 */
export default function GraphicsExplorer({
  siteTree,
  expandedIds,
  selectedId,
  selectedEquipmentId,
  onToggleExpand,
  onSelect,
  onSelectEquipment,
}) {
  if (!siteTree) return null;

  return (
    <div className="legion-equipment-tree site-builder-tree graphics-explorer-tree">
      <SiteTree
        site={siteTree}
        expandedIds={expandedIds}
        selectedId={selectedId}
        selectedEquipmentId={selectedEquipmentId}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        onSelectEquipment={onSelectEquipment}
        onAddChild={undefined}
        onAddEquipment={undefined}
        onEdit={undefined}
        onDelete={undefined}
      />
    </div>
  );
}
