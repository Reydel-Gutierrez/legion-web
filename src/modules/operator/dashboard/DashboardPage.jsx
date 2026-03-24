import React, { useMemo, useState, useEffect } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { useSiteDisplayLabel } from "../../../hooks/useSiteDisplayLabel";
import { useActiveDeployment } from "../../../hooks/useWorkingVersion";
import {
  getSummaryFromActiveRelease,
  getFloorCommunicationHealthFromRelease,
} from "../../../lib/activeReleaseUtils";
import {
  computeInsightsSnapshot,
  mergeKFactors,
  loadKFactorOverrides,
  saveKFactorOverrides,
  DEFAULT_KW_BY_EQUIP_TYPE,
} from "../../../lib/insights/energyInsights";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Modal,
  Form,
} from "@themesberg/react-bootstrap";
import { Link } from "react-router-dom";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { Routes } from "../../../routes";
import { operatorRepository } from "../../../lib/data";

/** Enterprise palette: cool slate / teal — cohesive, not rainbow. */
const CONNECTED_LOAD_FILLS = [
  "linear-gradient(180deg, #5d8ec4 0%, #3a5a78 100%)",
  "linear-gradient(180deg, #4fa894 0%, #2d6a58 100%)",
  "linear-gradient(180deg, #6d8eb8 0%, #4a5f78 100%)",
  "linear-gradient(180deg, #7a9ec8 0%, #4d6488 100%)",
  "linear-gradient(180deg, #5a8aaa 0%, #3d5f72 100%)",
  "linear-gradient(180deg, #8a9eb0 0%, #5a6a78 100%)",
];
const CONNECTED_LOAD_SWATCHES = ["#4d7ab0", "#3d9078", "#5a7a98", "#5d8ab8", "#4a7a92", "#6a7a90"];

function LegionConnectedLoad({ kwBreakdown, totalKw, onOpenAssumptions }) {
  if (!kwBreakdown.length) {
    return (
      <div className="legion-connected-load">
        <p className="small text-white-50 mb-0">No equipment in scope for connected load. Add released equipment or enable schedules.</p>
      </div>
    );
  }
  return (
    <div className="legion-connected-load">
      <div className="legion-connected-load__header">
        <div>
          <div className="legion-connected-load__title">Connected load</div>
          <p className="legion-connected-load__subtitle mb-0">
            k-factor × units per type. Tune in{" "}
            <button type="button" className="legion-connected-load__link" onClick={onOpenAssumptions}>
              Energy assumptions
            </button>
            .
          </p>
        </div>
        <div className="legion-connected-load__total-pill">
          <div>
            <span className="legion-connected-load__total-value">{totalKw.toFixed(1)}</span>
            <span className="legion-connected-load__total-unit">kW</span>
          </div>
          <div className="legion-connected-load__total-label">Total connected</div>
        </div>
      </div>
      <div className="legion-connected-load__track">
        <div className="legion-connected-load__bar" role="img" aria-label="Connected load share by equipment type">
          {kwBreakdown.map((b, i) => {
            const sharePct = totalKw > 0 ? (b.kw / totalKw) * 100 : 0;
            return (
              <div
                key={b.type}
                className="legion-connected-load__segment"
                style={{
                  flexGrow: b.kw,
                  background: CONNECTED_LOAD_FILLS[i % CONNECTED_LOAD_FILLS.length],
                }}
                title={`${b.type}: ${b.kw.toFixed(2)} kW (${sharePct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>
      <div className="legion-connected-load__legend">
        <div className="legion-connected-load__legend-head">
          <span>Type</span>
          <span>kW</span>
          <span>Share</span>
          <span>Units</span>
        </div>
        {kwBreakdown.map((b, i) => {
          const pct = totalKw > 0 ? (b.kw / totalKw) * 100 : 0;
          return (
            <div key={b.type} className="legion-connected-load__legend-row">
              <div className="legion-connected-load__legend-type">
                <span
                  className="legion-connected-load__swatch"
                  style={{ background: CONNECTED_LOAD_SWATCHES[i % CONNECTED_LOAD_SWATCHES.length] }}
                />
                <span className="text-truncate" title={b.type}>
                  {b.type}
                </span>
              </div>
              <span className="legion-connected-load__legend-kw">{b.kw.toFixed(1)}</span>
              <span className="legion-connected-load__legend-pct">{pct.toFixed(0)}%</span>
              <span className="legion-connected-load__legend-count">{b.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Donut-style comm health ring (matches Insights Communication Health styling). */
function CommRing({ pct, size = 72 }) {
  const inner = Math.round(size * 0.76);
  const fontSize = Math.max(11, Math.round(size * 0.2));
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="mx-auto"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: `conic-gradient(#86f4ba ${clamped * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: "50%",
          background: "#0f1b3c",
          display: "grid",
          placeItems: "center",
          color: "#f7fbff",
          fontWeight: 700,
          fontSize,
        }}
      >
        {clamped}%
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { site } = useSite();
  const siteLabel = useSiteDisplayLabel();
  const { deployment } = useActiveDeployment();
  const activeReleaseData = deployment;

  const [kFactorOverrides, setKFactorOverrides] = useState(() => loadKFactorOverrides());
  const [showKModal, setShowKModal] = useState(false);
  const [unsavedKFactors, setUnsavedKFactors] = useState({});

  useEffect(() => {
    setKFactorOverrides(loadKFactorOverrides());
  }, []);

  const mergedKFactors = useMemo(() => mergeKFactors(kFactorOverrides), [kFactorOverrides]);

  const summary = useMemo(
    () =>
      activeReleaseData
        ? getSummaryFromActiveRelease(activeReleaseData)
        : { equipmentCount: 0, activeAlarms: 0, unackedAlarms: 0, devicesOffline: 0, openTasks: 0, energyRuntime: null },
    [activeReleaseData]
  );
  const insightsFootnote = useMemo(
    () =>
      "Estimates use enabled schedules, equipment from the active release, and your k-factors. Open Energy assumptions to tune load models.",
    []
  );

  const schedules = useMemo(
    () => operatorRepository.getSchedules(site),
    [site]
  );

  const equipmentOnline = Math.max(summary.equipmentCount - summary.devicesOffline, 0);
  const communicationHealth = Math.max(
    55,
    Math.min(99, 100 - summary.devicesOffline * 6 - summary.unackedAlarms * 2)
  );
  const floorCommRows = useMemo(
    () => getFloorCommunicationHealthFromRelease(activeReleaseData),
    [activeReleaseData]
  );
  const overallCommStats = useMemo(() => {
    if (!floorCommRows.length) {
      return {
        pct: communicationHealth,
        online: equipmentOnline,
        offline: summary.devicesOffline,
      };
    }
    const totalEq = floorCommRows.reduce((s, r) => s + r.total, 0);
    const onlineEq = floorCommRows.reduce((s, r) => s + r.online, 0);
    const offlineEq = Math.max(0, totalEq - onlineEq);
    const pct =
      totalEq === 0
        ? communicationHealth
        : Math.round((100 * onlineEq) / totalEq);
    return { pct, online: onlineEq, offline: offlineEq };
  }, [floorCommRows, communicationHealth, equipmentOnline, summary.devicesOffline]);

  const commOfflineCount = overallCommStats.offline;
  const insights = useMemo(
    () =>
      computeInsightsSnapshot({
        siteId: site,
        releaseSnapshot: activeReleaseData,
        schedules,
        mergedKFactors,
        summaryDevicesOffline: commOfflineCount,
      }),
    [site, activeReleaseData, schedules, mergedKFactors, commOfflineCount]
  );

  const {
    todaysKwh,
    monthlyRuntimeHours,
    weekDeltaPct,
    energySavingsUsd,
    weeklySavingsUsd,
    yearlyCostImpactUsd,
    co2AvoidedLbs,
    kwBreakdown,
    trendSeries,
    efficiencyScore,
    meanDailyRunHours,
  } = insights;

  const maxTrendKwh = useMemo(
    () => Math.max(...trendSeries.map((t) => t.kwh), 1),
    [trendSeries]
  );
  const trendPoints = useMemo(
    () =>
      trendSeries.map((t, i) => ({
        x: t.x,
        yA: 100 - (t.kwh / maxTrendKwh) * 72,
        yB: 100 - ((t.kwh * 0.94) / maxTrendKwh) * 72,
      })),
    [trendSeries, maxTrendKwh]
  );

  const openKModal = () => {
    setUnsavedKFactors({ ...mergedKFactors });
    setShowKModal(true);
  };
  const saveKFactors = () => {
    const next = { ...unsavedKFactors };
    saveKFactorOverrides(next);
    setKFactorOverrides(next);
    setShowKModal(false);
  };
  const resetKFactors = () => {
    saveKFactorOverrides({});
    setKFactorOverrides({});
    setShowKModal(false);
  };

  const kFactorEditKeys = useMemo(() => {
    const fromTypes = new Set(kwBreakdown.map((k) => k.type));
    Object.keys(DEFAULT_KW_BY_EQUIP_TYPE).forEach((k) => {
      if (k !== "DEFAULT") fromTypes.add(k);
    });
    return [...fromTypes].sort();
  }, [kwBreakdown]);

  const totalConnectedKw = useMemo(
    () => kwBreakdown.reduce((s, b) => s + b.kw, 0),
    [kwBreakdown]
  );

  const shellCardStyle = {
    background: "var(--bs-primary)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
  };
  const subPanelStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
  };
  const labelStyle = { color: "#8ca6e0", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" };
  const valueStyle = { color: "#f7fbff", fontSize: 42, lineHeight: 1.05, fontWeight: 700 };

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h5 className="text-white fw-bold mb-1">Insights</h5>
            <div className="text-white small">
              Energy performance, connected load, and communication health — alarms and events live in their own pages.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline-light"
            className="border-opacity-25"
            onClick={openKModal}
          >
            Energy assumptions (k-factors)
          </Button>
        </div>

        <Row className="g-3 mb-3">
          <Col xs={6} md={3}>
            <Card className="h-100" style={shellCardStyle}>
              <Card.Body className="py-3">
                <div style={labelStyle}>
                  Energy Savings
                </div>
                <div className="mt-1" style={{ ...valueStyle, fontSize: 40 }}>
                  ${energySavingsUsd.toLocaleString()}
                </div>
                <div className="small" style={{ color: "#78d6b7" }}>
                  {efficiencyScore}% efficiency vs baseline
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={3}>
            <Card className="h-100" style={shellCardStyle}>
              <Card.Body className="py-3">
                <div style={labelStyle}>
                  Runtime Savings
                </div>
                <div className="mt-1" style={{ ...valueStyle, fontSize: 40 }}>
                  {monthlyRuntimeHours.toLocaleString()}{" "}
                  <span style={{ fontSize: 20, color: "#8ca6e0" }}>hrs</span>
                </div>
                <div className="small" style={{ color: "#f6b26b" }}>
                  est. monthly off-hours (schedules vs 24/7)
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={3}>
            <Card className="h-100" style={shellCardStyle}>
              <Card.Body className="py-3">
                <div style={labelStyle}>
                  Today&apos;s Energy Usage
                </div>
                <div className="mt-1" style={{ ...valueStyle, fontSize: 40 }}>
                  {todaysKwh.toLocaleString()} <span style={{ fontSize: 20, color: "#8ca6e0" }}>kWh</span>
                </div>
                <div className="small" style={{ color: "#a7e4d2" }}>
                  {weekDeltaPct >= 0 ? `${weekDeltaPct}% lower than last week` : `${Math.abs(weekDeltaPct)}% higher than last week`} · ~{meanDailyRunHours.toFixed(1)}h run/day
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={3}>
            <Card className="h-100" style={shellCardStyle}>
              <Card.Body className="py-3">
                <div style={labelStyle}>
                  Communication Health
                </div>
                <div className="mt-1" style={{ ...valueStyle, fontSize: 40 }}>
                  {overallCommStats.pct}%
                </div>
                <div className="small text-white-50">
                  {overallCommStats.offline} device{overallCommStats.offline === 1 ? "" : "s"} offline
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Primary: wide energy charts + prominent communication health (not last) */}
        <Row className="g-4">
          <Col xs={12} lg={8}>
            <Card className="h-100" style={shellCardStyle}>
              <Card.Body className="p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <div className="text-white fw-semibold fs-5">Energy performance</div>
                    <div className="text-white-50 small mt-1">
                      {siteLabel} — usage trend vs baseline and connected load by equipment type
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-3 align-items-center small text-white-50">
                    <span className="d-flex align-items-center gap-2">
                      <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: "#7ad3ff" }} />
                      Actual (kWh)
                    </span>
                    <span className="d-flex align-items-center gap-2">
                      <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: "#f6b26b" }} />
                      Baseline
                    </span>
                  </div>
                </div>
                <div style={subPanelStyle} className="p-3 p-md-4">
                  <div className="text-white fw-semibold small mb-2 text-uppercase" style={{ letterSpacing: "0.06em", color: "#8ca6e0" }}>
                    Usage trend
                  </div>
                  <svg viewBox="0 0 120 100" width="100%" height="220" preserveAspectRatio="none" className="d-block">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <line
                        key={`h-${idx}`}
                        x1="8"
                        y1={14 + idx * 18}
                        x2="112"
                        y2={14 + idx * 18}
                        stroke="rgba(140,166,224,0.16)"
                        strokeWidth="0.7"
                      />
                    ))}
                    <polyline
                      fill="none"
                      stroke="#7ad3ff"
                      strokeWidth="1.6"
                      points={trendPoints.map((p) => `${p.x},${p.yA}`).join(" ")}
                    />
                    <polyline
                      fill="none"
                      stroke="#f6b26b"
                      strokeWidth="1.45"
                      points={trendPoints.map((p) => `${p.x},${p.yB}`).join(" ")}
                    />
                    {trendPoints.map((p, idx) => (
                      <circle key={`p-${idx}`} cx={p.x} cy={p.yA} r="1.4" fill="#7ad3ff" />
                    ))}
                  </svg>
                  <div className="d-flex justify-content-between text-white-50 small mt-2 px-1">
                    {trendSeries.map((t) => (
                      <span key={t.label}>{t.label}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <LegionConnectedLoad
                    kwBreakdown={kwBreakdown}
                    totalKw={totalConnectedKw}
                    onOpenAssumptions={openKModal}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-4 pt-3 border-top border-light border-opacity-10">
                  <div className="text-white">
                    <div className="h4 mb-0">${weeklySavingsUsd.toLocaleString()}</div>
                    <div className="small text-white-50">Estimated savings (period)</div>
                  </div>
                  <div className="text-white">
                    <div className="h4 mb-0">{co2AvoidedLbs.toLocaleString()} lbs</div>
                    <div className="small text-white-50">CO₂ avoided (est.)</div>
                  </div>
                  <Link to={Routes.LegionTrends.path} className="btn btn-sm btn-outline-light border-opacity-25">
                    Open Trends
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={4}>
            <Card
              className="h-100"
              style={{
                ...shellCardStyle,
                minHeight: 320,
              }}
            >
              <Card.Body className="d-flex flex-column p-4">
                <div className="mb-1">
                  <div className="text-white fw-semibold fs-5">Communication health</div>
                  <div className="text-white-50 small mt-1">Network reliability by floor</div>
                </div>
                <div style={subPanelStyle} className="p-3 flex-grow-1 d-flex flex-column mt-2">
                  <div className="mb-3 pb-3 border-bottom border-light border-opacity-10">
                    <div className="text-white-50 small text-uppercase" style={{ letterSpacing: "0.05em", fontSize: 10 }}>
                      Site summary
                    </div>
                    <div className="text-white mt-1" style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 700 }}>
                      {overallCommStats.online}
                      <span className="text-white-50 fw-normal" style={{ fontSize: 16 }}>
                        {" "}
                        online
                      </span>
                    </div>
                    <div className="small text-white-50">
                      {overallCommStats.offline} offline site-wide · {overallCommStats.pct}% healthy
                    </div>
                    {floorCommRows.length > 0 && (
                      <div className="small text-white-50 mt-2">Controller assigned vs total devices per floor.</div>
                    )}
                  </div>
                  <div className="flex-grow-1 d-flex flex-wrap gap-3 justify-content-center align-items-start align-content-start overflow-auto legion-insights-comm-rings">
                    {floorCommRows.length === 0 ? (
                      <div className="text-center py-2">
                        <CommRing pct={overallCommStats.pct} size={96} />
                        <div className="small text-white-50 mt-2">Site average</div>
                      </div>
                    ) : (
                      floorCommRows.map((f) => (
                        <div key={f.id} className="text-center" style={{ minWidth: 76, maxWidth: 100 }}>
                          <CommRing pct={f.pct} size={72} />
                          <div
                            className="small text-white fw-semibold mt-2 px-0"
                            style={{ lineHeight: 1.2, fontSize: 11 }}
                            title={f.buildingLabel ? `${f.buildingLabel} — ${f.label}` : f.label}
                          >
                            {f.label}
                          </div>
                          <div className="small text-white-50" style={{ fontSize: 11 }}>
                            {f.total === 0 ? "No devices" : `${f.offline} offline`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-4 mt-1">
          <Col xs={12}>
            <Card style={shellCardStyle}>
              <Card.Body className="p-4">
                <div className="text-white fw-semibold fs-5 mb-3">Efficiency overview</div>
                <div style={subPanelStyle} className="p-3 p-md-4">
                  <Row className="g-4 align-items-center">
                    <Col xs={12} md={4} lg={3}>
                      <div className="text-white" style={{ fontSize: 58, lineHeight: 1, fontWeight: 700 }}>
                        {efficiencyScore}%
                      </div>
                      <div className="text-white-50 small">Building efficiency</div>
                      <div className="mt-3 text-white" style={{ fontSize: 36, lineHeight: 1.1 }}>
                        ${yearlyCostImpactUsd.toLocaleString()}
                        <span style={{ fontSize: 20, color: "#8ca6e0" }}> / year</span>
                      </div>
                      <div className="small text-white-50">Energy cost impact estimate</div>
                    </Col>
                    <Col xs={12} md={8} lg={9}>
                      <div className="small text-white-50 mb-1">Health band</div>
                      <div
                        className="w-100"
                        style={{
                          height: 12,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${efficiencyScore}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: "linear-gradient(90deg, #8be0c5 0%, #89f7a1 100%)",
                          }}
                        />
                      </div>
                      <div className="d-flex justify-content-between mt-3 text-white">
                        <div>
                          <div className="h4 mb-0">${weeklySavingsUsd.toLocaleString()}</div>
                          <div className="small text-white-50">Monthly savings</div>
                        </div>
                        <div>
                          <div className="h4 mb-0">{co2AvoidedLbs.toLocaleString()} lbs</div>
                          <div className="small text-white-50">CO2 avoided</div>
                        </div>
                        <div>
                          <div className="h4 mb-0">{equipmentOnline}</div>
                          <div className="small text-white-50">Online units</div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="mt-4 small text-white-50 px-1">{insightsFootnote}</div>
      </div>

      <Modal
        show={showKModal}
        onHide={() => setShowKModal(false)}
        centered
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header closeButton closeVariant="white" className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Energy assumptions (k-factors)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-white-50">
            Average electrical draw (kW) while equipment is running. Values feed Today&apos;s kWh, cost estimates, and the
            connected-load chart. Saved in this browser only.
          </p>
          <Row className="g-2">
            {kFactorEditKeys.map((key) => (
              <Col xs={6} md={4} key={key}>
                <Form.Label className="small text-white-50 mb-1">{key}</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-primary text-white border border-light border-opacity-10"
                  value={
                    unsavedKFactors[key] !== undefined
                      ? unsavedKFactors[key]
                      : mergedKFactors[key] ?? DEFAULT_KW_BY_EQUIP_TYPE[key] ?? DEFAULT_KW_BY_EQUIP_TYPE.DEFAULT
                  }
                  onChange={(e) => {
                    const v = parseFloat(e.target.value, 10);
                    setUnsavedKFactors((prev) => ({
                      ...prev,
                      [key]: Number.isFinite(v) ? v : 0,
                    }));
                  }}
                />
              </Col>
            ))}
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="outline-light" className="border-opacity-25" onClick={resetKFactors}>
            Reset defaults
          </Button>
          <Button variant="light" onClick={saveKFactors}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
