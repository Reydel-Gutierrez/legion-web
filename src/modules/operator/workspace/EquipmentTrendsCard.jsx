import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";
import { Routes } from "../../../routes";
import { buildEquipmentTrendChart, resolveTrendSeriesTargets } from "./equipmentTrendChart";

const RANGES = [
  { id: "1h", label: "1 Hour", milliseconds: 3600000 },
  { id: "24h", label: "24 Hours", milliseconds: 86400000 },
  { id: "7d", label: "7 Days", milliseconds: 7 * 86400000 },
  { id: "30d", label: "30 Days", milliseconds: 30 * 86400000 },
];
const COLORS = ["#3b82c4", "#e08a2a", "#3fa37a", "#7c8ea3"];
/** Background poll matches the runtime cadence so newly persisted samples appear without a hard reset. */
const REFRESH_MS = 20000;

function qualityLabel(status) {
  if (status === "LIVE") return "Live";
  if (status === "STALE") return "Stale";
  return "Offline";
}

function formatSeriesValue(value, item) {
  if (value == null) return "—";
  if (item.kind === "binary") return value ? "On" : "Off";
  return typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : String(value);
}

function formatAbsoluteTime(t) {
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString();
}

function formatRelativeAge(t, now) {
  if (!Number.isFinite(t)) return "";
  const deltaSec = Math.max(0, Math.round((now - t) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.round(deltaSec / 3600)}h ago`;
  return `${Math.round(deltaSec / 86400)}d ago`;
}

function TrendTooltip({ active, label, payload, series }) {
  if (!active || !Number.isFinite(label)) return null;
  const rows = (payload || []).filter((entry) => entry.value != null);
  if (!rows.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip__time">{formatAbsoluteTime(label)}</div>
      {rows.map((entry) => {
        const index = Number(String(entry.dataKey).slice(1));
        const item = series[index];
        if (!item) return null;
        const quality = item.qualityByT?.get(label);
        return (
          <div className="trend-tooltip__row" key={entry.dataKey}>
            <span className="trend-tooltip__dot" style={{ background: entry.color }} />
            <span className="trend-tooltip__name">{item.name}</span>
            <span className="trend-tooltip__value">
              {formatSeriesValue(entry.value, item)}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
            {quality ? <span className="trend-tooltip__quality">{quality === "ONLINE" ? "Live" : quality}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function EquipmentTrendsCard({ siteKey, equipmentId, displayPoints = [], now = Date.now(), pollRateMs, expandedId, onToggleExpand, onConfigure }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("1h");
  const [selectedTrendId, setSelectedTrendId] = useState("");
  const [trendStore, setTrendStore] = useState({ definitions: [], assignments: [] });
  const [error, setError] = useState("");
  const [historyState, setHistoryState] = useState({ status: "idle", targets: [], samples: {} });
  const displayPointsRef = useRef(displayPoints);
  displayPointsRef.current = displayPoints;

  useEffect(() => {
    let active = true;
    setTrendStore({ definitions: [], assignments: [] });
    setError("");
    operatorDefinitionsRepository.fetchTrendStore(siteKey)
      .then((next) => { if (active) setTrendStore(next); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [siteKey, equipmentId]);

  const assignedTrends = useMemo(() => (trendStore.assignments || [])
    .filter((assignment) => assignment.enabled !== false && String(assignment.assetId) === String(equipmentId))
    .map((assignment) => ({ assignment, definition: (trendStore.definitions || []).find((definition) => definition.id === assignment.trendDefinitionId) }))
    .filter((item) => item.definition && item.definition.enabled !== false), [trendStore, equipmentId]);
  const selectedTrend = assignedTrends.find((item) => item.definition.id === selectedTrendId) || assignedTrends[0] || null;

  // Loads persisted historian samples for the selected trend/range. Re-fetching on the runtime poll
  // cadence extends the picture as new samples land — it never clears state first, so a background
  // refresh (or a transient API error) can never blank out history that already rendered correctly.
  useEffect(() => {
    let active = true;
    if (!selectedTrend) {
      setHistoryState({ status: "idle", targets: [], samples: {} });
      return undefined;
    }
    const load = () => {
      const targets = resolveTrendSeriesTargets(selectedTrend, displayPointsRef.current);
      if (!targets.length) {
        if (active) setHistoryState({ status: "unresolved", targets: [], samples: {} });
        return;
      }
      setHistoryState((prev) => ({
        status: prev.samples && Object.keys(prev.samples).length ? "refreshing" : "loading",
        targets,
        samples: prev.samples || {},
        error: "",
      }));
      operatorRepository.fetchTrendHistorySamples(siteKey, targets.map((target) => target.dbPointId), range)
        .then((samples) => { if (active) setHistoryState({ status: "ready", targets, samples, error: "" }); })
        .catch((err) => {
          if (!active) return;
          setHistoryState((prev) => (prev.samples && Object.keys(prev.samples).length
            ? { ...prev, status: "ready" }
            : { status: "error", targets, samples: {}, error: err.message }));
        });
    };
    load();
    const intervalId = window.setInterval(load, REFRESH_MS);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [siteKey, selectedTrend?.definition?.id, selectedTrend?.assignment?.id, range]);

  const model = historyState.targets.length && (historyState.status === "ready" || historyState.status === "refreshing")
    ? buildEquipmentTrendChart(historyState.targets, historyState.samples, now, { pollRateMs })
    : null;
  const activeRange = RANGES.find((item) => item.id === range) || RANGES[0];
  const domain = model && model.hasAnyData
    ? [model.timestamps[0], now]
    : [now - activeRange.milliseconds, now];

  let body = null;
  if (!selectedTrend) {
    body = (
      <div className="operator-empty-graphic">
        <p>{error || "No active trends configured for this equipment."}</p>
        <button type="button" className="operator-text-link" onClick={() => (onConfigure ? onConfigure() : navigate(Routes.LegionTrends.path))}>Configure Trends</button>
      </div>
    );
  } else if (historyState.status === "unresolved") {
    body = (
      <div className="operator-empty-graphic">
        <p>This trend&rsquo;s configured points were not found on this equipment. Open Configure Trends to fix the point mapping.</p>
        <button type="button" className="operator-text-link" onClick={() => (onConfigure ? onConfigure() : navigate(Routes.LegionTrends.path))}>Configure Trends</button>
      </div>
    );
  } else if (historyState.status === "loading") {
    body = <div className="operator-empty-graphic"><p>Loading trend history…</p></div>;
  } else if (historyState.status === "error") {
    body = <div className="operator-empty-graphic"><p>Could not load trend history: {historyState.error}</p></div>;
  } else if (!model || !model.hasAnyData) {
    body = <div className="operator-empty-graphic"><p>Recording started — waiting for historian samples.</p></div>;
  } else {
    body = (
      <div className="equipment-trends-body">
        <div className="equipment-trends-chart" role="img" aria-label={`${selectedTrend.definition.name} trend chart — historian samples`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f4" vertical={false} />
              <XAxis
                dataKey="timestamp" type="number" scale="time" domain={domain}
                tickFormatter={(value) => formatTick(value, range)}
                tick={{ fontSize: 11, fill: "#8a94a0" }} tickLine={false}
              />
              <YAxis
                domain={model.yDomain || ["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#8a94a0" }} tickLine={false} width={46}
                label={commonUnit(model.series) ? { value: commonUnit(model.series), angle: -90, position: "insideLeft", fontSize: 10, fill: "#8a94a0" } : undefined}
              />
              <Tooltip content={(props) => <TrendTooltip {...props} series={model.series} />} />
              {model.series.map((item, index) => (
                <Line
                  key={item.dbPointId} type={item.kind === "binary" || item.kind === "multistate" ? "stepAfter" : "monotone"}
                  dataKey={`s${index}`} name={item.name} unit={item.unit}
                  stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="equipment-trends-legend">
          {model.series.map((item, index) => (
            <div className="equipment-trends-legend__item" key={item.dbPointId}>
              <span className="equipment-trends-legend__dot" style={{ background: COLORS[index % COLORS.length] }} />
              <span className="equipment-trends-legend__name">{item.name}</span>
              <span className="equipment-trends-legend__value">
                {item.lastValue != null ? `${formatSeriesValue(item.lastValue, item)}${item.unit ? ` ${item.unit}` : ""}` : "—"}
              </span>
              <span className={`equipment-trends-legend__quality equipment-trends-legend__quality--${item.commStatus.toLowerCase()}`}>
                {qualityLabel(item.commStatus)}
              </span>
              <span className="equipment-trends-legend__updated">
                {item.lastTimestamp != null
                  ? `Last valid update ${formatRelativeAge(item.lastTimestamp, now)} (${formatAbsoluteTime(item.lastTimestamp)})`
                  : "No samples yet"}
                {item.lossTimestamp != null ? ` · Comm lost ${formatAbsoluteTime(item.lossTimestamp)}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ExpandableWorkspaceCard
      title="Trends" cardId="trends" expandedId={expandedId} onToggleExpand={onToggleExpand}
      titleExtra={selectedTrend ? <select className="trend-selector" aria-label="Saved trend selector" value={selectedTrend.definition.id} onChange={(event) => setSelectedTrendId(event.target.value)}>
          {assignedTrends.map(({ definition }) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
        </select> : null}
      headerExtra={<div className="trend-card-controls">
        <div className="trend-range">{RANGES.map((item) => <button key={item.id} type="button" className={`trend-range__btn${range === item.id ? " is-active" : ""}`} onClick={() => setRange(item.id)}>{item.label}</button>)}</div>
      </div>}
    >
      {body}
    </ExpandableWorkspaceCard>
  );
}

function commonUnit(series) {
  const units = Array.from(new Set((series || []).map((item) => item.unit).filter(Boolean)));
  return units.length === 1 ? units[0] : "";
}

function formatTick(value, range) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || "");
  return range === "1h" || range === "24h" ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : `${date.getMonth() + 1}/${date.getDate()}`;
}
