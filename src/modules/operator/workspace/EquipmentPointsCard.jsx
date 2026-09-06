import React, { useMemo, useState } from "react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import StatusIndicator from "../../../components/legion/StatusIndicator";
import {
  EQUIPMENT_OOS_LABEL,
  equipmentPointDisplayValue,
} from "../../../hooks/useEquipmentLivePoints";
import { classifyOperatorPointKind, pointStatusLabel } from "../../../lib/operator/pointKind";
import { resolvePointAlarmState } from "../../../lib/operator/pointAlarms";
import { canCommandPoints } from "../../../lib/access/operatorPermissions";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "analog", label: "Analog" },
  { id: "binary", label: "Binary" },
  { id: "multistate", label: "Multi-State" },
];

function statusTone(label) {
  const s = String(label || "").toLowerCase();
  if (s.includes("alarm")) return "ALARM";
  if (s === "normal" || s === "online") return "LIVE";
  if (s === "stale" || s === "pending") return "STALE";
  if (s === "offline" || s === "fault") return "OFFLINE";
  if (s === "out of service") return "STALE";
  return "UNKNOWN";
}

export default function EquipmentPointsCard({
  displayPoints,
  pointUiState,
  onSelectPoint,
  currentUser,
  expandedId,
  onToggleExpand,
  alarms = [],
  equipmentId,
}) {
  const [filter, setFilter] = useState("all");
  const canCommand = canCommandPoints(currentUser);

  const rows = useMemo(() => {
    const list = displayPoints || [];
    if (filter === "all") return list;
    return list.filter((p) => classifyOperatorPointKind(p) === filter);
  }, [displayPoints, filter]);

  const expanded = expandedId === "points";

  return (
    <ExpandableWorkspaceCard
      title="Points Overview"
      cardId="points"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      clipOverflow={!expanded}
      headerExtra={
        <div className="point-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`point-filters__btn${filter === f.id ? " is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
      footer={
        expanded ? null : (
          <button type="button" className="operator-text-link" onClick={() => onToggleExpand("points")}>
            View All Points →
          </button>
        )
      }
    >
      <div className="points-table-wrap">
        <table className="points-table">
          <thead>
            <tr>
              <th>Point Name</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="points-table__empty">
                  No points for this equipment.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const value = equipmentPointDisplayValue(p, pointUiState);
                const alarm = resolvePointAlarmState(p, alarms, equipmentId || p.equipmentId);
                const status = pointStatusLabel(p, value, EQUIPMENT_OOS_LABEL, alarm.active ? alarm.label : null);
                const communication = pointStatusLabel(p, value, EQUIPMENT_OOS_LABEL);
                return (
                  <tr
                    key={p.id}
                    className={canCommand ? "is-clickable" : ""}
                    onClick={() => {
                      if (canCommand && onSelectPoint) onSelectPoint(p);
                    }}
                    onKeyDown={(e) => {
                      if (!canCommand || !onSelectPoint) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectPoint(p);
                      }
                    }}
                    tabIndex={canCommand ? 0 : undefined}
                  >
                    <td>
                      <span className={`points-table__name${alarm.active ? " points-table__name--alarm" : ""}`}>
                        {p.pointDescription || p.pointName || p.pointKey || p.pointId}
                      </span>
                    </td>
                    <td>{value ?? "—"}</td>
                    <td>
                      <StatusIndicator status={statusTone(status)} label={status} />
                      {alarm.active && communication !== "Normal" ? (
                        <div className="small text-muted">{communication}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ExpandableWorkspaceCard>
  );
}
