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
  faBoxOpen,
  faDownload,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import DeployAnywayModal from "../validation-center/components/DeployAnywayModal";
import { useValidation } from "../../../app/providers/ValidationProvider";
import { useWorkingVersion } from "../../../hooks/useWorkingVersion";
import { useEngineeringVersionContext } from "../../../app/providers/EngineeringVersionProvider";
import { Routes } from "../../../routes";
import { engineeringRepository, deploymentRepository, USE_HIERARCHY_API, accessRepository } from "../../../lib/data";
import { useSite } from "../../../app/providers/SiteProvider";
import { WORKING_VERSION_ACTIONS } from "../working-version/workingVersionReducer";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { appNotify, appLogger } from "../../../lib/app-activity";

function getDeployerDisplayName() {
  try {
    const u = accessRepository.getCurrentUserForAccess();
    const n = (u?.fullName || "").trim();
    return n || "Unknown User";
  } catch {
    return "Unknown User";
  }
}

export default function DeploymentPage() {
  const history = useHistory();
  const { site } = useSite();
  const { validationSnapshot } = useValidation();
  const { workingState, actions, dispatch } = useWorkingVersion();
  const { registerBackendActiveRelease } = useEngineeringVersionContext();
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
  const useApiDeploy = USE_HIERARCHY_API && isBackendSiteId(site);
  const [apiDeployLoading, setApiDeployLoading] = useState(false);
  const [apiVersionSummary, setApiVersionSummary] = useState(null);
  const [apiVersionHistory, setApiVersionHistory] = useState([]);
  const [rollbackLoadingId, setRollbackLoadingId] = useState(null);
  const [versionMetaTick, setVersionMetaTick] = useState(0);

  const hasPending = deploymentRepository.hasPendingChanges(pendingChanges);

  useEffect(() => {
    if (!useApiDeploy) {
      setApiVersionSummary(null);
      setApiVersionHistory([]);
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
    engineeringRepository
      .fetchSiteVersionHistory(site)
      .then((rows) => {
        if (!cancelled) setApiVersionHistory(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setApiVersionHistory([]);
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
      if (isBackendSiteId(site)) {
        registerBackendActiveRelease(site, {
          version: snap.version,
          lastDeployedAt: snap.lastDeployedAt,
        });
      }
    },
    [dispatch, workingState.deploymentHistory, site, registerBackendActiveRelease]
  );

  const handleRollback = useCallback(
    async (versionId) => {
      if (!useApiDeploy || rollbackLoadingId) return;
      setRollbackLoadingId(versionId);
      appNotify.info("Rolling back release...");
      appLogger.info("Rolling back release...", { area: "Deployment", action: "Rollback" });
      try {
        const res = await engineeringRepository.postRollbackRelease(site, {
          toVersionId: versionId,
          actor: getDeployerDisplayName(),
        });
        applyApiDeploySuccess(res);
        engineeringRepository.notifyEngineeringHierarchyChanged(site);
        setVersionMetaTick((t) => t + 1);
        appNotify.success("Rolled back successfully");
        appLogger.success("Rolled back successfully", { area: "Deployment", action: "Rollback" });
      } catch (e) {
        const msg = e?.message ? `Rollback failed: ${e.message}` : "Rollback failed";
        appNotify.error(msg);
        appLogger.error(msg, { area: "Deployment", action: "Rollback", details: e?.message });
      } finally {
        setRollbackLoadingId(null);
      }
    },
    [useApiDeploy, rollbackLoadingId, site, applyApiDeploySuccess]
  );

  const handleDeployConfiguration = useCallback(async () => {
    if (errors > 0) return;
    if (useApiDeploy) {
      setApiDeployLoading(true);
      appNotify.info("Deploying version...");
      appLogger.info("Deploying version...", { area: "Deployment", action: "Deploy to live" });
      try {
        const res = await engineeringRepository.postDeployWorkingVersion(site, undefined, {
          deployedBy: getDeployerDisplayName(),
        });
        applyApiDeploySuccess(res);
        engineeringRepository.notifyEngineeringHierarchyChanged(site);
        setVersionMetaTick((t) => t + 1);
        appNotify.success("Version deployed successfully");
        appLogger.success("Version deployed successfully", { area: "Deployment", action: "Deploy to live" });
      } catch (e) {
        const msg = e?.message ? `Deploy failed: ${e.message}` : "Deploy failed";
        appNotify.error(msg);
        appLogger.error(msg, { area: "Deployment", action: "Deploy to live", details: e?.message });
      } finally {
        setApiDeployLoading(false);
      }
      return;
    }
    appNotify.success("Version deployed successfully");
    appLogger.success("Version deployed successfully", { area: "Deployment", action: "Deploy to live" });
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
        appNotify.info("Deploying version...");
        appLogger.info("Deploying version...", { area: "Deployment", action: "Deploy override" });
        try {
          const res = await engineeringRepository.postDeployWorkingVersion(site, notes, {
            deployedBy: getDeployerDisplayName(),
          });
          applyApiDeploySuccess(res);
          engineeringRepository.notifyEngineeringHierarchyChanged(site);
          setVersionMetaTick((t) => t + 1);
          appNotify.success("Version deployed successfully");
          appLogger.success("Version deployed successfully", { area: "Deployment", action: "Deploy override" });
        } catch (e) {
          const msg = e?.message ? `Deploy failed: ${e.message}` : "Deploy failed";
          appNotify.error(msg);
          appLogger.error(msg, { area: "Deployment", action: "Deploy override", details: e?.message });
        } finally {
          setApiDeployLoading(false);
        }
        return;
      }
      appNotify.success("Version deployed successfully");
      appLogger.success("Version deployed successfully", { area: "Deployment", action: "Deploy override" });
      actions.deployWorkingVersion({ notes });
    },
    [useApiDeploy, site, applyApiDeploySuccess, actions]
  );

  // ---- Legion Site Package (.lspkg) — LC-ARCH-002: Validate Project, Build Site Package,
  // Export Site Package, Deploy to LS-100 (direct). Distinct from the legacy same-database
  // "Deploy version" above, which the package pipeline evolves toward but does not replace here. ----
  const [packageBusy, setPackageBusy] = useState(false);
  const [packageError, setPackageError] = useState("");
  const [projectValidation, setProjectValidation] = useState(null);
  const [builtPackage, setBuiltPackage] = useState(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [directDeployResult, setDirectDeployResult] = useState(null);

  const handleValidateProject = useCallback(async () => {
    if (!useApiDeploy) return;
    setPackageBusy(true);
    setPackageError("");
    try {
      const result = await deploymentRepository.validateProjectForPackage(site);
      setProjectValidation(result);
    } catch (e) {
      setPackageError(e.message || "Validation failed");
    } finally {
      setPackageBusy(false);
    }
  }, [useApiDeploy, site]);

  const handleBuildPackage = useCallback(async () => {
    if (!useApiDeploy) return;
    setPackageBusy(true);
    setPackageError("");
    setDirectDeployResult(null);
    try {
      const result = await deploymentRepository.buildSitePackage(site, { author: getDeployerDisplayName() });
      setBuiltPackage(result);
      setProjectValidation(result.validation);
    } catch (e) {
      setPackageError(e.message || "Build failed");
      setBuiltPackage(null);
    } finally {
      setPackageBusy(false);
    }
  }, [useApiDeploy, site]);

  const handleExportPackage = useCallback(async () => {
    if (!builtPackage) return;
    setPackageBusy(true);
    setPackageError("");
    try {
      const { blob, fileName } = await deploymentRepository.exportSitePackage(site, builtPackage.packageRecord.id);
      deploymentRepository.saveBlob(blob, fileName || builtPackage.fileName);
    } catch (e) {
      setPackageError(e.message || "Export failed");
    } finally {
      setPackageBusy(false);
    }
  }, [builtPackage, site]);

  const handleDeployDirect = useCallback(async () => {
    if (!targetUrl.trim()) {
      setPackageError("Enter the target LS-100 URL first (e.g. http://ls100-sim.local:4100)");
      return;
    }
    setPackageBusy(true);
    setPackageError("");
    setDirectDeployResult(null);
    try {
      const result = await deploymentRepository.deployPackageDirect(site, {
        targetUrl: targetUrl.trim(),
        author: getDeployerDisplayName(),
      });
      setDirectDeployResult(result);
      appNotify.success(`Package transferred to ${targetUrl.trim()}`);
    } catch (e) {
      setPackageError(e.message || "Direct deploy failed");
    } finally {
      setPackageBusy(false);
    }
  }, [targetUrl, site]);

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
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">
              <FontAwesomeIcon icon={faRocket} className="me-2" />
              Deployment
            </span>
          </Card.Header>
          <Card.Body>
            <div className="text-white-50 small mb-3">
              Activate working versions and view release history.
            </div>

        {/* Section 1 — Active release (last activated) */}
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">Active Release</span>
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
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">Working Version Contents</span>
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
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="legion-operator-log-card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold text-uppercase">Deployment Readiness</span>
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
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">Deployment Actions</span>
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

        {/* Section 4b — Legion Site Package (.lspkg) */}
        {useApiDeploy && (
          <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm mb-3">
            <Card.Header className="legion-operator-log-card-header">
              <span className="text-white fw-bold text-uppercase">Legion Site Package</span>
            </Card.Header>
            <Card.Body>
              <p className="text-white-50 small mb-3">
                Validate the offline project, build an immutable, checksummed <code>.lspkg</code>, then
                export it for offline transport or send it directly to a configured LS-100. Building
                never overwrites this database's live configuration — only an LS-100 activates a package.
              </p>
              {packageError && <div className="text-danger small mb-2">{packageError}</div>}
              <div className="d-flex flex-wrap gap-2 mb-3">
                <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" disabled={packageBusy} onClick={handleValidateProject}>
                  <FontAwesomeIcon icon={faListAlt} className="me-1" /> Validate Project
                </Button>
                <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" disabled={packageBusy} onClick={handleBuildPackage}>
                  <FontAwesomeIcon icon={faBoxOpen} className="me-1" /> Build Site Package
                </Button>
                <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" disabled={packageBusy || !builtPackage} onClick={handleExportPackage}>
                  <FontAwesomeIcon icon={faDownload} className="me-1" /> Export Site Package
                </Button>
              </div>

              {projectValidation && (
                <div className="mb-3">
                  <span className={`badge bg-${projectValidation.ok ? "success" : "danger"} me-2`}>
                    {projectValidation.ok ? "Valid" : "Blocked"}
                  </span>
                  {projectValidation.errors?.map((e, i) => (
                    <div key={`err-${i}`} className="text-danger small">{e}</div>
                  ))}
                  {projectValidation.warnings?.map((w, i) => (
                    <div key={`warn-${i}`} className="text-warning small">{w}</div>
                  ))}
                </div>
              )}

              {builtPackage && (
                <div className="border border-light border-opacity-10 rounded p-2 bg-dark bg-opacity-25 mb-3">
                  <div className="text-white small">
                    Built <strong>{builtPackage.fileName}</strong> (unsigned development package — checksum-verified,
                    not cryptographically signed)
                  </div>
                </div>
              )}

              <div className="border-top border-light border-opacity-10 pt-3">
                <div className="text-white-50 small mb-2">
                  Deploy to LS-100 (direct) — builds a fresh package and transfers it over HTTP to the
                  same import pipeline offline import uses.
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ maxWidth: 340 }}
                    placeholder="http://ls100-sim.local:4100"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                  />
                  <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" disabled={packageBusy} onClick={handleDeployDirect}>
                    <FontAwesomeIcon icon={faPaperPlane} className="me-1" /> Deploy to LS-100
                  </Button>
                </div>
                {directDeployResult && (
                  <div className="text-success small mt-2">
                    Staged on {directDeployResult.targetUrl} as {directDeployResult.remoteRecord?.status} (package{" "}
                    {directDeployResult.remoteRecord?.packageVersion}). Validate and activate it from that LS-100's
                    Commissioning console.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Section 5 — Deployment History */}
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">Deployment History</span>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="legion-operator-log-table-wrap">
            <Table responsive hover className="mb-0">
              <thead>
                <tr className="text-white">
                  <th className="text-white">Version</th>
                  <th className="text-white">Date</th>
                  <th className="text-white">User</th>
                  <th className="text-white">Result</th>
                  <th className="text-white">Notes</th>
                  <th className="text-white">Rollback</th>
                </tr>
              </thead>
              <tbody>
                {useApiDeploy
                  ? apiVersionHistory
                      .filter((row) => row.status === "RELEASED")
                      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))
                      .map((row) => {
                        const isActive = apiVersionSummary?.activeVersionNumber === row.versionNumber;
                        return (
                          <tr key={row.id}>
                            <td className="border-light border-opacity-10 text-white">
                              v{row.versionNumber} {isActive && <Badge bg="info" className="ms-1">Active</Badge>}
                            </td>
                            <td className="border-light border-opacity-10 text-white-50">
                              {formatDate(row.deployedAt)} {formatTime(row.deployedAt)}
                            </td>
                            <td className="border-light border-opacity-10 text-white-50">{row.deployedBy || "—"}</td>
                            <td className="border-light border-opacity-10">
                              <Badge bg="success">Success</Badge>
                            </td>
                            <td className="border-light border-opacity-10 text-white-50">{row.notes || "—"}</td>
                            <td className="border-light border-opacity-10 text-white-50 small">
                              {isActive ? (
                                "—"
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline-light"
                                  className="legion-hero-btn legion-hero-btn--secondary"
                                  disabled={rollbackLoadingId != null}
                                  onClick={() => handleRollback(row.id)}
                                >
                                  {rollbackLoadingId === row.id ? "Rolling back…" : "Rollback"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  : historyList.map((row, idx) => (
                      <tr key={`${row.version}-${idx}`}>
                        <td className="border-light border-opacity-10 text-white">{row.version}</td>
                        <td className="border-light border-opacity-10 text-white-50">{formatDate(row.date)}</td>
                        <td className="border-light border-opacity-10 text-white-50">{row.user}</td>
                        <td className="border-light border-opacity-10">
                          <Badge bg="success">{row.result}</Badge>
                        </td>
                        <td className="border-light border-opacity-10 text-white-50">{row.notes || "—"}</td>
                        <td className="border-light border-opacity-10 text-white-50 small">—</td>
                      </tr>
                    ))}
              </tbody>
            </Table>
            </div>
          </Card.Body>
        </Card>

          </Card.Body>
        </Card>
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
