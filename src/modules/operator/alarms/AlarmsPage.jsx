import React, { useMemo, useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
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
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import { useTablePagination } from "../../../hooks/useTablePagination";
import { operatorRepository } from "../../../lib/data";

export default function AlarmsPage() {
  const { site } = useSite(); // consume context for global site sync

  // Filters (MVP-friendly)
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All"); // All | Critical | Warning | Minor
  const [state, setState] = useState("Active"); // Active | History | All
  const [ack, setAck] = useState("All"); // All | Acked | Unacked

  // Canonical alarm list via repository (currently mock-backed)
  const alarms = useMemo(() => operatorRepository.getAlarms(site), [site]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return alarms.filter((a) => {
      const matchesSearch =
        !q ||
        a.equipmentName.toLowerCase().includes(q) ||
        a.equipmentType.toLowerCase().includes(q) ||
        a.point.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q);

      const matchesSeverity = severity === "All" || a.severity === severity || (severity === "Warning" && a.severity === "Major");
      const matchesState = state === "All" || a.state === state;

      const matchesAck =
        ack === "All" ||
        (ack === "Acked" && a.ack === true) ||
        (ack === "Unacked" && a.ack === false);

      return matchesSearch && matchesSeverity && matchesState && matchesAck;
    });
  }, [alarms, search, severity, state, ack]);

  const {
    page,
    setPage,
    pagedRows,
    total,
    totalPages,
    startIndex,
    endIndex,
    pageSize,
    hasPrev,
    hasNext,
  } = useTablePagination(filtered, 20, search, severity, state, ack);

  const counts = useMemo(() => {
    const active = alarms.filter((a) => a.state === "Active").length;
    const unackedActive = alarms.filter((a) => a.state === "Active" && !a.ack).length;
    const criticalActive = alarms.filter(
      (a) => a.state === "Active" && a.severity === "Critical"
    ).length;
    return { active, unackedActive, criticalActive };
  }, [alarms]);


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
            <h5 className="text-white fw-bold mb-1">Alarms</h5>
            <div className="text-white small">
              Active + historical alarm log for all equipment in this site.
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary border border-light border-opacity-25 text-white">
              Active: {counts.active}
            </span>
            <span className="badge bg-primary border border-light border-opacity-25 text-white">
              Unacked: {counts.unackedActive}
            </span>
            <span className="badge bg-primary border border-light border-opacity-25 text-white">
              Critical: {counts.criticalActive}
            </span>
          </div>
        </div>

        <Row className="g-3">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                {/* Filters */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="text-white fw-semibold">Alarm Log</div>
                  <div className="text-white fw-semibold">
                    Showing {total === 0 ? "0" : `${startIndex + 1}–${endIndex}`} of {total}
                  </div>
                </div>

                <Row className="g-2 align-items-end mb-3">
                  <Col xs={12} md={6} lg={5}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Search
                    </Form.Label>
                    <Form.Control
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search equipment, point, message, ID…"
                      className="bg-primary text-white border border-light border-opacity-10"
                    />
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      State
                    </Form.Label>
                    <Form.Select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="bg-primary text-white border border-light border-opacity-10"
                    >
                      <option>Active</option>
                      <option>History</option>
                      <option>All</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Severity
                    </Form.Label>
                    <Form.Select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="bg-primary text-white border border-light border-opacity-10"
                    >
                      <option>All</option>
                      <option>Critical</option>
                      <option>Warning</option>
                      <option>Minor</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={2} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Ack
                    </Form.Label>
                    <Form.Select
                      value={ack}
                      onChange={(e) => setAck(e.target.value)}
                      className="bg-primary text-white border border-light border-opacity-10"
                    >
                      <option>All</option>
                      <option>Acked</option>
                      <option>Unacked</option>
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={4} lg={1} className="d-flex justify-content-end">
                    <Button
                      variant="outline-light"
                      size="sm"
                      className="border-opacity-10 w-100"
                      onClick={() => {
                        setSearch("");
                        setSeverity("All");
                        setState("Active");
                        setAck("All");
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
                      <tr className="text-white">
                        <th style={{ width: 220 }} className="text-white" >Equipment</th>
                        <th style={{ width: 260 }} className="text-white">Alarm / Point</th>
                        <th className="text-white">Message</th>
                        <th style={{ width: 140 }} className="text-white">Severity</th>
                        <th style={{ width: 130 }} className="text-white">State</th>
                        <th style={{ width: 140 }} className="text-white">Ack</th>
                        <th style={{ width: 190 }} className="text-white">Occurred</th>
                        <th style={{ width: 190 }} className="text-white">Cleared</th>
                        <th style={{ width: 160 }} className="text-end text-white">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-white py-4">
                            No alarms match your filters.
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <div className="fw-bold text-white">{a.equipmentName}</div>
                              <div className="text-white">{a.equipmentType}</div>
                            </td>

                            <td>
                              <div className="fw-bold text-white">{a.point}</div>
                              <div className="text-white">{a.value}</div>
                            </td>

                            <td className="text-white fw-semibold">{a.message}</td>

                            <td>
                              <StatusDotLabel value={a.severity} kind="severity" />
                            </td>

                            <td>
                              <StatusDotLabel value={a.state} kind="alarmState" />
                            </td>

                            <td>
                              <StatusDotLabel acked={a.ack} />
                            </td>

                            <td className="text-white fw-semibold">{a.occurredAt}</td>

                            <td className="text-white fw-semibold">
                              {a.clearedAt ? (
                                <>
                                  {a.clearedAt}
                                  {typeof a.durationMin === "number" ? (
                                    <span className="text-white"> • {a.durationMin}m</span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-white">—</span>
                              )}
                            </td>

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
                                  disabled={a.ack}
                                  onClick={() => {}}
                                >
                                  Ack
                                </Button>
                              </ButtonGroup>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                <LegionTablePagination
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  total={total}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  pageSize={pageSize}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />

                {/* Footer hint */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                  <div className="text-white small fw-semibold">
                    Tip: keep “State = Active” for day-to-day, switch to “History” for
                    troubleshooting.
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
