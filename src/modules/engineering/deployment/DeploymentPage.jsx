import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import { useWorkingVersion } from "../../../hooks/useWorkingVersion";
import { Routes } from "../../../routes";
import { engineeringRepository, deploymentRepository, USE_HIERARCHY_API } from "../../../lib/data";
import { useSite } from "../../../app/providers/SiteProvider";
import { WORKING_VERSION_ACTIONS } from "../working-version/workingVersionReducer";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";

export default function DeploymentPage() {
  const history = useHistory();
  const { site } = useSite();
  const { validationSnapshot } = useValidation();
  const { workingState, actions, dispatch } = useWorkingVersion();
  const { summary } = validationSnapshot;
  const errors = summary?.errors ?? 0;
  const warnings = summary?.warnings ?? 0;
  const readiness = validationSnapshot.readiness;

  const currentReleaseMeta = workingState.activeDeploymentSnapshot ?? {
    version: "v0",
    lastDeployedAt: null,
    deployedBy: null,
    systemStatus: "Unknown",
  };
  const historyList = workingState.deploymentHistory ?? [];
  const pendingChanges = useMemo(() => {
    const eqCount = (workingState.equipment || []).length;
    const mappingCount = Object.values(workingState.mappings || {}).reduce((acc, m) => acc + Object.keys(m || {}).length, 0);
    const gfxCount = Object.keys(workingState.graphics || {}).length;
    const templateCount =
      (workingState.templates?.equipmentTemplates?.length || 0) + (workingState.templates?.graphicTemplates?.length || 0);
    return { equipment: eqCount, pointMappings: mappingCount, graphics: gfxCount, templates: templateCount };
  }, [workingState.equipment, workingState.mappings, workingState.graphics, workingState.templates]);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const useApiDeploy = USE_HIERARCHY_API && isBackendSiteId(site);
  const [apiDeployLoading, setApiDeployLoading] = useState(false);
  const [apiVersionSummary, setApiVersionSummary] = useState(null);
  const [versionMetaTick, setVersionMetaTick] = useState(0);

  const hasPending = deploymentRepository.hasPendingChanges(pendingChanges);

  useEffect(() => {
    if (!useApiDeploy) {
      setApiVersionSummary(null);
      return undefined;
    }
    let cancelled = false;
    engineeringRepository
      .fetchSiteVersionSummary(site)
      .then((data) => {
        if (!cancelled) setApiVersionSummary(data);
      })
      .catch(() => {
        if (!cancelled) setApiVersionSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [useApiDeploy, site, versionMetaTick]);
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

  const applyApiDeploySuccess = useCallback(
    (res) => {
      const ar = res?.activeRelease;
      const snap = ar?.payload;
      if (!snap) return;
      dispatch({
        type: WORKING_VERSION_ACTIONS.SET_ACTIVE_RELEASE_METADATA,
        payload: {
          version: snap.version,
          lastDeployedAt: snap.lastDeployedAt,
          deployedBy: snap.deployedBy,
          systemStatus: snap.systemStatus,
        },
      });
      const now = new Date();
      const entry = {
        version: snap.version,
        date: now.toISOString().slice(0, 10),
        user: snap.deployedBy || "—",
        result: "Success",
        notes: ar?.notes ?? "",
        timestamp: now.toISOString(),
      };
      dispatch({
        type: WORKING_VERSION_ACTIONS.SET_RELEASE_HISTORY,
        payload: [entry, ...(workingState.deploymentHistory || [])],
      });
    },
    [dispatch, workingState.deploymentHistory]
  );

  const handleDeployConfiguration = useCallback(async () => {
    if (errors > 0) return;
    if (useApiDeploy) {
      setApiDeployLoading(true);
      try {
        const res = await engineeringRepository.postDeployWorkingVersion(site);
        applyApiDeploySuccess(res);
        engineeringRepository.notifyEngineeringHierarchyChanged(site);
        setVersionMetaTick((t) => t + 1);
        setToastMessage("Version deployed successfully");
        setTimeout(() => setToastMessage(null), 3000);
      } catch (e) {
        setToastMessage(e?.message ? `Deploy failed: ${e.message}` : "Deploy failed");
        setTimeout(() => setToastMessage(null), 5000);
      } finally {
        setApiDeployLoading(false);
      }
      return;
    }
    setToastMessage("Deployment successful.");
    setTimeout(() => setToastMessage(null), 3000);
    actions.deployWorkingVersion();
  }, [errors, useApiDeploy, site, applyApiDeploySuccess, actions]);

  const handleDeployAnyway = useCallback(() => {
    if (errors > 0) {
      setShowOverrideModal(true);
      return;
    }
    handleDeployConfiguration();
  }, [errors, handleDeployConfiguration]);

  const handleConfirmOverride = useCallback(
    async (reason) => {
      setShowOverrideModal(false);
      const notes = reason || "Override activation";
      if (useApiDeploy) {
        setApiDeployLoading(true);
        try {
          const res = await engineeringRepository.postDeployWorkingVersion(site, notes);
          applyApiDeploySuccess(res);
          engineeringRepository.notifyEngineeringHierarchyChanged(site);
          setVersionMetaTick((t) => t + 1);
          setToastMessage("Version deployed successfully");
          setTimeout(() => setToastMessage(null), 3000);
        } catch (e) {
          setToastMessage(e?.message ? `Deploy failed: ${e.message}` : "Deploy failed");
          setTimeout(() => setToastMessage(null), 5000);
        } finally {
          setApiDeployLoading(false);
        }
        return;
      }
      setToastMessage("Deployment successful.");
      setTimeout(() => setToastMessage(null), 3000);
      actions.deployWorkingVersion({ notes });
    },
    [useApiDeploy, site, applyApiDeploySuccess, actions]
  );

  const apiDeployBlocked =
    useApiDeploy && (!hasPending || apiVersionSummary?.workingVersionNumber == null);
  const primaryDeployDisabled = errors > 0 || apiDeployLoading || apiDeployBlocked;
  const deployAnywayDisabled = apiDeployLoading || apiDeployBlocked;

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
            Activate working versions and view release history.
          </div>
        </div>

        {/* Section 1 — Active release (last activated) */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Active release
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Version</div>
                <div className="text-white fw-bold">{currentReleaseMeta.version}</div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Last Deployed</div>
                <div className="text-white">
                  {formatDate(currentReleaseMeta.lastDeployedAt)} {formatTime(currentReleaseMeta.lastDeployedAt)}
                </div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">Deployed By</div>
                <div className="text-white">{currentReleaseMeta.deployedBy}</div>
              </Col>
              <Col xs={12} sm={6} md={3}>
                <div className="text-white-50 small">System Status</div>
                <div className="text-success">{currentReleaseMeta.systemStatus}</div>
              </Col>
            </Row>
            {useApiDeploy && (
              <Row className="g-3 mt-2 pt-2 border-top border-light border-opacity-10">
                <Col xs={12} sm={6}>
                  <div className="text-white-50 small">Active version (live)</div>
                  <div className="text-white fw-bold">
                    {apiVersionSummary?.activeVersionNumber != null ? `v${apiVersionSummary.activeVersionNumber}` : "—"}
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="text-white-50 small">Working version (draft)</div>
                  <div className="text-white fw-bold">
                    {apiVersionSummary?.workingVersionNumber != null ? `v${apiVersionSummary.workingVersionNumber}` : "—"}
                  </div>
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>

        {/* Section 2 — Working version scope */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
            Working version contents
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
                disabled={primaryDeployDisabled}
                onClick={handleDeployConfiguration}
              >
                <FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Deploy version
              </Button>
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--secondary"
                disabled={deployAnywayDisabled}
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
