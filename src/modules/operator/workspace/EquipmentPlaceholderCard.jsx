import React from "react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";

export default function EquipmentPlaceholderCard({ title, message, onToggleExpand }) {
  return (
    <ExpandableWorkspaceCard
      title={title}
      cardId={title}
      expandedId={title}
      onToggleExpand={onToggleExpand}
    >
      <div className="operator-empty-graphic">{message}</div>
    </ExpandableWorkspaceCard>
  );
}
