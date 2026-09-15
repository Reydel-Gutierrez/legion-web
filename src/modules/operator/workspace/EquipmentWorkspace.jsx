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
import EquipmentGraphicCard from "./EquipmentGraphicCard";
import EquipmentTrendsCard from "./EquipmentTrendsCard";
import EquipmentPointsCard from "./EquipmentPointsCard";
import EquipmentDetailsCard from "./EquipmentDetailsCard";
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
  commandIntent,
  onCommandIntentHandled,
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
  const [workspaceMode, setWorkspaceMode] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [scheduleLoadError, setScheduleLoadError] = useState("");
  const [commandModalRow, setCommandModalRow] = useState(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [alarmModalRow, setAlarmModalRow] = useState(null);
  const [commandValue, setCommandValue] = useState("");
  const [serviceStateChoice, setServiceStateChoice] = useState("in_service");
  const [configuredAlarmCount, setConfiguredAlarmCount] = useState(0);
  const [configuredTrendCount, setConfiguredTrendCount] = useState(0);
  const trendEquipmentId = equipment ? equipment.id : null;
  useEffect(() => {
    let active = true;
    setConfiguredTrendCount(0);
    operatorDefinitionsRepository.fetchTrendStore(siteKey).then((store) => {
      if (active) setConfiguredTrendCount(store.assignments.filter((assignment) => assignment.enabled && String(assignment.assetId) === String(trendEquipmentId)).length);
    }).catch(() => {});
    return () => { active = false; };
  }, [siteKey, trendEquipmentId, workspaceMode]);

  const refreshAlarmCount = useCallback(async () => {
    if (!siteKey || !equipment?.id) return;
    try {
      const defs = await operatorRepository.listOperatorAlarmDefinitions(siteKey, { equipmentId: equipment.id });
      setConfiguredAlarmCount(Array.isArray(defs) ? defs.length : 0);
    } catch {
      setConfiguredAlarmCount(0);
    }
  }, [siteKey, equipment?.id]);

  useEffect(() => { refreshAlarmCount(); }, [refreshAlarmCount]);

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

  useEffect(() => {
    if (!commandIntent) return;
    if (commandIntent === "command" || commandIntent === "alarm") {
      const first = live.displayPoints[0];
      if (first) {
        if (commandIntent === "alarm") {
          setWorkspaceMode("alarms");
          setAlarmModalRow(first);
        } else {
          openPointCommandModal(first);
        }
      }
    }
    if (onCommandIntentHandled) onCommandIntentHandled();
  }, [commandIntent, live.displayPoints, openPointCommandModal, onCommandIntentHandled]);

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

  if (workspaceMode === "alarms") {
    return <EquipmentAlarmWorkspace equipment={equipment} points={live.displayPoints} alarms={siteAlarms} releaseData={releaseData} siteKey={siteKey} initialPoint={alarmModalRow} onBack={() => setWorkspaceMode(null)} onSaved={refreshAlarmCount} />;
  }
  if (workspaceMode === "occupancy") {
    return <EquipmentOccupancyWorkspace equipment={equipment} schedules={schedules} occupancy={occupancy} currentUser={currentUser} now={new Date(clockTick)} siteKey={siteKey} onBack={() => setWorkspaceMode(null)} onSchedulesChange={(next) => { setSchedules(next || []); setClockTick(Date.now()); }} />;
  }
  if (workspaceMode === "trends") {
    return <EquipmentTrendWorkspace equipment={equipment} releaseData={releaseData} siteKey={siteKey} onBack={() => setWorkspaceMode(null)} onSaved={() => setConfiguredTrendCount((count) => count + 1)} />;
  }

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

  return (
    <div className={`equipment-workspace${expandedId ? ` is-expanded-${expandedId}` : ""}`}>
      {scheduleLoadError ? <div role="alert" className="alert alert-warning">Schedules could not be loaded: {scheduleLoadError}</div> : null}
      <EquipmentHeader
        tree={tree}
        selectedNode={selectedNode}
        equipment={equipment}
        location={location}
        commHeadline={live.commHeadline}
        occupancy={occupancy}
        onOpenSchedule={() => setWorkspaceMode("occupancy")}
        onOpenAlarms={() => { setAlarmModalRow(null); setWorkspaceMode("alarms"); }}
        onOpenTrends={() => setWorkspaceMode("trends")}
        configuredTrendCount={configuredTrendCount}
        alarmCount={alarmCount}
        configuredAlarmCount={configuredAlarmCount}
      />
      {false && <div className="equipment-tool-strip">
        <button type="button" className="equipment-tool-card" onClick={() => setWorkspaceMode("occupancy")}><span>Occupancy</span><strong>{occupancy?.label || "Unoccupied"}</strong><small>{occupancy?.source === "override" ? "Temporary override" : "Open weekly schedule"}</small></button>
        <button type="button" className="equipment-tool-card equipment-tool-card--alarm" onClick={() => { setAlarmModalRow(null); setWorkspaceMode("alarms"); }}><span>Alarms</span><strong>{alarmCount} Active</strong><small>{configuredAlarmCount} Configured · Open logic workspace</small></button>
      </div>}
      <div className="equipment-workspace__grid">
        <EquipmentGraphicCard
          graphic={graphic}
          points={live.pointsForGraphic}
          onLinkClick={handleGraphicLinkClick}
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
        />
        <EquipmentTrendsCard onConfigure={() => setWorkspaceMode("trends")}
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
          extras={{
            commHeadline: live.commHeadline,
            lastSeenAt: live.lastSeen,
            controllerCode: live.persistedDbController?.controllerCode,
            protocol: live.runtimeForEquipment?.protocol || live.persistedDbController?.protocol,
          }}
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
        />
      </div>

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
              setWorkspaceMode("alarms");
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
