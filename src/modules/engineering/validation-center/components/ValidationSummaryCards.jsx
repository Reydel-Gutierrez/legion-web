import React from "react";
import { Card, Row, Col } from "@themesberg/react-bootstrap";
import { READINESS_STATUS } from "../../../../lib/data/repositories/engineeringRepository";

/**
 * Summary cards and overall readiness badge for Validation Center.
 */
export default function ValidationSummaryCards({
  summary,
  readiness,
  message,
  lastRunAt,
}) {
  const hasRun = summary && (summary.equipment > 0 || summary.errors > 0 || summary.warnings > 0) || lastRunAt;
  const readinessLabel =
    readiness === READINESS_STATUS.READY
      ? "Ready for Deployment"
      : readiness === READINESS_STATUS.BLOCKED
      ? "Deployment Blocked"
      : readiness === READINESS_STATUS.WARNINGS
      ? "Deployment Allowed with Warnings"
      : "—";
  const readinessVariant =
    readiness === READINESS_STATUS.READY
      ? "success"
      : readiness === READINESS_STATUS.BLOCKED
      ? "danger"
      : readiness === READINESS_STATUS.WARNINGS
      ? "warning"
      : "secondary";

  const cards = [
    { label: "Equipment", value: summary?.equipment ?? 0, variant: "primary" },
    { label: "Controllers", value: summary?.controllers ?? 0, variant: "primary" },
    { label: "Required Points Mapped", value: summary?.requiredPointsMapped ?? 0, variant: "success" },
    { label: "Unmapped Required Points", value: summary?.unmappedRequiredPoints ?? 0, variant: summary?.unmappedRequiredPoints > 0 ? "danger" : "secondary" },
    { label: "Graphics Missing", value: summary?.graphicsMissing ?? 0, variant: summary?.graphicsMissing > 0 ? "warning" : "secondary" },
    { label: "Offline Controllers", value: summary?.offlineControllers ?? 0, variant: summary?.offlineControllers > 0 ? "danger" : "secondary" },
    { label: "Warnings", value: summary?.warnings ?? 0, variant: summary?.warnings > 0 ? "warning" : "secondary" },
    { label: "Errors", value: summary?.errors ?? 0, variant: summary?.errors > 0 ? "danger" : "secondary" },
  ];

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <span className="text-white fw-bold">Validation Summary</span>
          {lastRunAt && (
            <span className="text-white-50 small">
              Last run: {new Date(lastRunAt).toLocaleString()}
            </span>
          )}
        </div>
        <Row className="g-2 mb-3">
          {cards.map((c) => (
            <Col key={c.label} xs={6} sm={4} md={3} lg={2}>
              <div className="validation-summary-card border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25">
                <div className="text-white-50 small">{c.label}</div>
                <div className={`text-${c.variant} fw-bold`}>{c.value}</div>
              </div>
            </Col>
          ))}
        </Row>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <span className="text-white-50 small">Overall status:</span>
          <span className={`badge bg-${readinessVariant} validation-readiness-badge`}>
            {readinessLabel}
          </span>
          {message && (
            <span className="text-white-50 small flex-grow-1">{message}</span>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
