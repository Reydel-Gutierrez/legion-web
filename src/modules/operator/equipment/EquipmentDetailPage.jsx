import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { useActiveDeployment } from "../../../hooks/useWorkingVersion";
import {
  getEquipmentFromRelease,
  resolveEquipmentLocationInRelease,
} from "../../../lib/activeReleaseUtils";
import { operatorRepository } from "../../../lib/data";
import { useSite } from "../../../app/providers/SiteProvider";
import { Container, Row, Col, Card, Button, Form, Modal } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import { Routes } from "../../../routes";
import VavGraphicImg from "../../../assets/graphics/mysvgvav.svg";
import DeployedGraphicPreview from "./DeployedGraphicPreview";
import {
  getCommandProfileForRows,
  getInitialCommandValue,
  formatCommandValueForDisplay,
  OperatorPointCommandField,
} from "./OperatorPointCommandField";
import { OperatorAlarmConfigModal } from "./OperatorAlarmConfigModal";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { listPointsByEquipment } from "../../../lib/data/adapters/api/hierarchyApiAdapter";
import * as runtimeApi from "../../../lib/data/adapters/api/runtimeApiAdapter";
import { getEquipmentControllerByEquipment } from "../../../lib/data/adapters/api/equipmentControllerApiAdapter";
import { getPointMappingsByEquipment } from "../../../lib/data/adapters/api/pointMappingApiAdapter";
import { applyHierarchyLiveToWorkspaceRows } from "../../../lib/operator/operatorWorkspaceHierarchyMerge";
import { resolveLivePointsSourceEquipmentId } from "../../../lib/operator/operatorWorkspaceLivePointsSource";
import { formatDiscoveryLastSeen } from "../../engineering/network/discoveryScan";

const DETAIL_OOS_LABEL = "Out Of Service";

/** @typedef {{ outOfService?: boolean, pendingDisplay?: string, pendingRaw?: unknown }} PointUiPatch */

/**
 * @param {import("../../../lib/data/contracts").WorkspaceRow} row
 * @param {Record<string, PointUiPatch>} ui
 */
function detailPointTableValue(row, ui) {
  const u = ui[row.id];
  if (u?.outOfService) return DETAIL_OOS_LABEL;
  if (u?.pendingDisplay != null && String(u.pendingDisplay).length > 0) return u.pendingDisplay;
  return row.value;
}

/**
 * Expanded network / engineering-aligned fields for operator equipment detail.
 * @param {object | null} releaseData
 * @param {object | null} equipment
 * @param {object | null} graphic
 */
function buildOperatorEquipmentNetworkDetails(releaseData, equipment, graphic) {
  if (!equipment) return [];
  const loc = releaseData
    ? resolveEquipmentLocationInRelease(releaseData, equipment.id)
    : {
        siteName: "",
        buildingName: "",
        floorName: "",
        equipmentLabel: equipment.displayLabel || equipment.name || "",
      };
  const fullPath = [loc.siteName, loc.buildingName, loc.floorName, loc.equipmentLabel]
    .filter((x) => x != null && String(x).trim() !== "")
    .join(" / ");

  const eid = equipment.id;
  const maps =
    releaseData?.mappings?.[eid] ?? releaseData?.mappings?.[String(eid)] ?? {};
  const mappedPointCount = Object.keys(maps).filter((k) => maps[k]).length;
  const pointsTotal =
    typeof equipment.pointsDefined === "number"
      ? equipment.pointsDefined
      : Array.isArray(equipment.livePoints)
        ? equipment.livePoints.length
        : "—";

  const graphicTemplate =
    graphic?.templateName ||
    graphic?.sourceTemplateName ||
    graphic?.name ||
    (graphic?.objects?.length > 0 ? "Deployed graphic (instance)" : "—");

  const protocol = equipment.protocol || "BACnet/IP";
  const controller = equipment.controllerRef
    ? `${protocol}: ${equipment.controllerRef}`
    : "Unassigned";

  /** @type {{ key: string, value: string | number }[]} */
  const rows = [];
  rows.push({ key: "Equipment full address", value: fullPath || "—" });
  rows.push({ key: "Equipment", value: equipment.displayLabel || equipment.name || "—" });
  rows.push({ key: "Equipment ID", value: String(equipment.id) });
  rows.push({ key: "Instance number", value: equipment.instanceNumber ?? "—" });
  rows.push({ key: "Device type", value: equipment.type || equipment.equipmentType || "—" });
  rows.push({ key: "Protocol", value: protocol });
  rows.push({ key: "Mapped controller", value: controller });
  rows.push({ key: "Engineering status", value: equipment.status || "—" });
  rows.push({ key: "Comm / controller", value: equipment.commStatus || (equipment.controllerRef ? "Controller assigned" : "No controller") });
  rows.push({ key: "Equipment template", value: equipment.templateName || "—" });
  rows.push({ key: "Graphic template", value: graphicTemplate });
  rows.push({ key: "Address #", value: equipment.address != null && String(equipment.address).trim() !== "" ? String(equipment.address) : "—" });
  rows.push({ key: "Location label", value: equipment.locationLabel || "—" });
  rows.push({ key: "Building ID", value: equipment.buildingId || "—" });
  rows.push({ key: "Floor ID", value: equipment.floorId || "—" });
  rows.push({
    key: "Point mapping",
    value: pointsTotal !== "—" ? `${mappedPointCount} mapped / ${pointsTotal} defined` : `${mappedPointCount} mapped`,
  });
  if (releaseData?.site?.name) {
    rows.push({ key: "Site", value: releaseData.site.name });
  }
  if (equipment.notes != null && String(equipment.notes).trim() !== "") {
    rows.push({ key: "Notes", value: String(equipment.notes) });
  }
  return rows;
}

export default function EquipmentDetailPage() {
  const { equipmentId } = useParams();
  const history = useHistory();
  const { site: siteFromContext } = useSite();
  const { deployment, loading: releaseLoading, error: releaseError } = useActiveDeployment();
  const releaseData = deployment;

  /** Local operator UI overrides per point (workspace-style; not persisted to API yet). */
  const [pointUiState, setPointUiState] = useState({});
  const [commandModalRow, setCommandModalRow] = useState(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [alarmModalRow, setAlarmModalRow] = useState(null);
  const [commandValue, setCommandValue] = useState("");
  const [serviceStateChoice, setServiceStateChoice] = useState("in_service");
  /** DB points + mappings for hierarchy merge (operator live values / mapped-to labels). */
  const [hierarchyLiveBundle, setHierarchyLiveBundle] = useState(null);
  const [runtimeForEquipment, setRuntimeForEquipment] = useState(null);
  const [persistedDbController, setPersistedDbController] = useState(null);

  useEffect(() => {
    setPointUiState({});
    setCommandModalRow(null);
    setShowCommandModal(false);
    setHierarchyLiveBundle(null);
    setRuntimeForEquipment(null);
    setPersistedDbController(null);
  }, [equipmentId]);

  const equipment = useMemo(
    () => (releaseData && equipmentId ? getEquipmentFromRelease(releaseData, equipmentId) : null),
    [releaseData, equipmentId]
  );

  const alarmSiteId = releaseData?.site?.id || siteFromContext;

  useEffect(() => {
    if (!USE_HIERARCHY_API || !equipment?.id || !isBackendSiteId(alarmSiteId)) {
      setHierarchyLiveBundle(null);
      setRuntimeForEquipment(null);
      setPersistedDbController(null);
      return undefined;
    }
    let cancelled = false;

    async function refreshLive() {
      try {
        const controllers = await runtimeApi.listRuntimeControllers().catch(() => []);
        const ctrlList = Array.isArray(controllers) ? controllers : [];
        const sourceEqId = resolveLivePointsSourceEquipmentId(equipment.id, releaseData, ctrlList);
        const [dbPoints, mappings, dbCtrl] = await Promise.all([
          listPointsByEquipment(sourceEqId),
          getPointMappingsByEquipment(sourceEqId).catch(() => []),
          getEquipmentControllerByEquipment(equipment.id).catch(() => null),
        ]);
        const rt =
          ctrlList.find((c) => c && String(c.equipmentId) === String(equipment.id)) ||
          ctrlList.find((c) => c && String(c.equipmentId) === String(sourceEqId)) ||
          null;
        if (cancelled) return;
        setPersistedDbController(dbCtrl);
        setHierarchyLiveBundle({
          points: Array.isArray(dbPoints) ? dbPoints : [],
          mappings: Array.isArray(mappings) ? mappings : [],
          controller: dbCtrl,
          runtime: rt || null,
        });
        setRuntimeForEquipment(rt || null);
      } catch {
        if (!cancelled) {
          setHierarchyLiveBundle(null);
          setRuntimeForEquipment(null);
          setPersistedDbController(null);
        }
      }
    }

    refreshLive();
    const t = window.setInterval(refreshLive, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [equipment, alarmSiteId, releaseData]);

  const points = useMemo(() => {
    if (!releaseData || !equipment) return [];
    return operatorRepository.getWorkspacePointsForEquipment(
      equipment.id,
      equipment.displayLabel || equipment.name,
      equipment.status,
      { activeRelease: releaseData }
    );
  }, [releaseData, equipment]);

  const displayPoints = useMemo(() => {
    if (
      !USE_HIERARCHY_API ||
      !isBackendSiteId(alarmSiteId) ||
      !hierarchyLiveBundle ||
      !equipment?.id ||
      !Array.isArray(hierarchyLiveBundle.points)
    ) {
      return points;
    }
    const m = new Map([[String(equipment.id), hierarchyLiveBundle]]);
    return applyHierarchyLiveToWorkspaceRows(points, releaseData, m);
  }, [points, releaseData, hierarchyLiveBundle, equipment?.id, alarmSiteId]);

  const pointsForGraphic = useMemo(() => {
    return displayPoints.map((p) => {
      const v = detailPointTableValue(p, pointUiState);
      return { ...p, value: v };
    });
  }, [displayPoints, pointUiState]);

  const graphic = useMemo(() => {
    if (!releaseData?.graphics || !equipment) return null;
    return releaseData.graphics[equipment.id] || null;
  }, [releaseData?.graphics, equipment]);

  const networkDetails = useMemo(
    () => buildOperatorEquipmentNetworkDetails(releaseData, equipment, graphic),
    [releaseData, equipment, graphic]
  );

  const openPointCommandModal = useCallback(
    (row) => {
      setCommandModalRow(row);
      setShowCommandModal(true);
      const profile = getCommandProfileForRows([row]);
      if (profile.mode === "typed") {
        const u = pointUiState[row.id];
        setCommandValue(
          u?.pendingRaw !== undefined ? u.pendingRaw : getInitialCommandValue([row], profile)
        );
      } else {
        setCommandValue("");
      }
      const u = pointUiState[row.id];
      if (profile.readOnlySensorUi) {
        setServiceStateChoice(u?.outOfService ? "out_of_service" : "in_service");
      } else {
        setServiceStateChoice("in_service");
      }
    },
    [pointUiState]
  );

  const closeCommandModal = useCallback(() => {
    setShowCommandModal(false);
    setCommandModalRow(null);
    setCommandValue("");
    setServiceStateChoice("in_service");
  }, []);

  const handleCommandModalApply = useCallback(() => {
    if (!commandModalRow) return;
    const row = commandModalRow;
    const profile = getCommandProfileForRows([row]);

    if (profile.readOnlySensorUi) {
      const oos = serviceStateChoice === "out_of_service";
      setPointUiState((s) => ({
        ...s,
        [row.id]: {
          ...s[row.id],
          outOfService: oos,
          ...(oos ? {} : { pendingDisplay: undefined, pendingRaw: undefined }),
        },
      }));
    } else if (profile.mode === "typed") {
      setPointUiState((s) => ({
        ...s,
        [row.id]: {
          ...s[row.id],
          outOfService: false,
          pendingRaw: commandValue,
          pendingDisplay: formatCommandValueForDisplay(
            profile.commandType,
            commandValue,
            profile.commandConfig
          ),
        },
      }));
    } else {
      setPointUiState((s) => ({
        ...s,
        [row.id]: {
          ...s[row.id],
          pendingDisplay: String(commandValue ?? ""),
          pendingRaw: commandValue,
        },
      }));
    }

    console.log("Equipment detail command:", {
      equipmentId: equipment?.id,
      point: row.pointId,
      profile: profile.mode,
      value: commandValue,
      serviceState: profile.readOnlySensorUi ? serviceStateChoice : undefined,
    });

    closeCommandModal();
  }, [commandModalRow, commandValue, serviceStateChoice, equipment?.id, closeCommandModal]);

  const modalProfile = commandModalRow ? getCommandProfileForRows([commandModalRow]) : { mode: "empty" };
  const commandApplyDisabled =
    modalProfile.mode === "typed" && modalProfile.allOperational === false;

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type) return;
    if (linkTarget.type === "equipment" && linkTarget.id) {
      const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(linkTarget.id));
      history.push(path);
    } else if (linkTarget.type === "layout" && linkTarget.id) {
      history.push(Routes.LegionSite.path, { selectLayoutLevelId: linkTarget.id });
    } else if (linkTarget.type === "url" && linkTarget.url) {
      window.open(linkTarget.url, "_blank", "noopener,noreferrer");
    } else if (linkTarget.type === "route" && linkTarget.path) {
      history.push(linkTarget.path);
    }
  };

  if (releaseLoading && !equipment) {
    return (
      <Container fluid className="px-0 app-scale">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 text-white-50 small">Loading equipment…</div>
      </Container>
    );
  }

  if (releaseError && !equipment) {
    return (
      <Container fluid className="px-0 app-scale">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 alert alert-danger py-2 small">{releaseError}</div>
      </Container>
    );
  }

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
              <p className="small mb-0">It may not be in the active release for this site or the reference may be invalid.</p>
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
                        <div style={{ width: 700, flexShrink: 0 }}>
                          {graphic?.objects?.length > 0 ? (
                            <DeployedGraphicPreview
                              graphic={graphic}
                              points={pointsForGraphic}
                              onLinkClick={handleGraphicLinkClick}
                              maxWidth={700}
                              maxHeight={360}
                              zoomFactor={1.75}
                            />
                          ) : (
                            <div
                              className="d-flex align-items-center justify-content-center bg-transparent"
                              style={{ width: 700, height: 360 }}
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
                            {USE_HIERARCHY_API && (runtimeForEquipment || persistedDbController) ? (
                              <div className="border border-light border-opacity-10 rounded px-3 py-2 mb-3 bg-dark bg-opacity-25">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                  <span className="text-white fw-semibold small text-uppercase">
                                    Controller runtime
                                  </span>
                                  {runtimeForEquipment ? (
                                    <>
                                      <span
                                        className={`badge ${runtimeForEquipment.online ? "bg-success" : "bg-secondary"}`}
                                      >
                                        {runtimeForEquipment.online ? "Online" : "Offline"}
                                      </span>
                                      {runtimeForEquipment.online && runtimeForEquipment.simEnabled ? (
                                        <span className="badge bg-info bg-opacity-50">Live</span>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                                {persistedDbController ? (
                                  <div className="text-white small mb-2">
                                    Assigned field controller:{" "}
                                    <span className="fw-semibold">{persistedDbController.controllerCode}</span>
                                    {persistedDbController.displayName
                                      ? ` (${persistedDbController.displayName})`
                                      : ""}{" "}
                                    · {persistedDbController.protocol || "—"}
                                    {persistedDbController.isEnabled === false ? (
                                      <span className="text-warning ms-2">(disabled)</span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {runtimeForEquipment ? (
                                  <div className="text-white-50 small d-flex flex-wrap gap-3">
                                    <span>Protocol: {runtimeForEquipment.protocol || "—"}</span>
                                    <span>
                                      Last seen:{" "}
                                      {formatDiscoveryLastSeen(runtimeForEquipment.lastSeenAt) || "—"}
                                    </span>
                                    <span>
                                      Poll rate: {Math.round((runtimeForEquipment.pollRateMs || 5000) / 1000)}s
                                    </span>
                                    <span>Polls: {runtimeForEquipment.stats?.pollCount ?? 0}</span>
                                  </div>
                                ) : (
                                  <div className="text-white-50 small">
                                    In-memory runtime stats appear when the simulator exposes this equipment.
                                  </div>
                                )}
                              </div>
                            ) : null}
                            <div className="text-white fw-bold mb-2">Live Points</div>
                            <p className="text-white-50 small mb-3 mb-lg-2">
                              Click a row to open the command dialog (same controls as the operator workspace).
                            </p>
                            <div className="table-responsive legion-equipment-detail-points-wrap">
                              <table className="table bas-points-table legion-workspace-table align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th className="legion-workspace-th legion-workspace-th--narrow" scope="col">
                                      #
                                    </th>
                                    <th className="legion-workspace-th" scope="col">
                                      Point
                                    </th>
                                    <th className="legion-workspace-th" scope="col">
                                      Point description
                                    </th>
                                    <th className="legion-workspace-th" scope="col">
                                      Value
                                    </th>
                                    <th className="legion-workspace-th legion-workspace-th--mapped" scope="col">
                                      Mapped to
                                    </th>
                                    <th className="legion-workspace-th legion-workspace-th--narrow" scope="col">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayPoints.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="text-white-50 text-center py-4">
                                        No points defined. Add a template in Engineering and deploy a version.
                                      </td>
                                    </tr>
                                  ) : (
                                    displayPoints.map((p, index) => {
                                      const displayVal = detailPointTableValue(p, pointUiState);
                                      const oos = pointUiState[p.id]?.outOfService;
                                      const isOosText = displayVal === DETAIL_OOS_LABEL;
                                      return (
                                        <tr
                                          key={p.id || index}
                                          className="legion-workspace-row legion-equipment-detail-point-row"
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => openPointCommandModal(p)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openPointCommandModal(p);
                                            }
                                          }}
                                        >
                                          <td className="legion-workspace-td text-white-50">
                                            {String(index + 1).padStart(2, "0")}
                                          </td>
                                          <td className="legion-workspace-td legion-workspace-point text-white font-monospace">
                                            <span className="legion-workspace-point-label">{p.pointKey || p.pointId}</span>
                                          </td>
                                          <td className="legion-workspace-td text-white">
                                            {p.pointDescription || p.pointName || "—"}
                                          </td>
                                          <td className="legion-workspace-td text-white">
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                              <span
                                                className={`mini-dot ${
                                                  p.status === "OFFLINE"
                                                    ? "offline"
                                                    : p.status === "Unbound" || p.status === "Pending" || oos
                                                      ? "warn"
                                                      : ""
                                                }`}
                                              />
                                              <span
                                                className={
                                                  isOosText ? "legion-workspace-value--oos" : undefined
                                                }
                                              >
                                                {displayVal}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="legion-workspace-td legion-workspace-td--mapped text-white-50 small">
                                            <div
                                              className="legion-workspace-mapped-scroll"
                                              title={
                                                p.mappedToLabel && p.mappedToLabel !== "—"
                                                  ? p.mappedToLabel
                                                  : undefined
                                              }
                                            >
                                              {p.mappedToLabel ?? "—"}
                                            </div>
                                          </td>
                                          <td className="legion-workspace-td legion-workspace-td--status">
                                            <StatusDotLabel
                                              value={
                                                p.status === "OK"
                                                  ? "online"
                                                  : p.status === "OFFLINE"
                                                    ? "offline"
                                                    : p.status === "Pending"
                                                      ? "pending"
                                                      : p.status === "Unbound"
                                                        ? "unbound"
                                                        : "offline"
                                              }
                                              kind="status"
                                              dotOnly={["ok", "normal", "online"].includes(
                                                (p.status || "").toLowerCase()
                                              )}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })
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
                                    <th className="col-key" scope="col">
                                      Field
                                    </th>
                                    <th className="col-val" scope="col">
                                      Value
                                    </th>
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

      <Modal
        centered
        show={showCommandModal}
        onHide={closeCommandModal}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header closeButton closeVariant="white" className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Point command</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-white">
          {commandModalRow && (
            <>
              <div className="mb-3 small">
                <div className="text-white fw-semibold">{displayName}</div>
                <div className="text-white-50">
                  {commandModalRow.pointKey || commandModalRow.pointId}
                  {(commandModalRow.pointDescription || commandModalRow.pointName) &&
                  (commandModalRow.pointKey || commandModalRow.pointId) !==
                    (commandModalRow.pointDescription || commandModalRow.pointName) ? (
                    <span> — {commandModalRow.pointDescription || commandModalRow.pointName}</span>
                  ) : null}
                </div>
              </div>
              <Form.Group>
                <Form.Label className="text-white small">
                  {modalProfile.readOnlySensorUi
                    ? "Service state"
                    : modalProfile.mode === "typed" && modalProfile.commandType === "percentage"
                      ? "Command (%)"
                      : modalProfile.mode === "typed" && modalProfile.commandType === "numeric"
                        ? "Command (numeric)"
                        : modalProfile.mode === "typed" && modalProfile.commandType === "enum"
                          ? "Command (select state)"
                          : "Command"}
                </Form.Label>
                {modalProfile.mode === "mixed" && (
                  <p className="small text-warning mb-2">
                    This point has an ambiguous profile. Use raw text below or check the template in Engineering.
                  </p>
                )}
                {modalProfile.mode === "generic" && modalProfile.hint && (
                  <p className="small text-white-50 mb-2">{modalProfile.hint}</p>
                )}
                {modalProfile.mode === "typed" && commandApplyDisabled && (
                  <p className="small text-warning mb-2">
                    This point is offline, unbound, or not OK. Command input is disabled.
                  </p>
                )}
                {modalProfile.readOnlySensorUi ? (
                  <div className="legion-service-state-options" role="radiogroup" aria-label="Service state">
                    <button
                      type="button"
                      className={`legion-service-state-option ${
                        serviceStateChoice === "in_service" ? "legion-service-state-option--active" : ""
                      }`}
                      onClick={() => setServiceStateChoice("in_service")}
                      role="radio"
                      aria-checked={serviceStateChoice === "in_service"}
                    >
                      <div className="legion-service-state-option__title">In service</div>
                      <p className="legion-service-state-option__hint">
                        Show the live value from the device for this point.
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`legion-service-state-option ${
                        serviceStateChoice === "out_of_service" ? "legion-service-state-option--active" : ""
                      }`}
                      onClick={() => setServiceStateChoice("out_of_service")}
                      role="radio"
                      aria-checked={serviceStateChoice === "out_of_service"}
                    >
                      <div className="legion-service-state-option__title">Out of service</div>
                      <p className="legion-service-state-option__hint">
                        Display &quot;Out Of Service&quot; in the table and graphic instead of the live reading.
                      </p>
                    </button>
                  </div>
                ) : modalProfile.mode === "typed" ? (
                  <OperatorPointCommandField
                    commandType={modalProfile.commandType}
                    commandConfig={modalProfile.commandConfig}
                    value={commandValue}
                    onChange={setCommandValue}
                    disabled={commandApplyDisabled}
                    idSuffix="detail"
                  />
                ) : (
                  <Form.Control
                    className="bg-dark border border-light border-opacity-10 text-white"
                    placeholder="Enter command (raw)…"
                    value={typeof commandValue === "string" ? commandValue : String(commandValue ?? "")}
                    onChange={(e) => setCommandValue(e.target.value)}
                  />
                )}
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10 d-flex flex-wrap gap-2 justify-content-between">
          <Button
            variant="outline-light"
            className="border-opacity-10"
            onClick={() => {
              if (commandModalRow) setAlarmModalRow(commandModalRow);
              setShowAlarmModal(true);
            }}
          >
            Alarm
          </Button>
          <div className="d-flex gap-2 ms-auto">
            <Button variant="secondary" onClick={closeCommandModal}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCommandModalApply} disabled={commandApplyDisabled}>
              Apply
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <OperatorAlarmConfigModal
        show={showAlarmModal}
        onHide={() => {
          setShowAlarmModal(false);
          setAlarmModalRow(null);
        }}
        siteId={alarmSiteId}
        equipmentId={equipment?.id}
        row={alarmModalRow}
        activeReleaseData={releaseData}
        onSaved={() => {}}
      />
    </Container>
  );
}
