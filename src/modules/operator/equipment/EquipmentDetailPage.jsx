import React from "react";
import { useSite } from "../../../components/SiteContext";
import { Container, Row, Col, Card } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { Accordion } from "@themesberg/react-bootstrap";
import { useParams } from "react-router-dom";
import VavGraphicImg from "../../../assets/graphics/mysvgvav.svg";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";

export default function EquipmentDetailPage() {
  const { equipmentId } = useParams();
  useSite(); // consume context for global site sync

  // Example data
const points = [
{ id: 1, name: "SA-T", value: "55.8°F", status: "online", description: "Supply Air Temperature", address: "Supervisory-01/VAV-2.SA-T" },
{ id: 2, name: "DA-T", value: "68.2°F", status: "online", description: "Discharge Air Temperature", address: "Supervisory-01/VAV-2.DA-T" },
{ id: 3, name: "RA-T", value: "71.4°F", status: "online", description: "Zone / Return Air Temperature", address: "Supervisory-01/VAV-2.RA-T" },
{ id: 4, name: "Airflow", value: "420 CFM", status: "online", description: "Measured Airflow", address: "Supervisory-01/VAV-2.AIRFLOW" },
{ id: 5, name: "Flow-SP", value: "450 CFM", status: "online", description: "Airflow Setpoint", address: "Supervisory-01/VAV-2.FLOW-SP" },
{ id: 6, name: "Damper Pos", value: "62%", status: "online", description: "VAV Damper Position", address: "Supervisory-01/VAV-2.DAMPER-POS" },
{ id: 7, name: "Heat Cmd", value: "35%", status: "online", description: "Reheat Valve Command", address: "Supervisory-01/VAV-2.HEAT-CMD" },
{ id: 8, name: "Heat Status", value: "ON", status: "online", description: "Reheat Enable Status", address: "Supervisory-01/VAV-2.HEAT-STS" },
{ id: 9, name: "Occ Cmd", value: "Occupied", status: "online", description: "Occupancy Command", address: "Supervisory-01/VAV-2.OCC-CMD" },
{ id: 10, name: "Occ Sensor", value: "Motion", status: "online", description: "Occupancy Sensor Status", address: "Supervisory-01/VAV-2.OCC-SNS" },
{ id: 11, name: "Low Flow Alm", value: "Normal", status: "alarm", description: "Low Airflow Alarm", address: "Supervisory-01/VAV-2.LOWFLOW-ALM" },
{ id: 12, name: "Comm Status", value: "Online", status: "online", description: "Controller Communication Status", address: "Supervisory-01/VAV-2.COMM-STS" },
{ id: 13, name: "Ctrl Mode", value: "Auto", status: "offline", description: "VAV Control Mode", address: "Supervisory-01/VAV-2.CTRL-MODE" },
];


  return (
    <Container fluid className="px-0 app-scale">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <h5 className="text-white fw-bold mb-3">Equipment Detail</h5>
        <Row className="g-3 text-white">
            {/* Full width section */}
            <Col xs={12}>
              <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                <Card.Body>
                  <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                    <Card.Body>
                      <div className="text-white fw-bold">VAV-2</div>
                      <span className="text-white">Instance: {equipmentId}</span>
                      <div className="text-white fw-bold">Address: 5</div>
                      <div className="d-flex justify-content-center">
                        <img src={VavGraphicImg} alt="VAV" className="w-40 mb-3" />
                      </div>
                    </Card.Body>
                    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                      <Card.Body>
                        <Row className="g-3">
                          {/* Left column */}
                          <Col xs={12} lg={8}>
                            <Card className="shadow-sm">
                              <Card.Body>
                                <div className="text-white fw-bold mb-3">Live Points</div>
                                {/* TABLE (React-Bootstrap/Bootstrap table) */}
                                <div className="table-responsive">
                                <table className="table bas-points-table align-middle mb-0">
                                <thead>
                                    <tr>
                                    <th className="col-point" scope="col"># Point Name</th>
                                    <th className="col-current" scope="col">Current Value</th>
                                    <th className="col-current" scope="col">Status</th>
                                    <th className="col-current" scope="col">Description</th>
                                    <th className="col-value text-end" scope="col">Address</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {points.map((p, index) => (
                                    <tr key={p.id ?? index}>
                                        {/* Point Name */}
                                        <td>
                                          <div className="point-cell">
                                            <span className="point-index">
                                              {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="point-name">{p.name}</span>
                                          </div>
                                        </td>

                                        {/* Current Value */}
                                        <td>
                                        <div className="current-cell">
                                            <span className={`mini-dot ${p.status === "alarm" ? "warn" : ""}`} />
                                            <span>{p.value}</span>
                                        </div>
                                        </td>

                                        {/* Status */}
                                        <td>
                                          <StatusDotLabel value={p.status} kind="status" />
                                        </td>

                                        {/* Description */}
                                        <td className="text-muted" style={{ opacity: 0.85 }}>
                                        {p.description ?? "-"}
                                        </td>

                                        {/* Address */}
                                        <td className="text-muted text-end" style={{ opacity: 0.85 }}>
                                        {p.address ?? "-"}
                                        </td>
                                    </tr>
                                    ))}
                                </tbody>
                                </table>
                                </div>

                              </Card.Body>
                            </Card>
                          </Col>
                          {/* Right column */}
                          <Col xs={12} lg={4}>
                            <Card className="shadow-sm">
                              <Card.Body>
                                <div className="text-white fw-bold mb-3">Network Details</div>
                                                                {/* TABLE (React-Bootstrap/Bootstrap table) */}
                                {/* NETWORK / DEVICE DETAILS (no icons, no numbers) */}
                                <div className="table-responsive">
                                <table className="table bas-points-table bas-details-table align-middle mb-0">
                                <thead>
                                    <tr>
                                    <th className="col-key" scope="col">Field</th>
                                    <th className="col-val" scope="col">Value</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr><td className="detail-key">Equipment</td><td className="detail-val">VAV-2 (Zone: Conf Room East)</td></tr>
                                    <tr><td className="detail-key">Device Type</td><td className="detail-val">VAV Controller (BACnet MS/TP)</td></tr>
                                    <tr><td className="detail-key">Instance Name</td><td className="detail-val">VAV-2</td></tr>
                                    <tr><td className="detail-key">Device Instance</td><td className="detail-val">12002</td></tr>
                                    <tr><td className="detail-key">MAC Address</td><td className="detail-val">22</td></tr>
                                    <tr><td className="detail-key">Network</td><td className="detail-val">MS/TP Trunk 1</td></tr>
                                    <tr><td className="detail-key">Baud Rate</td><td className="detail-val">38400</td></tr>
                                    <tr><td className="detail-key">Supervisory</td><td className="detail-val">Supervisory-01 (IP: 10.20.1.50)</td></tr>
                                    <tr><td className="detail-key">BACnet Network #</td><td className="detail-val">2001</td></tr>
                                    <tr><td className="detail-key">Location</td><td className="detail-val">Floor 02 • East Wing</td></tr>

                                    <tr><td className="detail-key">Units</td><td className="detail-val">Temp: °F • Flow: CFM • Pressure: in.WC</td></tr>
                                    <tr><td className="detail-key">Decimals</td><td className="detail-val">Temp: 1 • Flow: 0 • Pressure: 2</td></tr>
                                    <tr><td className="detail-key">Sample / Poll Rate</td><td className="detail-val">2s (UI) • 10s (Trend)</td></tr>
                                    <tr><td className="detail-key">Trend Interval</td><td className="detail-val">5 min</td></tr>
                                    <tr><td className="detail-key">Alarm Delay</td><td className="detail-val">60 sec</td></tr>

                                    <tr><td className="detail-key">Flow Min / Max</td><td className="detail-val">250 / 1200 CFM</td></tr>
                                    <tr><td className="detail-key">Heat Type</td><td className="detail-val">Hot Water Reheat</td></tr>
                                    <tr><td className="detail-key">Reheat Valve</td><td className="detail-val">0–10 VDC • Normally Closed</td></tr>
                                    <tr><td className="detail-key">Damper Fail Pos</td><td className="detail-val">Closed</td></tr>
                                    <tr><td className="detail-key">Control Mode</td><td className="detail-val">Auto</td></tr>
                                    <tr><td className="detail-key">Last Seen</td><td className="detail-val">Online • 12s ago</td></tr>
                                </tbody>
                                </table>
                                </div>

                              </Card.Body>
                            </Card>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Card>
                </Card.Body>
              </Card>
            </Col>
        </Row>
      </div>
    </Container>
  );
}
