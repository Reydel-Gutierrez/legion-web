import React, { useMemo } from "react";
import { Button } from "@themesberg/react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatAxisTimeLabel } from "../trendChartUtils";
import { formatTrendXAxisTickLabel, getTrendXAxisTickIndices } from "../trendAxisTicks";

/**
 * Mirrors the MUI X Charts BasicLineChart idea (series + height ~300 + time on x-axis), implemented with Recharts
 * because @mui/x-charts does not compile under react-scripts 3’s Babel (modern syntax in @mui packages).
 */

/** Plot width as % of the trend card (centered). */
const CHART_PLOT_WIDTH_PCT = 80;
const CHART_HEIGHT = 300;

const CHART_PALETTE = [
  "rgba(255,255,255,0.88)",
  "rgba(255,255,255,0.58)",
  "rgba(255,255,255,0.38)",
  "rgba(147,197,253,0.85)",
  "rgba(253,186,116,0.85)",
];

function buildChartRows(timeLabels, visibleSeries) {
  const n = visibleSeries[0]?.values?.length ?? 0;
  if (!n) return [];
  return Array.from({ length: n }, (_, i) => {
    const row = { idx: i, _t: formatAxisTimeLabel(timeLabels[i] ?? "") };
    visibleSeries.forEach((s, j) => {
      row[`v${j}`] = s.values[i];
    });
    return row;
  });
}

function TrendRechartsLineChart({ timeLabels, series, showPoints, range, chartTimestamps }) {
  const visible = useMemo(
    () => series.filter((s) => showPoints[s.pointId]),
    [series, showPoints]
  );

  const xAxisTicks = useMemo(
    () => getTrendXAxisTickIndices(range, timeLabels, chartTimestamps),
    [range, timeLabels, chartTimestamps]
  );

  const { rows, yMin, yMax, keys } = useMemo(() => {
    if (!visible.length) return { rows: [], yMin: 0, yMax: 1, keys: [] };
    const flat = visible.flatMap((s) => s.values);
    const yMinRaw = Math.min(...flat);
    const yMaxRaw = Math.max(...flat);
    const span = yMaxRaw - yMinRaw || 1;
    const pad = span * 0.05;
    const ks = visible.map((_, j) => `v${j}`);
    return {
      rows: buildChartRows(timeLabels, visible),
      yMin: yMinRaw - pad,
      yMax: yMaxRaw + pad,
      keys: ks,
    };
  }, [visible, timeLabels]);

  if (!rows.length || !keys.length) return null;

  return (
    <div style={{ width: "100%", height: CHART_HEIGHT, minHeight: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="idx"
            type="number"
            domain={["dataMin", "dataMax"]}
            ticks={xAxisTicks}
            tickFormatter={(idx) =>
              formatTrendXAxisTickLabel(range, timeLabels[typeof idx === "number" ? idx : Number(idx)] ?? "")
            }
            stroke="rgba(255,255,255,0.25)"
            tick={{ fill: "rgba(255,255,255,0.78)", fontSize: 11 }}
          />
          {/* Scale only — no tick values on the y-axis (hover tooltip still shows numbers). */}
          <YAxis domain={[yMin, yMax]} hide />
          <Tooltip
            contentStyle={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              color: "#fff",
            }}
            labelFormatter={(_label, payload) =>
              payload && payload[0] && payload[0].payload ? payload[0].payload._t : ""
            }
          />
          <Legend wrapperStyle={{ color: "rgba(255,255,255,0.88)", fontSize: 12 }} />
          {visible.map((s, j) => (
            <Line
              key={s.pointId}
              type="linear"
              dataKey={keys[j]}
              name={s.unit ? `${s.label} (${s.unit})` : s.label}
              stroke={CHART_PALETTE[j % CHART_PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * @param {{
 *   timeLabels: string[];
 *   series: { pointId: string; label: string; unit: string; min: number; max: number; values: number[] }[];
 *   showPoints: Record<string, boolean>;
 *   referenceBands: { pointId: string; min: number; max: number; enabled: boolean; showOnChart: boolean; label?: string }[];
 *   events: { kind: string; atIdx?: number; startIdx?: number; endIdx?: number; label?: string }[];
 *   overlaySettings: { alarms: boolean; schedule: boolean; commLoss: boolean; modeChange: boolean };
 *   title: string;
 *   subtitle?: string;
 *   sessionActive?: boolean;
 *   collecting?: boolean;
 *   range?: string;
 *   chartTimestamps?: unknown[];
 *   templateSettingsMode?: boolean;
 * }} props
 */
export default function TrendChartPanel({
  timeLabels,
  series,
  showPoints,
  referenceBands: _referenceBands,
  events: _events,
  overlaySettings: _overlaySettings,
  title,
  subtitle,
  sessionActive = true,
  collecting = false,
  range = "24H",
  chartTimestamps,
  templateSettingsMode = false,
}) {
  const primaryLen = series[0]?.values?.length || 0;
  const yAxisSeries = useMemo(() => series.find((s) => showPoints[s.pointId]) || null, [series, showPoints]);

  const showCollectingWarmup = sessionActive && collecting && series.length === 0;
  const chartEmpty = !series.length || primaryLen < 2;

  return (
    <div className="border border-light border-opacity-10 rounded w-100">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-2 px-md-3 py-2 border-bottom border-light border-opacity-10">
        <div className="text-white fw-semibold small">{title}</div>
        <div className="text-white small opacity-90">
          {templateSettingsMode
            ? "Template-only view — no equipment or historian. Assign this template to an asset to see a chart."
            : !sessionActive
              ? "Start a trend to load historical data for this asset."
              : collecting
                ? "Trend started. Historical data is now being collected."
                : subtitle || "Hover the chart for values and exact times."}
        </div>
      </div>

      <div className="px-0 pt-0 pb-3">
        {templateSettingsMode ? (
          <div className="text-white small py-5 text-center opacity-90 px-3">
            Chart preview is not available while editing a template without an asset. Select an asset in the toolbar (exits template view) or assign this template to equipment, then open that asset to view trends.
          </div>
        ) : !sessionActive ? (
          <div className="text-white small py-5 text-center opacity-85">
            No trend is running yet. Use <strong>New Trend</strong> or open a <strong>saved trend or template</strong>, then data will appear here for the selected equipment.
          </div>
        ) : showCollectingWarmup ? (
          <div className="text-white small py-5 text-center opacity-90 px-3">
            Trend started. Historical data is now being collected.
            <div className="mt-2 opacity-75 small">The chart will fill as samples arrive (mock interval).</div>
          </div>
        ) : chartEmpty ? (
          <div className="text-white small py-5 text-center opacity-75 px-3">No series to plot. Select one or more points above.</div>
        ) : (
          <div
            className="trend-chart-recharts-wrap mx-auto rounded"
            style={{
              width: `${CHART_PLOT_WIDTH_PCT}%`,
              minWidth: 280,
              background: "rgba(0,0,0,0.22)",
              padding: "8px 8px 4px",
            }}
          >
            <TrendRechartsLineChart
              timeLabels={timeLabels}
              series={series}
              showPoints={showPoints}
              range={range}
              chartTimestamps={chartTimestamps}
            />
            {series.filter((s) => showPoints[s.pointId]).length ? (
              <div className="text-center text-white small opacity-75 px-2 mt-2 mb-0 w-100">
                Y-axis uses the min–max of visible samples
                {yAxisSeries?.unit ? ` (${yAxisSeries.unit} on the scale)` : ""}. Reference bands and event overlays are not drawn on this chart yet.
              </div>
            ) : null}
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 px-3">
          <div className="text-white small fw-semibold">Max retention (mock): 14 days. Overlays respect the toggles in configuration.</div>
          <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={() => {}}>
            Export (later)
          </Button>
        </div>
      </div>
    </div>
  );
}
