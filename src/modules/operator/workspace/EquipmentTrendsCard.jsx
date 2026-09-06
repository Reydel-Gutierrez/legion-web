import React, { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { operatorRepository } from "../../../lib/data";
import { Routes } from "../../../routes";
import { classifyOperatorPointKind } from "../../../lib/operator/pointKind";

const RANGES = [
  { id: "1h", label: "1 Hour" },
  { id: "24h", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
];

const SERIES_COLORS = ["#3b82c4", "#e08a2a", "#3fa37a", "#7c8ea3"];

function mapRange(id) {
  if (id === "1h") return "1h";
  if (id === "24h") return "24h";
  if (id === "7d") return "7d";
  return "30d";
}

export default function EquipmentTrendsCard({
  siteKey,
  equipmentId,
  displayPoints,
  expandedId,
  onToggleExpand,
}) {
  const history = useHistory();
  const [range, setRange] = useState("1h");

  const data = useMemo(() => {
    if (!equipmentId) return { timestamps: [], series: [] };
    try {
      return operatorRepository.getTrendData(siteKey, equipmentId, mapRange(range)) || {
        timestamps: [],
        series: [],
      };
    } catch {
      return { timestamps: [], series: [] };
    }
  }, [siteKey, equipmentId, range]);

  const analog = useMemo(
    () => (displayPoints || []).filter((p) => classifyOperatorPointKind(p) === "analog").slice(0, 3),
    [displayPoints]
  );

  const chart = useMemo(() => {
    const timestamps = data.timestamps || [];
    const series = Array.isArray(data.series) ? data.series.filter((s) => (s.values || []).length) : [];
    if (!timestamps.length || !series.length) return [];
    return timestamps.map((t, i) => {
      const row = { t, label: formatTick(t, range) };
      series.forEach((s, si) => {
        row[`s${si}`] = s.values[i];
      });
      return row;
    });
  }, [data, range]);

  const series = (data.series || []).filter((s) => (s.values || []).length);

  return (
    <ExpandableWorkspaceCard
      title="Trends"
      cardId="trends"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      headerExtra={
        <div className="trend-range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`trend-range__btn${range === r.id ? " is-active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {chart.length > 0 ? (
        <div className="equipment-trends-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a94a0" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a94a0" }} axisLine={false} tickLine={false} width={36} />
              <Tooltip />
              {series.map((s, i) => (
                <Line
                  key={s.id || s.name || i}
                  type="monotone"
                  dataKey={`s${i}`}
                  name={s.name || s.label || s.pointId || `Series ${i + 1}`}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="operator-empty-graphic">
          <p>No historian data for this equipment in the selected range.</p>
          {analog.length > 0 ? (
            <ul className="trend-live-snapshot">
              {analog.map((p) => (
                <li key={p.id}>
                  <span>{p.pointDescription || p.pointName || p.pointKey}</span>
                  <strong>{p.value ?? "—"}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="operator-text-link"
            onClick={() => history.push(Routes.LegionTrends.path)}
          >
            Open full Trends workspace
          </button>
        </div>
      )}
    </ExpandableWorkspaceCard>
  );
}

function formatTick(value, range) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value ?? "");
  if (range === "1h" || range === "24h") {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
