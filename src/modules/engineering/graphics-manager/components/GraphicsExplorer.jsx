import React from "react";
import SiteTree from "../../site-builder/components/SiteTree";

/**
 * Graphics Explorer - browse-only site & equipment tree for Graphics Manager.
 * Site → Building → Floor → Equipment. Click site/building/floor to edit layout graphics; click equipment for equipment graphics.
 * No Add Building / Add Floor here — structure is managed in Site Builder. This page stays minimal for building graphics only.
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
        compactEquipment={true}
      />
    </div>
  );
}
