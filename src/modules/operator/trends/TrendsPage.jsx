import React, { useMemo, useRef, useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { operatorRepository } from "../../../lib/data";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  ButtonGroup,
} from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";

/**
 * Trends Page (MVP)
 * - Hover inspector shows EXACT timestamps (MM/DD/YY HH:mm)
 * - Time axis uses exact timestamps too
 * - Ranges capped to 14D max (per your requirement)
 *
 * No external chart libs. Pure SVG.
 */

export default function TrendsPage() {
  const { site } = useSite();

  // UI state
  const [equipSearch, setEquipSearch] = useState("");
  const [selectedEquip, setSelectedEquip] = useState("VAV-2");
  const [range, setRange] = useState("24H"); // 6H | 24H | 7D | 14D (max)
  const [showPoints, setShowPoints] = useState({
    damper: true,
    flow: true,
    dat: true,
  });

  // Hover inspector state
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const equipmentList = useMemo(
    () => operatorRepository.getTrendEquipmentList(site),
    [site]
  );

  const filteredEquipment = useMemo(() => {
    const q = equipSearch.trim().toLowerCase();
    if (!q) return equipmentList;
    return equipmentList.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q)
    );
  }, [equipmentList, equipSearch]);

  // --- Time helpers (exact timestamps) ---
  const pad2 = (n) => String(n).padStart(2, "0");

  // Format: M/D/YY HH:mm (your example: 2/22/26 14:10)
  const fmtExact = (d) => {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const yy = String(d.getFullYear()).slice(-2);
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    return `${m}/${day}/${yy} ${hh}:${mm}`;
  };

  // Create timestamps ending "now" (rounded to 5 min)
  const buildTimestamps = (count, stepMinutes) => {
    const now = new Date();
    const ms = now.getTime();
    const stepMs = stepMinutes * 60 * 1000;

    // round to nearest 5 minutes for clean display
    const rounded = Math.floor(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const end = new Date(rounded);

    const arr = [];
    for (let i = 0; i < count; i++) {
      // oldest -> newest
      const t = new Date(end.getTime() - stepMs * (count - 1 - i));
      arr.push(t);
    }
    return arr;
  };

  const trendBundle = useMemo(() => {
    const d = operatorRepository.getTrendData(site, selectedEquip, range);
    return {
      timestamps: d.timestamps,
      labels: d.timestamps.map(fmtExact),
      series: { damper: d.damper, flow: d.flow, dat: d.dat },
    };
  }, [site, range, selectedEquip]);

  const { timestamps, labels: timeLabels, series } = trendBundle;

  // Chart layout
  const CHART_W = 1200;
  const CHART_H = 340;
  const PAD = 18;
  const AXIS_H = 36;
  const INNER_H = CHART_H - AXIS_H;

  // Normalization ranges
  const damperMinMax = { min: 0, max: 100 };
  const flowMinMax = { min: 0, max: 1200 };
  const datMinMax = { min: 45, max: 65 };

  const buildPath = (values, min, max, w, h, pad) => {
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const n = values.length;

    const x = (i) => pad + (innerW * i) / (n - 1);
    const y = (v) => {
      const t = (v - min) / (max - min || 1);
      return pad + innerH - innerH * t;
    };

    let d = "";
    for (let i = 0; i < n; i++) {
      const xi = x(i);
      const yi = y(values[i]);
      d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
    }
    return d;
  };

  const scaleX = (idx, n, w, pad) => {
    const innerW = w - pad * 2;
    return pad + (innerW * idx) / (n - 1);
  };

  const scaleY = (v, min, max, h, pad) => {
    const innerH = h - pad * 2;
    const t = (v - min) / (max - min || 1);
    return pad + innerH - innerH * t;
  };

  const damperPath = useMemo(
    () => buildPath(series.damper, damperMinMax.min, damperMinMax.max, CHART_W, INNER_H, PAD),
    [series]
  );

  const flowPath = useMemo(
    () => buildPath(series.flow, flowMinMax.min, flowMinMax.max, CHART_W, INNER_H, PAD),
    [series]
  );

  const datPath = useMemo(
    () => buildPath(series.dat, datMinMax.min, datMinMax.max, CHART_W, INNER_H, PAD),
    [series]
  );

  const latest = useMemo(() => {
    const lastIdx = series.damper.length - 1;
    return {
      damper: series.damper[lastIdx],
      flow: series.flow[lastIdx],
      dat: series.dat[lastIdx],
      ts: timeLabels[lastIdx],
    };
  }, [series, timeLabels]);

  const handleTogglePoint = (key) => {
    setShowPoints((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Hover handlers
  const onMouseMove = (e) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;

    const sx = (mx / rect.width) * CHART_W;

    const n = series.damper.length;
    const innerW = CHART_W - PAD * 2;
    const t = (sx - PAD) / (innerW || 1);
    const clampedT = Math.max(0, Math.min(1, t));
    const idx = Math.round(clampedT * (n - 1));

    setHoverIdx(idx);
  };

  const onMouseLeave = () => setHoverIdx(null);

  const hover = useMemo(() => {
    if (hoverIdx === null) return null;
    const i = hoverIdx;

    return {
      idx: i,
      label: timeLabels[i], // exact timestamp string
      damper: series.damper[i],
      flow: series.flow[i],
      dat: series.dat[i],
      x: scaleX(i, series.damper.length, CHART_W, PAD),
      yDamper: scaleY(series.damper[i], damperMinMax.min, damperMinMax.max, INNER_H, PAD),
      yFlow: scaleY(series.flow[i], flowMinMax.min, flowMinMax.max, INNER_H, PAD),
      yDat: scaleY(series.dat[i], datMinMax.min, datMinMax.max, INNER_H, PAD),
    };
  }, [hoverIdx, series, timeLabels]);

  // Bottom axis ticks (exact timestamps, 5 ticks)
  const axisTicks = useMemo(() => {
    const n = series.damper.length;
    const tickCount = 5;
    const idxs = Array.from({ length: tickCount }, (_, i) =>
      Math.round((i * (n - 1)) / (tickCount - 1))
    );
    return idxs.map((idx) => ({
      idx,
      x: scaleX(idx, n, CHART_W, PAD),
      label: timeLabels[idx],
    }));
  }, [series, timeLabels]);

  return (
    <Container fluid className="px-0">
      {/* HERO / BANNER */}
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      {/* PAGE CONTENT */}
      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h5 className="text-white fw-bold mb-1">Trends</h5>
            <div className="text-white small">
              Select equipment and view historical trend lines (mock data for MVP). Max history: 14 days.
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Range: {range}
            </span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Equipment: {selectedEquip}
            </span>
          </div>
        </div>

        <Row className="g-3">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                {/* TOP BAR */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="text-white fw-semibold">Trend Workspace</div>

                  <ButtonGroup>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="border-opacity-10"
                      active={range === "6H"}
                      onClick={() => setRange("6H")}
                    >
                      6H
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="border-opacity-10"
                      active={range === "24H"}
                      onClick={() => setRange("24H")}
                    >
                      24H
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="border-opacity-10"
                      active={range === "7D"}
                      onClick={() => setRange("7D")}
                    >
                      7D
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="border-opacity-10"
                      active={range === "14D"}
                      onClick={() => setRange("14D")}
                    >
                      14D
                    </Button>
                  </ButtonGroup>
                </div>

                {/* CONTROLS */}
                <Row className="g-2 align-items-end mb-3">
                  <Col xs={12} md={5} lg={4}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Search Equipment
                    </Form.Label>
                    <Form.Control
                      value={equipSearch}
                      onChange={(e) => setEquipSearch(e.target.value)}
                      placeholder="Search VAV, AHU, FCU…"
                      className="bg-dark text-white border border-light border-opacity-10"
                    />
                  </Col>

                  <Col xs={12} md={4} lg={4}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Select Equipment
                    </Form.Label>
                    <Form.Select
                      value={selectedEquip}
                      onChange={(e) => setSelectedEquip(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      {filteredEquipment.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col xs={12} md={3} lg={4}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Points
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        active={showPoints.damper}
                        onClick={() => handleTogglePoint("damper")}
                      >
                        Damper %
                      </Button>

                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        active={showPoints.flow}
                        onClick={() => handleTogglePoint("flow")}
                      >
                        Flow CFM
                      </Button>

                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        active={showPoints.dat}
                        onClick={() => handleTogglePoint("dat")}
                      >
                        DAT °F
                      </Button>
                    </div>
                  </Col>
                </Row>

                {/* QUICK SUMMARY */}
                <Row className="g-2 mb-3">
                  <Col xs={12} md={4}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Latest Damper</div>
                      <div className="text-white fw-bold" style={{ fontSize: 22 }}>
                        {latest.damper}%
                      </div>
                      <div className="text-white small">Timestamp: {latest.ts}</div>
                    </div>
                  </Col>

                  <Col xs={12} md={4}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Latest Flow</div>
                      <div className="text-white fw-bold" style={{ fontSize: 22 }}>
                        {latest.flow} CFM
                      </div>
                      <div className="text-white small">Timestamp: {latest.ts}</div>
                    </div>
                  </Col>

                  <Col xs={12} md={4}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Latest DAT</div>
                      <div className="text-white fw-bold" style={{ fontSize: 22 }}>
                        {latest.dat}°F
                      </div>
                      <div className="text-white small">Timestamp: {latest.ts}</div>
                    </div>
                  </Col>
                </Row>

                {/* CHART */}
                <div className="border border-light border-opacity-10 rounded overflow-hidden">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 border-bottom border-light border-opacity-10">
                    <div className="text-white fw-semibold">
                      {selectedEquip} • Trend Chart
                    </div>
                    <div className="text-white fw-semibold">
                      Hover the chart to inspect values (exact timestamps).
                    </div>
                  </div>

                  <div className="p-3">
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <svg
                        ref={svgRef}
                        width={CHART_W}
                        height={CHART_H}
                        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                        style={{ display: "block", cursor: "crosshair" }}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                      >
                        {/* Background */}
                        <rect
                          x="0"
                          y="0"
                          width={CHART_W}
                          height={CHART_H}
                          fill="rgba(0,0,0,0.18)"
                        />

                        {/* Grid (plot area only) */}
                        {Array.from({ length: 6 }).map((_, i) => {
                          const y = PAD + ((INNER_H - PAD * 2) * i) / 5;
                          return (
                            <line
                              key={`gy-${i}`}
                              x1={PAD}
                              y1={y}
                              x2={CHART_W - PAD}
                              y2={y}
                              stroke="rgba(255,255,255,0.10)"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {Array.from({ length: 9 }).map((_, i) => {
                          const x = PAD + ((CHART_W - PAD * 2) * i) / 8;
                          return (
                            <line
                              key={`gx-${i}`}
                              x1={x}
                              y1={PAD}
                              x2={x}
                              y2={INNER_H - PAD}
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="1"
                            />
                          );
                        })}

                        {/* Trend lines */}
                        {showPoints.flow && (
                          <path
                            d={flowPath}
                            fill="none"
                            stroke="rgba(255,255,255,0.55)"
                            strokeWidth="2.5"
                          />
                        )}
                        {showPoints.damper && (
                          <path
                            d={damperPath}
                            fill="none"
                            stroke="rgba(255,255,255,0.85)"
                            strokeWidth="2.5"
                          />
                        )}
                        {showPoints.dat && (
                          <path
                            d={datPath}
                            fill="none"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="2.5"
                          />
                        )}

                        {/* Hover crosshair + markers + tooltip */}
                        {hover && (
                          <g>
                            {/* vertical crosshair */}
                            <line
                              x1={hover.x}
                              y1={PAD}
                              x2={hover.x}
                              y2={INNER_H - PAD}
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="1"
                            />

                            {/* markers */}
                            {showPoints.damper && (
                              <circle
                                cx={hover.x}
                                cy={hover.yDamper}
                                r="4.5"
                                fill="rgba(255,255,255,0.95)"
                              />
                            )}
                            {showPoints.flow && (
                              <circle
                                cx={hover.x}
                                cy={hover.yFlow}
                                r="4.5"
                                fill="rgba(255,255,255,0.70)"
                              />
                            )}
                            {showPoints.dat && (
                              <circle
                                cx={hover.x}
                                cy={hover.yDat}
                                r="4.5"
                                fill="rgba(255,255,255,0.45)"
                              />
                            )}

                            {/* tooltip */}
                            {(() => {
                              const boxW = 320;
                              const boxH = 106;
                              const padX = 12;
                              const padY = 16;

                              const left = Math.min(
                                CHART_W - PAD - boxW,
                                Math.max(PAD, hover.x + 14)
                              );

                              const top = PAD + 10;

                              const lines = [
                                { on: true, label: "Time", value: hover.label },
                                showPoints.damper
                                  ? { on: true, label: "Damper", value: `${hover.damper}%` }
                                  : { on: false },
                                showPoints.flow
                                  ? { on: true, label: "Flow", value: `${hover.flow} CFM` }
                                  : { on: false },
                                showPoints.dat
                                  ? { on: true, label: "DAT", value: `${hover.dat}°F` }
                                  : { on: false },
                              ].filter((x) => x.on);

                              return (
                                <g>
                                  <rect
                                    x={left}
                                    y={top}
                                    width={boxW}
                                    height={boxH}
                                    rx="10"
                                    fill="rgba(0,0,0,0.55)"
                                    stroke="rgba(255,255,255,0.18)"
                                  />

                                  <text
                                    x={left + padX}
                                    y={top + padY}
                                    fill="rgba(255,255,255,0.95)"
                                    fontSize="13"
                                    fontFamily="system-ui, -apple-system, Segoe UI, Roboto"
                                    fontWeight="700"
                                  >
                                    Inspector
                                  </text>

                                  {lines.map((ln, idx) => (
                                    <text
                                      key={idx}
                                      x={left + padX}
                                      y={top + padY + 20 + idx * 18}
                                      fill="rgba(255,255,255,0.95)"
                                      fontSize="12.5"
                                      fontFamily="system-ui, -apple-system, Segoe UI, Roboto"
                                    >
                                      {ln.label}:{" "}
                                      <tspan fontWeight="700">{ln.value}</tspan>
                                    </text>
                                  ))}
                                </g>
                              );
                            })()}
                          </g>
                        )}

                        {/* Bottom axis separator */}
                        <line
                          x1={PAD}
                          y1={INNER_H}
                          x2={CHART_W - PAD}
                          y2={INNER_H}
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="1"
                        />

                        {/* Bottom axis ticks + exact timestamp labels */}
                        {axisTicks.map((t) => (
                          <g key={t.idx}>
                            <line
                              x1={t.x}
                              y1={INNER_H}
                              x2={t.x}
                              y2={INNER_H + 8}
                              stroke="rgba(255,255,255,0.18)"
                              strokeWidth="1"
                            />
                            <text
                              x={t.x}
                              y={INNER_H + 26}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.90)"
                              fontSize="12"
                              fontFamily="system-ui, -apple-system, Segoe UI, Roboto"
                            >
                              {t.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    {/* Footer / hint */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                      <div className="text-white small fw-semibold">
                        Max trend retention: 14 days. Hover the chart to see exact timestamps and values.
                      </div>
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        onClick={() => {}}
                      >
                        Export (later)
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-white small fw-semibold">
                  Next step: wire timestamps + values from your historian table (trend_logs) instead of mock data.
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}