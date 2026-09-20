import React, { useMemo } from "react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { splitOperatorEquipmentDetails } from "../../../lib/operator/equipmentDetails";

export default function EquipmentNetworkCard({
  releaseData,
  equipment,
  graphic,
  extras,
  expandedId,
  onToggleExpand,
}) {
  const { technical } = useMemo(
    () => splitOperatorEquipmentDetails(releaseData, equipment, graphic, extras),
    [releaseData, equipment, graphic, extras]
  );

  return (
    <ExpandableWorkspaceCard
      title="Network Details"
      cardId="network"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
    >
      <dl className="details-grid">
        {technical.map((row) => (
          <div key={row.key} className="details-grid__row">
            <dt>{row.key}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </ExpandableWorkspaceCard>
  );
}
