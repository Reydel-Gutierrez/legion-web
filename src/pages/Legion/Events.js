import React, { useMemo, useState } from "react";
import { useSite } from "../../components/SiteContext";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Form,
  Button,
  ButtonGroup,
} from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../components/legion/StatusDotLabel";

export default function Events() {
  const { site } = useSite();

  // Filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All"); // All | Command | Schedule | Device | Comm | User | System
  const [state, setState] = useState("All"); // All | New | Reviewed
  const [range, setRange] = useState("24H"); // 24H | 7D | 14D

  // Mock data (replace with API later)
  const events = useMemo(
    () => [
      {
        id: "EVT-20031",
        type: "Command",
        equipName: "VAV-2",
        equipType: "VAV",
        point: "Damper Cmd",
        message: "Command issued: Damper Cmd = 65%",
        actor: "Operator",
        state: "New",
        occurredAt: "2/22/26 14:10",
        severity: "Info",
      },
      {
        id: "EVT-20027",
        type: "Comm",
        equipName: "AHU-1",
        equipType: "AHU",
        point: "Device Status",
        message: "Device went OFFLINE (no response)",
        actor: "Engine",
        state: "New",
        occurredAt: "2/22/26 13:42",
        severity: "Warn",
      },
      {
        id: "EVT-20021",
        type: "Device",
        equipName: "OAU-1",
        equipType: "OAU",
        point: "Filter DP",
        message: "Point discovered and added to database",
        actor: "Engineering",
        state: "Reviewed",
        occurredAt: "2/22/26 11:08",
        severity: "Info",
      },
      {
        id: "EVT-20015",
        type: "User",
        equipName: "Site",
        equipType: "Miami HQ",
        point: "Login",
        message: "User logged in",
        actor: "reydel",
        state: "Reviewed",
        occurredAt: "2/22/26 08:01",
        severity: "Info",
      },
      {
        id: "EVT-20002",
        type: "System",
        equipName: "Engine-01",
        equipType: "Supervisor",
        point: "Service",
        message: "Engine restarted successfully",
        actor: "System",
        state: "Reviewed",
        occurredAt: "2/21/26 22:17",
        severity: "Info",
      },
      {
        id: "EVT-19991",
        type: "Schedule",
        equipName: "AHU-1",
        equipType: "AHU",
        point: "Occ Mode",
        message: "Schedule action: Occupied Mode = ON",
        actor: "Scheduler",
        state: "Reviewed",
        occurredAt: "2/21/26 06:00",
        severity: "Info",
      },
      {
        id: "EVT-19972",
        type: "Comm",
        equipName: "CHW-P-1",
        equipType: "Pump",
        point: "Device Status",
        message: "Device back ONLINE (response restored)",
        actor: "Engine",
        state: "Reviewed",
        occurredAt: "2/20/26 19:33",
        severity: "Info",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((e) => {
      const matchesSearch =
        !q ||
        e.id.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.equipName.toLowerCase().includes(q) ||
        e.equipType.toLowerCase().includes(q) ||
        e.point.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q);

      const matchesType = type === "All" || e.type === type;
      const matchesState = state === "All" || e.state === state;

      // Range filter (mock-friendly):
      // Since this is mock data, we’ll keep it simple and not parse dates.
      // Later, server will return already-filtered results.
      const matchesRange = ["24H", "7D", "14D"].includes(range);

      return matchesSearch && matchesType && matchesState && matchesRange;
    });
  }, [events, search, type, state, range]);

  const counts = useMemo(() => {
    const total = events.length;
    const newCount = events.filter((e) => e.state === "New").length;
    const comm = events.filter((e) => e.type === "Comm").length;
    return { total, newCount, comm };
  }, [events]);


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
            <h5 className="text-white fw-bold mb-1">Events</h5>
            <div className="text-white small">
              Audit trail for commands, schedules, device changes, comm status, and system activity.
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Total: {counts.total}
            </span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              New: {counts.newCount}
            </span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Comm: {counts.comm}
            </span>
          </div>
        </div>

        <Row className="g-3">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                {/* Filters */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="text-white fw-semibold">Event Log</div>
                  <div className="text-white fw-semibold">{filtered.length} records</div>
                </div>

                <Row className="g-2 align-items-end mb-3">
                  <Col xs={12} md={6} lg={5}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Search
                    </Form.Label>
                    <Form.Control
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search equipment, point, message, ID, user…"
                      className="bg-dark text-white border border-light border-opacity-10"
                    />
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Type
                    </Form.Label>
                    <Form.Select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>All</option>
                      <option>Command</option>
                      <option>Schedule</option>
                      <option>Device</option>
                      <option>Comm</option>
                      <option>User</option>
                      <option>System</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      State
                    </Form.Label>
                    <Form.Select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>All</option>
                      <option>New</option>
                      <option>Reviewed</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Range
                    </Form.Label>
                    <Form.Select
                      value={range}
                      onChange={(e) => setRange(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>24H</option>
                      <option>7D</option>
                      <option>14D</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={4} lg={1} className="d-flex justify-content-end">
                    <Button
                      variant="outline-light"
                      size="sm"
                      className="border-opacity-10 w-100"
                      onClick={() => {
                        setSearch("");
                        setType("All");
                        setState("All");
                        setRange("24H");
                      }}
                    >
                      Reset
                    </Button>
                  </Col>
                </Row>

                {/* Table */}
                <div className="border border-light border-opacity-10 rounded overflow-hidden">
                  <Table responsive hover className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                    <thead>
                      <tr className="text-white fw-semibold">
                        <th style={{ width: 160 }} className="text-white">Time</th>
                        <th style={{ width: 150 }} className="text-white">Type</th>
                        <th style={{ width: 220 }} className="text-white">Equipment</th>
                        <th style={{ width: 240 }} className="text-white">
                          Point
                        </th>
                        <th className="text-white">Message</th>
                        <th style={{ width: 160 }} className="text-white">
                          Actor
                        </th>
                        <th style={{ width: 140 }} className="text-white">
                          Severity
                        </th>
                        <th style={{ width: 140 }} className="text-white">
                          State
                        </th>
                        <th style={{ width: 160 }} className="text-end text-white">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-white py-4">
                            No events match your filters.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((e) => (
                          <tr key={e.id}>
                            <td className="text-white fw-semibold">{e.occurredAt}</td>

                            <td className="text-white fw-semibold">{e.type}</td>

                            <td>
                              <div className="fw-bold text-white">{e.equipName}</div>
                              <div className="text-white">{e.equipType}</div>
                            </td>

                            <td>
                              <div className="fw-bold text-white">{e.point}</div>
                              <div className="text-white">{e.id}</div>
                            </td>

                            <td className="text-white fw-semibold">{e.message}</td>

                            <td className="text-white fw-semibold">{e.actor}</td>

                            <td>
                              <StatusDotLabel value={e.severity} kind="severity" />
                            </td>

                            <td className="text-white fw-semibold">{e.state}</td>

                            <td className="text-end">
                              <ButtonGroup>
                                <Button
                                  size="sm"
                                  variant="outline-light"
                                  className="border-opacity-10"
                                  onClick={() => {}}
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-light"
                                  className="border-opacity-10"
                                  onClick={() => {}}
                                >
                                  Review
                                </Button>
                              </ButtonGroup>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                {/* Footer hint */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                  <div className="text-white small fw-semibold">
                    Tip: Events are your audit trail—use it to trace commands, comm drops, and device changes.
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
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}