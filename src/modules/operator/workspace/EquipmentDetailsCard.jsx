import React, { useMemo } from "react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import StatusIndicator from "../../../components/legion/StatusIndicator";
import { splitOperatorEquipmentDetails } from "../../../lib/operator/equipmentDetails";

function commStatusTone(value) {
  const s = String(value || "").toUpperCase();
  if (s === "LIVE" || s === "ONLINE" || s === "NORMAL") return "LIVE";
  if (s === "STALE") return "STALE";
  if (s === "OFFLINE" || s === "FAULT") return "OFFLINE";
  return "UNKNOWN";
}

function commStatusLabel(value) {
  const s = String(value || "").toUpperCase();
  if (s === "LIVE" || s === "ONLINE") return "Online";
  if (s === "STALE") return "Stale";
  if (s === "OFFLINE") return "Offline";
  return value || "—";
}

export default function EquipmentDetailsCard({
  releaseData,
  equipment,
  graphic,
  extras,
  expandedId,
  onToggleExpand,
}) {
  const expanded = expandedId === "details";
  const { primary, technical } = useMemo(
    () => splitOperatorEquipmentDetails(releaseData, equipment, graphic, extras),
    [releaseData, equipment, graphic, extras]
  );

  const rows = expanded ? [...primary, ...technical] : primary;

  return (
    <ExpandableWorkspaceCard
      title="Equipment Details"
      cardId="details"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      clipOverflow={!expanded}
      footer={
        expanded ? null : (
          <button type="button" className="operator-text-link" onClick={() => onToggleExpand("details")}>
            View All Details →
          </button>
        )
      }
    >
      <dl className="details-grid">
        {rows.map((row) => (
          <div key={row.key} className="details-grid__row">
            <dt>{row.key}</dt>
            <dd>
              {row.key === "Communication Status" ? (
                <StatusIndicator status={commStatusTone(row.value)} label={commStatusLabel(row.value)} />
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </ExpandableWorkspaceCard>
  );
}
