import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import StatusIndicator from "../../../components/legion/StatusIndicator";
import OperatorAlarmBell from "../../../components/legion/OperatorAlarmBell";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import { getEquipmentTypeLabel } from "../../engineering/equipment-builder/equipmentTypes";
import OperatorBreadcrumbs from "./OperatorBreadcrumbs";
import EquipmentOccupancyChip from "./EquipmentOccupancyChip";

export default function EquipmentHeader({
  tree,
  selectedNode,
  equipment,
  location,
  commHeadline,
  occupancy,
  onOpenSchedule,
  onOpenAlarms,
  onOpenTrends,
  configuredTrendCount = 0,
  alarmCount = 0,
  configuredAlarmCount = 0,
}) {
  const name = equipment?.displayLabel || equipment?.name || selectedNode?.label || "Equipment";
  const typeCode = equipment?.type || equipment?.equipmentType || "";
  const typeLabel =
    equipment?.description ||
    getEquipmentTypeLabel(typeCode) ||
    typeCode ||
    "Equipment";
  const floor = location?.floorName || equipment?.locationLabel || "";
  const building = location?.buildingName || "";
  const status = commHeadline || equipment?.status || "UNKNOWN";
  const statusLabel =
    status === "LIVE" || status === "ONLINE" || String(status).toLowerCase() === "online"
      ? "Online"
      : status === "STALE"
        ? "Stale"
        : status === "OFFLINE"
          ? "Offline"
          : status;

  const meta = [];
  if (typeLabel) meta.push(typeLabel);
  if (floor && floor !== "—") meta.push(floor);
  if (building && building !== "—" && building !== floor) meta.push(building);
  if (typeCode && typeCode !== typeLabel) meta.push(typeCode);

  return (
    <header className="equipment-header">
      <OperatorBreadcrumbs tree={tree} selectedNode={selectedNode} />
      <div className="equipment-header__top">
        <div className="equipment-header__row">
          <span className="equipment-header__icon" aria-hidden="true">
            <FacilityKindIcon kind="equipment" />
          </span>
          <div>
            <div className="equipment-header__title-row">
              <h1 className="workspace-header__title">{name}</h1>
              <StatusIndicator status={status} label={statusLabel} />
              {alarmCount > 0 ? (
                <OperatorAlarmBell />
              ) : null}
            </div>
            <p className="workspace-header__meta">
              {meta.map((item, i) => (
                <React.Fragment key={`${item}-${i}`}>
                  {i > 0 ? (
                    <span className="workspace-header__dot" aria-hidden="true">
                      |
                    </span>
                  ) : null}
                  <span>{item}</span>
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
        <div className="equipment-header__utilities">
          <EquipmentOccupancyChip occupancy={occupancy} onOpen={onOpenSchedule} />
          <button type="button" className="equipment-trend-chip" onClick={onOpenTrends} aria-label={`Trends ${configuredTrendCount} configured. Open trends workspace.`}><span className="equipment-trend-chip__icon" aria-hidden="true">↗</span><span className="equipment-trend-chip__copy"><span className="equipment-trend-chip__label">TRENDS</span><strong>{configuredTrendCount} Configured</strong></span></button>
          <button type="button" className={`equipment-alarm-chip${alarmCount > 0 ? " equipment-alarm-chip--active" : ""}`} onClick={onOpenAlarms} aria-label={`Alarms ${alarmCount} active. Open alarm logic workspace.`}>
            <span className="equipment-alarm-chip__icon" aria-hidden="true"><FontAwesomeIcon icon={faBell} /></span>
            <span className="equipment-alarm-chip__copy"><span className="equipment-alarm-chip__label">Alarms</span><strong>{alarmCount} Active</strong></span>
          </button>
        </div>
      </div>
    </header>
  );
}
