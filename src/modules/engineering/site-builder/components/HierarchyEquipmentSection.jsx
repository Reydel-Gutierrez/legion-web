import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";

const STATUS_CHIP_CLASS = {
  MISSING_CONTROLLER: "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--warning",
  READY_FOR_MAPPING: "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--success",
  DRAFT: "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--muted",
  NEEDS_TEMPLATE: "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--warning",
  CONTROLLER_ASSIGNED: "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--success",
};

function formatStatus(status) {
  if (!status) return "Draft";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Equipment section under a floor in the Site Builder hierarchy.
 * Renders clickable equipment rows. When compact=true (e.g. Graphics Manager), only equipment names are shown.
 * Otherwise shows full metadata (Equipment, Location, Controller, Point Template, Points Defined, Status).
 */
export default function HierarchyEquipmentSection({
  equipment = [],
  selectedEquipmentId,
  onSelectEquipment,
  compact = false,
}) {
  if (!equipment?.length) return null;

  if (compact) {
    return (
      <div className="hierarchy-equipment-section hierarchy-equipment-section--compact">
        {equipment.map((eq) => {
          const isSelected = selectedEquipmentId === eq.id;
          return (
            <div
              key={eq.id}
              className={`hierarchy-equipment-row hierarchy-equipment-row--compact ${isSelected ? "site-tree-row--active" : ""}`}
              onClick={() => onSelectEquipment?.(eq)}
            >
              <span className="hierarchy-equipment-col-name">
                <FontAwesomeIcon icon={faFolder} className="fa-xs me-1 text-white-50" />
                {eq.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hierarchy-equipment-section">
      <div className="hierarchy-equipment-header">
        <span>Equipment</span>
        <span>Location</span>
        <span>Controller</span>
        <span>Point Template</span>
        <span>Points Defined</span>
        <span>Status</span>
      </div>
      {equipment.map((eq) => {
        const isSelected = selectedEquipmentId === eq.id;
        const controllerDisplay = eq.controllerRef
          ? `${eq.protocol || "BACnet/IP"}: ${eq.controllerRef}`
          : "—";
        const statusClass =
          STATUS_CHIP_CLASS[eq.status] || "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--muted";

        return (
          <div
            key={eq.id}
            className={`hierarchy-equipment-row ${isSelected ? "site-tree-row--active" : ""}`}
            onClick={() => onSelectEquipment?.(eq)}
          >
            <span className="hierarchy-equipment-col-name">
              <FontAwesomeIcon icon={faFolder} className="fa-xs me-1 text-white-50" />
              {eq.name}
            </span>
            <span className="hierarchy-equipment-col-location">{eq.locationLabel || "—"}</span>
            <span className="hierarchy-equipment-col-controller">{controllerDisplay}</span>
            <span className="hierarchy-equipment-col-template">{eq.templateName || "—"}</span>
            <span className="hierarchy-equipment-col-points">{eq.pointsDefined ?? 0}</span>
            <span className={statusClass}>{formatStatus(eq.status)}</span>
          </div>
        );
      })}
    </div>
  );
}
