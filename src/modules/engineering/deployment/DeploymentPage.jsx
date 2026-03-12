import React, { useState, useCallback, useMemo } from "react";
import { useHistory } from "react-router-dom";
import {
  Container,
  Card,
  Button,
  Row,
  Col,
  Table,
  Badge,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRocket,
  faExclamationTriangle,
  faCheckCircle,
  faListAlt,
} from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import DeployAnywayModal from "../validation-center/components/DeployAnywayModal";
import { useValidation } from "../../../app/providers/ValidationProvider";
import { useEngineeringDraft } from "../../../hooks/useEngineeringDraft";
import { Routes } from "../../../routes";
import { engineeringRepository, deploymentRepository } from "../../../lib/data";

export default function DeploymentPage() {
  const history = useHistory();
  const { validationSnapshot } = useValidation();
  const { draft, actions } = useEngineeringDraft();
  const { summary } = validationSnapshot;
  const errors = summary?.errors ?? 0;
  const warnings = summary?.warnings ?? 0;
  const readiness = validationSnapshot.readiness;

  const currentDeployment = draft.activeDeploymentSnapshot ?? {
    version: "v0",
    lastDeployedAt: null,
    deployedBy: null,
    systemStatus: "Unknown",
  };
  const historyList = draft.deploymentHistory ?? [];
  const pendingChanges = useMemo(() => {
    const eqCount = (draft.equipment || []).length;
    const mappingCount = Object.values(draft.mappings || {}).reduce((acc, m) => acc + Object.keys(m || {}).length, 0);
    const gfxCount = Object.keys(draft.graphics || {}).length;
    const templateCount = (draft.templates?.equipmentTemplates?.length || 0) + (draft.templates?.graphicTemplates?.length || 0);
    return { equipment: eqCount, pointMappings: mappingCount, graphics: gfxCount, templates: templateCount };
  }, [draft.equipment, draft.mappings, draft.graphics, draft.templates]);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const hasPending = deploymentRepository.hasPendingChanges(pendingChanges);
  const readinessLabel =
    readiness === engineeringRepository.READINESS_STATUS.READY
      ? "Ready"
      : readiness === engineeringRepository.READINESS_STATUS.BLOCKED
      ? "Deployment Blocked"
      : readiness === engineeringRepository.READINESS_STATUS.WARNINGS
      ? "Ready with Warnings"
      : "—";
  const readinessVariant =
    readiness === engineeringRepository.READINESS_STATUS.READY
      ? "success"
      : readiness === engineeringRepository.READINESS_STATUS.BLOCKED
      ? "danger"
      : readiness === engineeringRepository.READINESS_STATUS.WARNINGS
      ? "warning"
      : "secondary";

  const handleDeployConfiguration = useCallback(() => {
    if (errors > 0) return;
    setToastMessage("Deployment successful.");
    setTimeout(() => setToastMessage(null), 3000);
    actions.deployDraftConfiguration();
  }, [errors, actions]);

  const handleDeployAnyway = useCallback(() => {
    if (errors > 0) {
      setShowOverrideModal(true);
      return;
    }
    handleDeployConfiguration();
  }, [errors, handleDeployConfiguration]);

  const handleConfirmOverride = useCallback(
    (reason) => {
      setShowOverrideModal(false);
      setToastMessage("Deployment successful.");
      setTimeout(() => setToastMessage(null), 3000);
      actions.deployDraftConfiguration({ notes: reason || "Override deployment" });
    },
    [actions]
  );

  const formatDate = (isoDate) => {
    if (!isoDate) return "—";
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (isoDate) => {
    if (!isoDate) return "—";
    const d = new Date(isoDate);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faRocket} className="me-2" />
            Deployment
          </h5>
          <div className="text-white-50 small">
            Execute deployments and view deployment history.
          </div>
        </div>

        {/* Section 1 — Current Deployment Status */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Current Deployment
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Version</div>
                <div className="text-white fw-bold">{currentDeployment.version}</div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Last Deployed</div>
                <div className="text-white">
                  {formatDate(currentDeployment.lastDeployedAt)} {formatTime(currentDeployment.lastDeployedAt)}
                </div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Deployed By</div>
                <div className="text-white">{currentDeployment.deployedBy}</div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">System Status</div>
                <div className="text-success">{currentDeployment.systemStatus}</div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Section 2 — Pending Draft Changes */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Draft Changes Pending
          </Card.Header>
          <Card.Body>
            {hasPending ? (
              <Row className="g-2">
                <Col xs={6} sm={3}>
                  <div className="border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25">
                    <div className="text-white-50 small">Equipment</div>
                    <div className="text-white fw-bold">{pendingChanges.equipment}</div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25">
                    <div className="text-white-50 small">Point Mappings</div>
                    <div className="text-white fw-bold">{pendingChanges.pointMappings}</div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25">
                    <div className="text-white-50 small">Graphics</div>
                    <div className="text-white fw-bold">{pendingChanges.graphics}</div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25">
                    <div className="text-white-50 small">Templates</div>
                    <div className="text-white fw-bold">{pendingChanges.templates}</div>
                  </div>
                </Col>
              </Row>
            ) : (
              <p className="text-white-50 mb-0">No configuration changes since last deployment.</p>
            )}
          </Card.Body>
        </Card>

        {/* Section 3 — Deployment Readiness */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold">Deployment Readiness</span>
            {readiness === engineeringRepository.READINESS_STATUS.BLOCKED && (
              <Badge bg="danger">Deployment Blocked</Badge>
            )}
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap align-items-center gap-4 mb-3">
              <span className="text-white-50">Errors: <span className={errors > 0 ? "text-danger fw-bold" : "text-white"}>{errors}</span></span>
              <span className="text-white-50">Warnings: <span className={warnings > 0 ? "text-warning fw-bold" : "text-white"}>{warnings}</span></span>
              <span className={`badge bg-${readinessVariant}`}>{readinessLabel}</span>
            </div>
            <Button
              size="sm"
              variant="outline-light"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={() => history.push(Routes.EngineeringValidationCenter.path)}
            >
              <FontAwesomeIcon icon={faListAlt} className="me-1" /> View Validation Issues
            </Button>
          </Card.Body>
        </Card>

        {/* Section 4 — Deployment Actions */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Deployment Actions
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-2">
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                disabled={errors > 0}
                onClick={handleDeployConfiguration}
              >
                <FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Deploy Configuration
              </Button>
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--secondary"
                onClick={handleDeployAnyway}
              >
                <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" /> Deploy Anyway
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Section 5 — Deployment History */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Deployment History
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive className="table-dark mb-0">
              <thead className="thead-dark">
                <tr>
                  <th className="border-light border-opacity-10 text-white-50">Version</th>
                  <th className="border-light border-opacity-10 text-white-50">Date</th>
                  <th className="border-light border-opacity-10 text-white-50">User</th>
                  <th className="border-light border-opacity-10 text-white-50">Result</th>
                  <th className="border-light border-opacity-10 text-white-50">Notes</th>
                  <th className="border-light border-opacity-10 text-white-50">Rollback</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((row, idx) => (
                  <tr key={`${row.version}-${idx}`}>
                    <td className="border-light border-opacity-10 text-white">{row.version}</td>
                    <td className="border-light border-opacity-10 text-white-50">{formatDate(row.date)}</td>
                    <td className="border-light border-opacity-10 text-white-50">{row.user}</td>
                    <td className="border-light border-opacity-10">
                      <Badge bg="success">{row.result}</Badge>
                    </td>
                    <td className="border-light border-opacity-10 text-white-50">{row.notes || "—"}</td>
                    <td className="border-light border-opacity-10 text-white-50 small">Placeholder</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>

        {toastMessage && (
          <div
            className="position-fixed bottom-0 end-0 m-3 p-3 bg-success text-white rounded shadow"
            style={{ zIndex: 1100 }}
          >
            {toastMessage}
          </div>
        )}
      </div>

      <DeployAnywayModal
        show={showOverrideModal}
        onHide={() => setShowOverrideModal(false)}
        onConfirm={handleConfirmOverride}
        errorCount={errors}
        warningCount={warnings}
      />
    </Container>
  );
}
