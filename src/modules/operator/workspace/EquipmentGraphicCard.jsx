import React from "react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import DeployedGraphicPreview from "../equipment/DeployedGraphicPreview";

export default function EquipmentGraphicCard({
  graphic,
  points,
  onLinkClick,
  expandedId,
  onToggleExpand,
}) {
  const hasGraphic = graphic && (graphic.objects?.length > 0 || graphic.backgroundImage?.dataUrl);

  return (
    <ExpandableWorkspaceCard
      title="Equipment Graphic"
      cardId="graphic"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      className="equipment-graphic-panel"
      clipOverflow
    >
      <div className="equipment-graphic-card">
        {hasGraphic ? (
          <DeployedGraphicPreview
            graphic={graphic}
            points={points}
            onLinkClick={onLinkClick}
            fit="contain"
            zoomFactor={1}
          />
        ) : (
          <div className="operator-empty-graphic">No deployed graphic for this equipment.</div>
        )}
      </div>
    </ExpandableWorkspaceCard>
  );
}
