import React, { useMemo } from "react";
import { useParams, useHistory } from "react-router-dom";
import { useSite } from "../../../app/providers/SiteProvider";
import { useActiveDeployment } from "../../../hooks/useEngineeringDraft";
import { getEquipmentFromDeployment, getWorkspaceRowsFromDeployment } from "../../../lib/activeDeploymentUtils";
import { Container, Row, Col, Card, Button } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import { Routes } from "../../../routes";
import VavGraphicImg from "../../../assets/graphics/mysvgvav.svg";
import DeployedGraphicPreview from "./DeployedGraphicPreview";

/**
 * Build network details rows from equipment and deployment (no static data).
 */
function buildNetworkDetails(equipment, siteName) {
  if (!equipment) return [];
  const rows = [];
  rows.push({ key: "Equipment", value: (equipment.displayLabel || equipment.name || "—") + (equipment.locationLabel ? " (" + equipment.locationLabel + ")" : "") });
  rows.push({ key: "Instance Number", value: equipment.instanceNumber || "—" });
  rows.push({ key: "Device Type", value: equipment.type ? equipment.type + (equipment.protocol ? " (" + equipment.protocol + ")" : "") : "—" });
  rows.push({ key: "Controller", value: equipment.controllerRef ? (equipment.protocol || "BACnet/IP") + ": " + equipment.controllerRef : "Unassigned" });
  rows.push({ key: "Template", value: equipment.templateName || "—" });
  rows.push({ key: "Location", value: equipment.locationLabel || "—" });
  rows.push({ key: "Status", value: equipment.status || "—" });
  if (siteName) rows.push({ key: "Site", value: siteName });
  return rows;
}

export default function EquipmentDetailPage() {
  const { equipmentId } = useParams();
  const history = useHistory();
  const { site } = useSite();
  const activeDeployment = useActiveDeployment();

  const equipment = useMemo(
    () => (activeDeployment && equipmentId ? getEquipmentFromDeployment(activeDeployment, equipmentId) : null),
    [activeDeployment, equipmentId]
  );

  const points = useMemo(() => {
    if (!activeDeployment || !equipment) return [];
    return getWorkspaceRowsFromDeployment(
      activeDeployment,
      equipment.id,
      equipment.displayLabel || equipment.name
    );
  }, [activeDeployment, equipment]);

  const networkDetails = useMemo(
    () => buildNetworkDetails(equipment, activeDeployment?.site?.name),
    [equipment, activeDeployment?.site?.name]
  );

  const graphic = useMemo(() => {
    if (!activeDeployment?.graphics || !equipment) return null;
    return activeDeployment.graphics[equipment.id] || null;
  }, [activeDeployment?.graphics, equipment]);

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type || !linkTarget?.id) return;
    if (linkTarget.type === "equipment") {
      const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(linkTarget.id));
      history.push(path);
    } else if (linkTarget.type === "layout") {
      history.push(Routes.LegionSite.path, { selectLayoutLevelId: linkTarget.id });
    }
  };

  if (!equipment) {
    return (
      <Container fluid className="px-0 app-scale">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <h5 className="text-white fw-bold mb-3">Equipment Detail</h5>
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="text-center text-white-50 py-5">
              <p className="mb-2">Equipment not found.</p>
              <p className="small mb-0">It may not be deployed for this site or the reference may be invalid.</p>
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--secondary mt-3"
                onClick={() => history.push(Routes.LegionEquipment.path)}
              >
                Back to Equipment
              </Button>
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  const displayName = equipment.displayLabel || equipment.name || "Equipment";
  const instanceDisplay = equipment.instanceNumber || equipment.id;

  return (
    <Container fluid className="px-0 app-scale">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <h5 className="text-white fw-bold mb-3">Equipment Detail</h5>
        <Row className="g-3 text-white">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                  <Card.Body>
                    <div className="text-white fw-bold">{displayName}</div>
                    <span className="text-white">Instance: {instanceDisplay}</span>
                    <div className="my-3">
                      <div className="text-white-50 small mb-2">Equipment graphic</div>
                      <div
                        className="d-flex justify-content-center"
                        style={{ overflowX: "auto", overflowY: "visible", width: "100%" }}
                      >
                        <div style={{ width: 800, flexShrink: 0 }}>
                          {graphic?.objects?.length > 0 ? (
                            <DeployedGraphicPreview
                              graphic={graphic}
                              points={points}
                              onLinkClick={handleGraphicLinkClick}
                            />
                          ) : (
                            <div
                              className="d-flex align-items-center justify-content-center bg-transparent"
                              style={{ width: 800, height: 500 }}
                            >
                              <img src={VavGraphicImg} alt={displayName} className="w-40 mb-0" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                  <Card.Body>
                    <Row className="g-3">
                      <Col xs={12} lg={8}>
                        <Card className="shadow-sm">
                          <Card.Body>
                            <div className="text-white fw-bold mb-3">Live Points</div>
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
                                  {points.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="text-white-50 text-center py-4">
                                        No points defined. Add a template in Engineering and deploy.
                                      </td>
                                    </tr>
                                  ) : (
                                    points.map((p, index) => (
                                      <tr key={p.id || index}>
                                        <td>
                                          <div className="point-cell">
                                            <span className="point-index">
                                              {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="point-name">{p.pointName}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <div className="current-cell">
                                            <span
                                              className={`mini-dot ${p.status === "Unbound" ? "warn" : ""}`}
                                            />
                                            <span>{p.value}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <StatusDotLabel
                                            value={p.status === "OK" ? "online" : p.status === "Unbound" ? "unbound" : "offline"}
                                            kind="status"
                                          />
                                        </td>
                                        <td className="text-muted" style={{ opacity: 0.85 }}>
                                          —
                                        </td>
                                        <td className="text-muted text-end" style={{ opacity: 0.85 }}>
                                          {equipment.instanceNumber || equipment.displayLabel || equipment.name || "—"}/{p.pointReferenceId ?? p.pointId}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col xs={12} lg={4}>
                        <Card className="shadow-sm">
                          <Card.Body>
                            <div className="text-white fw-bold mb-3">Network Details</div>
                            <div className="table-responsive">
                              <table className="table bas-points-table bas-details-table align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th className="col-key" scope="col">Field</th>
                                    <th className="col-val" scope="col">Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {networkDetails.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="detail-key">{row.key}</td>
                                      <td className="detail-val">{row.value}</td>
                                    </tr>
                                  ))}
                                  {networkDetails.length === 0 && (
                                    <tr>
                                      <td colSpan={2} className="text-white-50 text-center py-3">
                                        No network details.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}
