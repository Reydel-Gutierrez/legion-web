import React, { useMemo, useState, useEffect } from "react";
import { useSite } from "../../components/SiteContext";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  ButtonGroup,
  OverlayTrigger,
  Tooltip,
} from "@themesberg/react-bootstrap";
import { Link } from "react-router-dom";
import LegionHeroHeader from "../../components/legion/LegionHeroHeader";
import { Routes } from "../../routes";
import {
  getDashboardSummary,
  getRecentEvents,
  getDashboardAlarms,
  getEquipmentHealth,
  getWeather,
} from "../../data/mockDashboard";
import StatusDotLabel from "../../components/legion/StatusDotLabel";

const norm = (v) => String(v ?? "").trim().toLowerCase();
const normalizeSeverityKey = (severity) => {
  const s = norm(severity);
  if (s === "critical" || s === "crit") return "critical";
  if (s === "major" || s === "warn" || s === "warning") return "warning";
  if (s === "minor" || s === "info" || s === "informational") return "minor";
  return "minor";
};

export default function Dashboard() {
  const { site } = useSite();
  const [alarmFilter, setAlarmFilter] = useState("All");
  const [weather, setWeather] = useState(null);

  const summary = useMemo(() => getDashboardSummary(), []);
  const recentEvents = useMemo(() => getRecentEvents(), []);
  const allAlarms = useMemo(() => getDashboardAlarms(), []);
  const equipmentHealth = useMemo(() => getEquipmentHealth(), []);

  const filteredAlarms = useMemo(() => {
    if (alarmFilter === "Unacked") return allAlarms.filter((a) => !a.ack);
    if (alarmFilter === "Critical") {
      return allAlarms.filter(
        (a) => normalizeSeverityKey(a.severity) === "critical"
      );
    }
    return allAlarms;
  }, [allAlarms, alarmFilter]);

  const displayAlarms = useMemo(
    () => filteredAlarms.slice(0, 10),
    [filteredAlarms]
  );

  useEffect(() => {
    let mounted = true;
    getWeather().then((w) => mounted && setWeather(w));
    return () => {
      mounted = false;
    };
  }, []);

  const renderTooltip = (text) => <Tooltip id="tooltip">{text}</Tooltip>;

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h5 className="text-white fw-bold mb-1">Dashboard</h5>
            <div className="text-white small">
              Overview of alarms, equipment health, recent activity, and weather.
            </div>
          </div>
        </div>

        {/* A) Summary Tiles */}
        <Row className="g-3 mb-3">
          <Col xs={6} md={4} lg={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3">
                <div className="text-white-50 small text-uppercase fw-semibold">
                  Active Alarms
                </div>
                <div className="text-danger fs-4 fw-bold mt-1">
                  {summary.activeAlarms}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={4} lg={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3">
                <div className="text-white-50 small text-uppercase fw-semibold">
                  Unacked Alarms
                </div>
                <div className="text-danger fs-4 fw-bold mt-1">
                  {summary.unackedAlarms}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={4} lg={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3">
                <div className="text-white-50 small text-uppercase fw-semibold">
                  Devices Offline
                </div>
                <div className="text-danger fs-4 fw-bold mt-1">
                  {summary.devicesOffline}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={4} lg={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3">
                <div className="text-white-50 small text-uppercase fw-semibold">
                  Open Tasks
                </div>
                <div className="text-white fs-4 fw-bold mt-1">
                  {summary.openTasks}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={6} md={4} lg={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3">
                <div className="text-white-50 small text-uppercase fw-semibold">
                  Energy / Runtime Savings
                </div>
                <div className="text-white fs-4 fw-bold mt-1">
                  {summary.energyRuntime != null ? summary.energyRuntime : "—"}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

                {/* E) Weather + F) Quick Actions */}
        <Row className="g-3 mt-2 mb-3">
          <Col xs={12} md={6} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="text-white fw-bold mb-3">Weather / Outside Air</div>

                {weather ? (
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <div className="text-white-50 small">Outside Air Temp (OAT)</div>
                        <div className="text-white fs-3 fw-bold">{weather.oat}°F</div>
                      </div>
                      <div className="text-end">
                        <div className="text-white-50 small">Humidity</div>
                        <div className="text-white fw-bold">{weather.humidity}%</div>
                      </div>
                    </div>

                    <div className="text-white fw-semibold mb-2">{weather.condition}</div>

                    <div className="border border-light border-opacity-10 rounded p-2">
                      <div className="text-white-50 small mb-2">Outlook</div>
                      <div className="d-flex flex-wrap gap-2">
                        {weather.outlook.map((o, i) => (
                          <div
                            key={i}
                            className="bg-dark bg-opacity-25 rounded px-2 py-1 text-center"
                            style={{ minWidth: 70 }}
                          >
                            <div className="text-white small fw-semibold">{o.label}</div>
                            <div className="text-white fw-bold">{o.temp}°</div>
                            <div className="text-white-50" style={{ fontSize: "0.7rem" }}>
                              {o.condition}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-white-50">Loading weather…</div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={6} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="text-white fw-bold mb-3">Quick Actions</div>
                <div className="d-flex flex-wrap gap-2">
                  <OverlayTrigger placement="top" overlay={renderTooltip("Coming soon")}>
                    <span className="d-inline-block">
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        disabled
                      >
                        Acknowledge All Alarms
                      </Button>
                    </span>
                  </OverlayTrigger>

                  <OverlayTrigger placement="top" overlay={renderTooltip("Coming soon")}>
                    <span className="d-inline-block">
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        disabled
                      >
                        Export Alarms Log
                      </Button>
                    </span>
                  </OverlayTrigger>

                  <OverlayTrigger placement="top" overlay={renderTooltip("Coming soon")}>
                    <span className="d-inline-block">
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        disabled
                      >
                        View Trends
                      </Button>
                    </span>
                  </OverlayTrigger>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-3">
          {/* B) What Changed Recently */}
          <Col xs={12} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="text-white fw-bold">What Changed Recently</div>
                </div>

                <div className="border border-light border-opacity-10 rounded overflow-hidden">
                  <Table responsive size="sm" className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                    <thead>
                      <tr>
                        <th className="text-white small" style={{ width: 90 }}>
                          Time
                        </th>
                        <th className="text-white small" style={{ width: 110 }}>
                          Type
                        </th>
                        <th className="text-white small">Equipment</th>
                        <th className="text-white small">Message</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentEvents.map((e) => (
                        <tr key={e.id}>
                          <td className="text-white fw-semibold small">{e.time}</td>

                          {/* TYPE = plain text (not a chip) */}
                          <td className="text-white fw-semibold small">
                            {String(e.type ?? "").toUpperCase()}
                          </td>

                          <td className="text-white fw-semibold small">
                            {e.equipment}
                          </td>
                          <td className="text-white small">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* C) Mini Alarms + D) Equipment Health */}
          <Col xs={12} lg={8}>
            <Row className="g-3">
              <Col xs={12}>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <div className="text-white fw-bold">Alarms</div>

                      <div className="d-flex align-items-center gap-2">
                        <ButtonGroup size="sm">
                          <Button
                            variant={alarmFilter === "All" ? "light" : "outline-light"}
                            className="border-opacity-10"
                            onClick={() => setAlarmFilter("All")}
                          >
                            All
                          </Button>
                          <Button
                            variant={alarmFilter === "Unacked" ? "light" : "outline-light"}
                            className="border-opacity-10"
                            onClick={() => setAlarmFilter("Unacked")}
                          >
                            Unacked
                          </Button>
                          <Button
                            variant={alarmFilter === "Critical" ? "light" : "outline-light"}
                            className="border-opacity-10"
                            onClick={() => setAlarmFilter("Critical")}
                          >
                            Critical
                          </Button>
                        </ButtonGroup>

                        <Link to={Routes.LegionAlarms.path}>
                          <Button size="sm" variant="outline-light" className="border-opacity-10">
                            View All Alarms
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="border border-light border-opacity-10 rounded overflow-hidden">
                      <Table responsive size="sm" hover className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                        <thead>
                          <tr>
                            <th className="text-white small">Time</th>
                            <th className="text-white small">Severity</th>
                            <th className="text-white small">Equipment</th>
                            <th className="text-white small">Message</th>
                            <th className="text-white small">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {displayAlarms.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center text-white py-3">
                                No alarms match.
                              </td>
                            </tr>
                          ) : (
                            displayAlarms.map((a) => (
                              <tr key={a.id}>
                                <td className="text-white fw-semibold small">{a.time}</td>
                                <td><StatusDotLabel value={a.severity} kind="severity" /></td>
                                <td className="text-white fw-semibold small">{a.equipment}</td>
                                <td className="text-white small">{a.message}</td>
                                <td><StatusDotLabel acked={a.ack} /></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              <Col xs={12}>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <div className="text-white fw-bold">Equipment Health</div>
                      <Link to={Routes.LegionEquipment.path}>
                        <Button size="sm" variant="outline-light" className="border-opacity-10">
                          View Equipment
                        </Button>
                      </Link>
                    </div>

                    <div className="border border-light border-opacity-10 rounded overflow-hidden">
                      <Table responsive size="sm" hover className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                        <thead>
                          <tr>
                            <th className="text-white small">Equipment</th>
                            <th className="text-white small">Status</th>
                            <th className="text-white small">Comm</th>
                            <th className="text-white small">Last Update</th>
                          </tr>
                        </thead>

                        <tbody>
                          {equipmentHealth.map((eq) => (
                            <tr key={eq.id}>
                              <td className="text-white fw-semibold">{eq.name}</td>
                              <td><StatusDotLabel value={eq.status} kind="status" /></td>
                              <td><StatusDotLabel value={eq.comm} kind="status" /></td>
                              <td className="text-white fw-semibold small">{eq.lastUpdate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>


      </div>
    </Container>
  );
}