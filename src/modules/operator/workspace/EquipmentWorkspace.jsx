import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Modal, Button } from "react-bootstrap";
import { getEquipmentFromRelease, resolveEquipmentLocationInRelease } from "../../../lib/activeReleaseUtils";
import {
  EQUIPMENT_OOS_LABEL,
  equipmentPointDisplayValue,
  useEquipmentLivePoints,
} from "../../../hooks/useEquipmentLivePoints";
import { operatorRepository, operatorDefinitionsRepository, accessRepository } from "../../../lib/data";
import {
  findOccupancyPoint,
  resolveEquipmentOccupancy,
} from "../../../lib/operator/equipmentOccupancy";
import {
  getCommandProfileForRows,
  getInitialCommandValue,
  formatCommandValueForDisplay,
  OperatorPointCommandField,
} from "../equipment/OperatorPointCommandField";
import EquipmentHeader from "./EquipmentHeader";
import EquipmentWorkspaceTabs from "./EquipmentWorkspaceTabs";
import EquipmentGraphicCard from "./EquipmentGraphicCard";
import EquipmentTrendsCard from "./EquipmentTrendsCard";
import EquipmentPointsCard from "./EquipmentPointsCard";
import EquipmentDetailsCard from "./EquipmentDetailsCard";
import EquipmentNetworkCard from "./EquipmentNetworkCard";
import EquipmentPlaceholderCard from "./EquipmentPlaceholderCard";
import EquipmentAlarmWorkspace from "./EquipmentAlarmWorkspace";
import EquipmentOccupancyWorkspace from "./EquipmentOccupancyWorkspace";
import EquipmentTrendWorkspace from "./EquipmentTrendWorkspace";
import { locationForFacilityNode } from "../../../lib/operator/operatorSelection";
import { countActiveAlarmsForEquipment } from "../../../lib/operator/pointAlarms";

export default function EquipmentWorkspace({
  releaseData,
  tree,
  selectedNode,
  siteKey,
  onSelectNode,
  siteAlarms = [],
}) {
  const navigate = useNavigate();
  const equipment = useMemo(
    () => (releaseData && selectedNode?.id ? getEquipmentFromRelease(releaseData, selectedNode.id) : null),
    [releaseData, selectedNode]
  );

  const currentUser = useMemo(() => {
    try {
      return accessRepository.getCurrentUserForAccess();
    } catch {
      return null;
    }
  }, []);

  const live = useEquipmentLivePoints({
    equipment,
    releaseData,
    siteId: siteKey,
  });

  const [expandedId, setExpandedId] = useState(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState("overview");
  const [schedules, setSchedules] = useState([]);
  const [scheduleLoadError, setScheduleLoadError] = useState("");
  const [commandModalRow, setCommandModalRow] = useState(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [alarmModalRow, setAlarmModalRow] = useState(null);
  const [commandValue, setCommandValue] = useState("");
  const [serviceStateChoice, setServiceStateChoice] = useState("in_service");

  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const location = useMemo(
    () => (equipment ? resolveEquipmentLocationInRelease(releaseData, equipment.id) : null),
    [releaseData, equipment]
  );

  useEffect(() => {
    let active = true;
    setSchedules([]);
    const refreshSchedules = () => {
      operatorDefinitionsRepository.fetchSchedules(siteKey).then((rows) => { if (active) { setSchedules(rows); setScheduleLoadError(""); } }).catch((error) => { if (active) setScheduleLoadError(error.message); });
      setClockTick(Date.now());
    };
    refreshSchedules();
    window.addEventListener("storage", refreshSchedules);
    return () => { active = false; window.removeEventListener("storage", refreshSchedules); };
  }, [siteKey]);

  const occupancy = useMemo(() => {
    const occPoint = findOccupancyPoint(live.displayPoints);
    const occupancyPointValue = occPoint
      ? equipmentPointDisplayValue(occPoint, live.pointUiState)
      : null;
    const override = operatorRepository.getOccupancyOverride(siteKey, equipment?.id);
    return resolveEquipmentOccupancy({
      schedules,
      equipment,
      now: new Date(clockTick),
      occupancyPointValue,
      override,
    });
  }, [siteKey, equipment, clockTick, live.displayPoints, live.pointUiState, schedules]);

  const alarmCount = useMemo(
    () => countActiveAlarmsForEquipment(siteAlarms, equipment?.id),
    [siteAlarms, equipment?.id]
  );

  const graphic = useMemo(() => {
    if (!releaseData || !releaseData.graphics || !equipment) return null;
    return releaseData.graphics[equipment.id] || null;
  }, [releaseData, equipment]);

  const openPointCommandModal = useCallback(
    (row) => {
      if (!row) {
        const first = live.displayPoints[0];
        if (!first) return;
        row = first;
      }
      setCommandModalRow(row);
      setShowCommandModal(true);
      const profile = getCommandProfileForRows([row]);
      const u = live.pointUiState[row.id];
      if (profile.mode === "typed") {
        setCommandValue(u?.pendingRaw !== undefined ? u.pendingRaw : getInitialCommandValue([row], profile));
      } else {
        setCommandValue("");
      }
      if (profile.readOnlySensorUi) {
        setServiceStateChoice(u?.outOfService ? "out_of_service" : "in_service");
      } else {
        setServiceStateChoice("in_service");
      }
    },
    [live.displayPoints, live.pointUiState]
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
      live.patchPointUi(row.id, {
        outOfService: oos,
        ...(oos ? {} : { pendingDisplay: undefined, pendingRaw: undefined }),
      });
    } else if (profile.mode === "typed") {
      live.patchPointUi(row.id, {
        outOfService: false,
        pendingRaw: commandValue,
        pendingDisplay: formatCommandValueForDisplay(
          profile.commandType,
          commandValue,
          profile.commandConfig
        ),
      });
    } else {
      live.patchPointUi(row.id, {
        pendingDisplay: String(commandValue ?? ""),
        pendingRaw: commandValue,
      });
    }
    closeCommandModal();
  }, [commandModalRow, commandValue, serviceStateChoice, live, closeCommandModal]);

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type) return;
    if (linkTarget.type === "equipment" && linkTarget.id) {
      if (onSelectNode) onSelectNode({ kind: "equipment", id: String(linkTarget.id) });
    } else if (linkTarget.type === "layout" && linkTarget.id) {
      if (onSelectNode) onSelectNode({ kind: "floor", id: String(linkTarget.id) });
    } else if (linkTarget.type === "url" && linkTarget.url) {
      window.open(linkTarget.url, "_blank", "noopener,noreferrer");
    } else if (linkTarget.type === "route" && linkTarget.path) {
      navigate(linkTarget.path);
    }
  };

  const modalProfile = commandModalRow ? getCommandProfileForRows([commandModalRow]) : { mode: "empty" };
  const commandApplyDisabled = modalProfile.mode === "typed" && modalProfile.allOperational === false;
  const displayName = equipment?.displayLabel || equipment?.name || "Equipment";

  if (!equipment) {
    return (
      <div className="operator-placeholder">
        <h1>Equipment not found</h1>
        <p>It may not be in the active release for this site, or the reference may be invalid.</p>
        <button
          type="button"
          className="operator-btn"
          onClick={() => navigate(locationForFacilityNode({ kind: "site", id: tree?.id }))}
        >
          Back to site
        </button>
      </div>
    );
  }

  const detailsExtras = {
    commHeadline: live.commHeadline,
    lastSeenAt: live.lastSeen,
    controllerCode: live.persistedDbController?.controllerCode,
    protocol: live.runtimeForEquipment?.protocol || live.persistedDbController?.protocol,
  };
  const backToOverview = () => setActiveTab("overview");

  return (
    <div className={`equipment-workspace${expandedId ? ` is-expanded-${expandedId}` : ""}`}>
      {scheduleLoadError ? <div role="alert" className="alert alert-warning">Schedules could not be loaded: {scheduleLoadError}</div> : null}
      <EquipmentHeader
        tree={tree}
        selectedNode={selectedNode}
        equipment={equipment}
        location={location}
        commHeadline={live.commHeadline}
        alarmCount={alarmCount}
      />
      <EquipmentWorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="equipment-workspace__grid">
          <EquipmentGraphicCard
            graphic={graphic}
            points={live.pointsForGraphic}
            onLinkClick={handleGraphicLinkClick}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
          />
          <EquipmentTrendsCard onConfigure={() => setActiveTab("trends")}
            siteKey={siteKey}
            equipmentId={equipment.id}
            displayPoints={live.displayPoints}
            now={live.nowTick}
            pollRateMs={live.pollMs}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
          />
          <EquipmentPointsCard
            displayPoints={live.displayPoints}
            pointUiState={live.pointUiState}
            onSelectPoint={openPointCommandModal}
            currentUser={currentUser}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
            alarms={siteAlarms}
            equipmentId={equipment.id}
          />
          <EquipmentDetailsCard
            releaseData={releaseData}
            equipment={equipment}
            graphic={graphic}
            extras={detailsExtras}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
          />
        </div>
      )}

      {activeTab === "points" && (
        <div className="equipment-workspace__single">
          <EquipmentPointsCard
            displayPoints={live.displayPoints}
            pointUiState={live.pointUiState}
            onSelectPoint={openPointCommandModal}
            currentUser={currentUser}
            expandedId="points"
            onToggleExpand={backToOverview}
            alarms={siteAlarms}
            equipmentId={equipment.id}
          />
        </div>
      )}

      {activeTab === "graphics" && (
        <div className="equipment-workspace__single">
          <EquipmentGraphicCard
            graphic={graphic}
            points={live.pointsForGraphic}
            onLinkClick={handleGraphicLinkClick}
            expandedId="graphic"
            onToggleExpand={backToOverview}
          />
        </div>
      )}

      {activeTab === "network" && (
        <div className="equipment-workspace__single">
          <EquipmentNetworkCard
            releaseData={releaseData}
            equipment={equipment}
            graphic={graphic}
            extras={detailsExtras}
            expandedId="network"
            onToggleExpand={backToOverview}
          />
        </div>
      )}

      {activeTab === "alarms" && (
        <div className="equipment-workspace__single">
          <EquipmentAlarmWorkspace
            equipment={equipment}
            points={live.displayPoints}
            alarms={siteAlarms}
            releaseData={releaseData}
            siteKey={siteKey}
            initialPoint={alarmModalRow}
            onBack={backToOverview}
          />
        </div>
      )}

      {activeTab === "trends" && (
        <div className="equipment-workspace__single">
          <EquipmentTrendWorkspace
            equipment={equipment}
            releaseData={releaseData}
            siteKey={siteKey}
            onBack={backToOverview}
          />
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="equipment-workspace__single">
          <EquipmentOccupancyWorkspace
            equipment={equipment}
            schedules={schedules}
            occupancy={occupancy}
            currentUser={currentUser}
            now={new Date(clockTick)}
            siteKey={siteKey}
            onBack={backToOverview}
            onSchedulesChange={(next) => { setSchedules(next || []); setClockTick(Date.now()); }}
          />
        </div>
      )}

      {activeTab === "logic" && (
        <div className="equipment-workspace__single">
          <EquipmentPlaceholderCard
            title="Logic"
            message="Logic configuration is not available yet."
            onToggleExpand={backToOverview}
          />
        </div>
      )}

      {activeTab === "files" && (
        <div className="equipment-workspace__single">
          <EquipmentPlaceholderCard
            title="Files"
            message="File attachments are not available yet."
            onToggleExpand={backToOverview}
          />
        </div>
      )}

      <Modal
        centered
        show={showCommandModal}
        onHide={closeCommandModal}
        contentClassName="operator-bootstrap-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title className="h6">Point command</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {commandModalRow && (
            <>
              <div className="mb-3 small">
                <div className="fw-semibold">{displayName}</div>
                <div className="text-muted">
                  {commandModalRow.pointKey || commandModalRow.pointId}
                  {commandModalRow.pointDescription ? ` — ${commandModalRow.pointDescription}` : ""}
                </div>
              </div>
              <Form.Group>
                <Form.Label className="small">
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
                      <p className="legion-service-state-option__hint">Show the live value from the device.</p>
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
                        Display &quot;{EQUIPMENT_OOS_LABEL}&quot; instead of the live reading.
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
                    idSuffix="operator-ws"
                  />
                ) : (
                  <Form.Control
                    placeholder="Enter command (raw)…"
                    value={typeof commandValue === "string" ? commandValue : String(commandValue ?? "")}
                    onChange={(e) => setCommandValue(e.target.value)}
                  />
                )}
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex flex-wrap gap-2 justify-content-between">
            <Button
              variant="outline-secondary"
              onClick={() => {
              if (commandModalRow) setAlarmModalRow(commandModalRow);
              setShowCommandModal(false);
              setActiveTab("alarms");
              }}
          >
              Configure Alarm
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

    </div>
  );
}
