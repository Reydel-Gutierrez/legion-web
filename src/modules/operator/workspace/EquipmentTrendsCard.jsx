import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";
import { Routes } from "../../../routes";

const RANGES = [{ id: "1h", label: "1 Hour" }, { id: "24h", label: "24 Hours" }, { id: "7d", label: "7 Days" }, { id: "30d", label: "30 Days" }];
const COLORS = ["#3b82c4", "#e08a2a", "#3fa37a", "#7c8ea3"];

export default function EquipmentTrendsCard({ siteKey, equipmentId, expandedId, onToggleExpand, onConfigure }) {
  const history = useHistory(); const [range, setRange] = useState("1h"); const [selectedTrendId, setSelectedTrendId] = useState("");
  const [trendStore, setTrendStore] = useState({ definitions: [], assignments: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setTrendStore({ definitions: [], assignments: [] }); setError("");
    operatorDefinitionsRepository.fetchTrendStore(siteKey).then((next) => { if (active) setTrendStore(next); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [siteKey, equipmentId]);
  const assignedTrends = useMemo(() => (trendStore.assignments || []).filter((assignment) => assignment.enabled !== false && String(assignment.assetId) === String(equipmentId)).map((assignment) => ({ assignment, definition: (trendStore.definitions || []).find((definition) => definition.id === assignment.trendDefinitionId) })).filter((item) => item.definition && item.definition.enabled !== false), [trendStore, equipmentId]);
  const selectedTrend = assignedTrends.find((item) => item.definition.id === selectedTrendId) || assignedTrends[0] || null;
  const data = useMemo(() => selectedTrend ? operatorRepository.getTrendData(siteKey, equipmentId, range, { trendDefinitionId: selectedTrend.definition.id, pointIds: selectedTrend.definition.pointIds }) || { timestamps: [], series: [] } : { timestamps: [], series: [] }, [siteKey, equipmentId, range, selectedTrend]);
  const allowed = new Set(selectedTrend?.definition.pointIds || []); const series = (data.series || []).filter((item) => (!allowed.size || allowed.has(item.pointId) || allowed.has(item.id)) && (item.values || []).length);
  const chart = (data.timestamps || []).length && series.length ? data.timestamps.map((timestamp, index) => ({ timestamp, label: formatTick(timestamp, range), ...Object.fromEntries(series.map((item, seriesIndex) => [`s${seriesIndex}`, item.values[index]])) })) : [];
  return <ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId={expandedId} onToggleExpand={onToggleExpand} headerExtra={<div className="trend-card-controls">{assignedTrends.length ? <select aria-label="Saved trend selector" value={selectedTrend?.definition.id || ""} onChange={(event) => setSelectedTrendId(event.target.value)}>{assignedTrends.map(({ definition }) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select> : null}<div className="trend-range">{RANGES.map((item) => <button key={item.id} type="button" className={`trend-range__btn${range === item.id ? " is-active" : ""}`} onClick={() => setRange(item.id)}>{item.label}</button>)}</div></div>}>
    {chart.length ? <div className="equipment-trends-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="#eef1f4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a94a0" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "#8a94a0" }} axisLine={false} tickLine={false} width={36} /><Tooltip />{series.map((item, index) => <Line key={item.id || item.pointId || index} type="monotone" dataKey={`s${index}`} name={item.name || item.label || item.pointId} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div> : <div className="operator-empty-graphic"><p>{error || (selectedTrend ? `${selectedTrend.definition.name} — Waiting for historian data...` : "No active trends configured for this equipment.")}</p><button type="button" className="operator-text-link" onClick={() => onConfigure ? onConfigure() : history.push(Routes.LegionTrends.path)}>Configure Trends</button></div>}
  </ExpandableWorkspaceCard>;
}
function formatTick(value, range) { const date = new Date(value); if (!Number.isFinite(date.getTime())) return String(value || ""); return range === "1h" || range === "24h" ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : `${date.getMonth() + 1}/${date.getDate()}`; }
