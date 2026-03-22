import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  Container,
  Card,
  Nav,
  Button,
  Dropdown,
  Form,
  InputGroup,
  Row,
  Col,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPlay,
  faFileExport,
  faRocket,
  faEllipsisV,
  faSearch,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionDrawer from "../../../components/legion/LegionDrawer";
import { engineeringRepository } from "../../../lib/data";
import { CATEGORY, SEVERITY, READINESS_STATUS } from "../../../lib/data/repositories/engineeringRepository";
import { validateDraft } from "../draft/validateDraft";
import ValidationSummaryCards from "./components/ValidationSummaryCards";
import ValidationIssuesTable from "./components/ValidationIssuesTable";
import ValidationIssueDetailPanel from "./components/ValidationIssueDetailPanel";
import DeployAnywayModal from "./components/DeployAnywayModal";
import { useValidation } from "../../../app/providers/ValidationProvider";
import { useEngineeringDraft } from "../../../hooks/useEngineeringDraft";

// Route paths for navigation placeholders
const ROUTE_PATHS = {
  "site-builder": "/legion/engineering/site-builder",
  "point-mapping": "/legion/engineering/point-mapping",
  "graphics-manager": "/legion/engineering/graphics-manager",
  "network-discovery": "/legion/engineering/network/discovery",
  "network-configuration": "/legion/engineering/network/configuration",
  "template-library": "/legion/engineering/templates",
  "validation-center": "/legion/engineering/validation-center",
  deployment: "/legion/engineering/deployment",
};

const CATEGORY_TABS = [
  { key: "all", label: "All Issues" },
  { key: CATEGORY.EQUIPMENT, label: "Equipment" },
  { key: CATEGORY.CONTROLLERS, label: "Controllers" },
  { key: CATEGORY.POINT_MAPPING, label: "Point Mapping" },
  { key: CATEGORY.GRAPHICS, label: "Graphics" },
  { key: CATEGORY.NETWORK, label: "Network" },
  { key: CATEGORY.DEPLOYMENT_READINESS, label: "Deployment Readiness" },
];

export default function ValidationCenterPage() {
  const history = useHistory();
  const location = useLocation();
  const { setValidationState: syncValidationToContext } = useValidation();
  const { draft, actions } = useEngineeringDraft();
  const [validationState, setValidationState] = useState(() =>
    engineeringRepository.getEmptyValidationState()
  );
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockingOnly, setBlockingOnly] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 992
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 991px)");
    const handler = () => setIsSmallScreen(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const hasRun = validationState.lastRunAt != null;
  const { issues, summary, readiness, message } = validationState;

  const handleRunValidation = useCallback(() => {
    const result = validateDraft(draft);
    setValidationState({
      issues: result.issues,
      summary: result.summary,
      readiness: result.readiness,
      message: result.message,
      lastRunAt: result.lastRunAt,
    });
    actions.setValidation(result);
    syncValidationToContext({
      summary: result.summary,
      readiness: result.readiness,
      lastRunAt: result.lastRunAt,
    });
    setSelectedIssueId(null);
  }, [draft, actions, syncValidationToContext]);

  const handleExportReport = useCallback(() => {
    console.log("Export Report (placeholder)");
    setToastMessage("Export Report is not implemented yet.");
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleDeployAnyway = useCallback(() => {
    if (readiness === READINESS_STATUS.BLOCKED && summary?.errors > 0) {
      setShowDeployModal(true);
      return;
    }
    setToastMessage("Override deployment initiated.");
    setTimeout(() => setToastMessage(null), 3000);
  }, [readiness, summary?.errors]);

  const handleDeployConfiguration = useCallback(() => {
    if ((summary?.errors ?? 0) > 0) return;
    history.push(ROUTE_PATHS.deployment);
  }, [summary?.errors, history]);

  const handleConfirmDeployOverride = useCallback(
    (reason) => {
      setShowDeployModal(false);
      actions.deployDraftConfiguration({ notes: reason || "Override deployment" });
      setToastMessage("Deployment successful.");
      setTimeout(() => setToastMessage(null), 3000);
      history.push(ROUTE_PATHS.deployment);
    },
    [actions, history]
  );

  const handleOpenTarget = useCallback(
    (target) => {
      const path = ROUTE_PATHS[target];
      if (path) history.push(path);
    },
    [history]
  );

  const filteredIssues = useMemo(() => {
    let list = issues;
    if (activeCategory !== "all") {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (severityFilter === "errors") {
      list = list.filter((i) => i.severity === SEVERITY.ERROR);
    } else if (severityFilter === "warnings") {
      list = list.filter((i) => i.severity === SEVERITY.WARNING);
    }
    if (statusFilter === "open") {
      list = list.filter((i) => i.status === "Open");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (i) =>
          (i.equipmentOrDevice || "").toLowerCase().includes(q) ||
          (i.issue || "").toLowerCase().includes(q) ||
          (i.relatedPointOrBinding || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [issues, activeCategory, severityFilter, statusFilter, searchQuery]);

  const selectedIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) || null,
    [issues, selectedIssueId]
  );

  const isBlocked = readiness === READINESS_STATUS.BLOCKED;

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
              Validation Center
            </h5>
            <div className="text-white-50 small">
              Review configuration health, mapping completeness, graphics
              readiness, and deployment blockers before going live.
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={handleRunValidation}
            >
              <FontAwesomeIcon icon={faPlay} className="me-1" /> Run Validation
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={handleExportReport}
            >
              <FontAwesomeIcon icon={faFileExport} className="me-1" /> Export Report
            </Button>
            {(summary?.errors ?? 0) === 0 ? (
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                onClick={handleDeployConfiguration}
              >
                <FontAwesomeIcon icon={faRocket} className="me-1" /> Deploy Configuration
              </Button>
            ) : (
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                onClick={handleDeployAnyway}
              >
                <FontAwesomeIcon icon={faRocket} className="me-1" /> Deploy Anyway
              </Button>
            )}
            <Dropdown>
              <Dropdown.Toggle
                size="sm"
                variant="dark"
                className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
              >
                Optional Actions <FontAwesomeIcon icon={faEllipsisV} className="ms-1" />
              </Dropdown.Toggle>
              <Dropdown.Menu align="end" className="legion-dropdown-menu">
                <Dropdown.Item className="text-white-50" onClick={() => {}}>
                  Mark as resolved (placeholder)
                </Dropdown.Item>
                <Dropdown.Item className="text-white-50" onClick={() => {}}>
                  Ignore issue (placeholder)
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        {location.state?.fromDeploy && (
          <div className="alert alert-warning border border-warning mb-3">
            <strong>Deployment blocked by validation errors.</strong> Resolve issues or deploy with override.
          </div>
        )}
        {isBlocked && (
          <div className="alert alert-danger border border-danger mb-3">
            <strong>Standard deployment is blocked.</strong> Resolve blocking
            errors below or use &quot;Deploy Anyway&quot; for override deployment.
          </div>
        )}

        <ValidationSummaryCards
          summary={summary}
          readiness={readiness}
          message={message}
          lastRunAt={validationState.lastRunAt}
        />

        {!hasRun ? (
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm mt-3">
            <Card.Body className="py-5 text-center">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="fa-3x text-white-50 mb-3 opacity-50"
              />
              <h6 className="text-white mb-2">Validation has not been run yet.</h6>
              <p className="text-white-50 small mb-3">
                Run validation to check configuration health and deployment readiness.
              </p>
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                onClick={handleRunValidation}
              >
                <FontAwesomeIcon icon={faPlay} className="me-1" /> Run Validation
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <>
            <Nav variant="tabs" className="mb-3 template-library-tabs validation-tabs">
              {CATEGORY_TABS.map((tab) => (
                <Nav.Item key={tab.key}>
                  <Nav.Link
                    active={activeCategory === tab.key}
                    onClick={() => setActiveCategory(tab.key)}
                    className="text-white-50"
                  >
                    {tab.label}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <InputGroup size="sm" className="validation-search" style={{ maxWidth: 260 }}>
                <InputGroup.Text className="bg-dark border-light border-opacity-10 text-white-50">
                  <FontAwesomeIcon icon={faSearch} />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-dark border-light border-opacity-10 text-white"
                />
              </InputGroup>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white validation-filter-select"
                style={{ width: 140 }}
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">Severity: All</option>
                <option value="errors">Errors</option>
                <option value="warnings">Warnings</option>
              </Form.Select>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white validation-filter-select"
                style={{ width: 130 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Status: All</option>
                <option value="open">Open</option>
              </Form.Select>
              <Form.Check
                type="switch"
                id="blocking-only"
                label="Show blocking issues only"
                className="text-white-50 small ms-2"
                checked={blockingOnly}
                onChange={(e) => setBlockingOnly(e.target.checked)}
              />
            </div>

            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span className="text-white fw-bold">Validation issues</span>
                <span className="text-white-50 small">
                  {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
                </span>
              </Card.Header>
              <Card.Body className="p-0 overflow-auto" style={{ minHeight: 400 }}>
                {filteredIssues.length === 0 && issues.length === 0 ? (
                  <div className="py-5 text-center text-white-50">
                    <FontAwesomeIcon icon={faCheck} className="fa-2x text-success mb-2" />
                    <p className="mb-0">No validation issues found. This site is ready for deployment.</p>
                  </div>
                ) : (
                  <Row className="g-0">
                    <Col xs={12} lg={selectedIssueId ? 7 : 12}>
                      <ValidationIssuesTable
                        issues={filteredIssues}
                        selectedId={selectedIssueId}
                        onSelectRow={(issue) => setSelectedIssueId(issue.id)}
                        blockingOnly={blockingOnly}
                      />
                    </Col>
                    {selectedIssueId && (
                      <Col lg={5} className="d-none d-lg-block border-start border-light border-opacity-10">
                        <div className="p-3 h-100" style={{ minHeight: 400 }}>
                          <ValidationIssueDetailPanel
                            issue={selectedIssue}
                            onClose={() => setSelectedIssueId(null)}
                            onOpenTarget={handleOpenTarget}
                          />
                        </div>
                      </Col>
                    )}
                  </Row>
                )}
              </Card.Body>
            </Card>
          </>
        )}

        {toastMessage && (
          <div
            className="position-fixed bottom-0 end-0 m-3 p-3 bg-success text-white rounded shadow"
            style={{ zIndex: 1100 }}
          >
            {toastMessage}
          </div>
        )}
      </div>

      <LegionDrawer
        open={!!selectedIssue && isSmallScreen}
        onClose={() => setSelectedIssueId(null)}
        maxWidth={480}
        panelClassName="bg-primary border-start border-light border-opacity-10"
        ariaLabel="Issue details"
      >
        <div className="p-3 h-100">
          <ValidationIssueDetailPanel
            issue={selectedIssue}
            onClose={() => setSelectedIssueId(null)}
            onOpenTarget={handleOpenTarget}
          />
        </div>
      </LegionDrawer>

      <DeployAnywayModal
        show={showDeployModal}
        onHide={() => setShowDeployModal(false)}
        onConfirm={handleConfirmDeployOverride}
        errorCount={summary?.errors ?? 0}
        warningCount={summary?.warnings ?? 0}
      />
    </Container>
  );
}
