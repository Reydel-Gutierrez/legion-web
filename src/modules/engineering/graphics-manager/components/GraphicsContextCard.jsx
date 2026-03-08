import React from "react";
import { Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup } from "@fortawesome/free-solid-svg-icons";
import SearchableEquipmentSelect from "../../point-mapping/components/SearchableEquipmentSelect";

const STATUS_CHIP_CLASS = {
  READY_FOR_MAPPING: "point-mapping-status-chip point-mapping-status-chip--success",
  CONTROLLER_ASSIGNED: "point-mapping-status-chip point-mapping-status-chip--success",
  MISSING_CONTROLLER: "point-mapping-status-chip point-mapping-status-chip--warning",
  NEEDS_TEMPLATE: "point-mapping-status-chip point-mapping-status-chip--warning",
  DRAFT: "point-mapping-status-chip point-mapping-status-chip--muted",
};

function formatStatus(status) {
  if (!status) return "Draft";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Context card for Graphics Manager - searchable equipment dropdown like Point Mapping.
 * Miami HQ / Tower A / Floor 1 / AHU-1 | Controller | Template | Status
 */
export default function GraphicsContextCard({
  equipment,
  equipmentList = [],
  onSelectEquipment,
}) {
  const showSelector = equipmentList.length > 0 && onSelectEquipment;

  if (!equipment && !showSelector) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
        <Card.Body className="py-4 text-center text-white-50">
          <FontAwesomeIcon icon={faObjectGroup} className="fa-2x mb-2 opacity-50" />
          <div className="small">No equipment selected for graphics</div>
          <div className="small mt-1">Add equipment in Site Builder first</div>
        </Card.Body>
      </Card>
    );
  }

  if (!equipment && showSelector) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
        <Card.Body className="py-3">
          <span className="text-white-50 small me-2">Equipment:</span>
          <SearchableEquipmentSelect
            equipmentList={equipmentList}
            value=""
            onChange={(id) => onSelectEquipment && onSelectEquipment(id)}
            placeholder="Select equipment to create or edit graphics…"
          />
          <div className="text-white-50 small mt-2">Search by name, floor, or building to find equipment quickly.</div>
        </Card.Body>
      </Card>
    );
  }

  const breadcrumb = `${equipment.site} / ${equipment.building} / ${equipment.floor} / ${equipment.name}`;
  const controllerDisplay = equipment.controllerRef
    ? `${equipment.protocol || "BACnet/IP"}:${equipment.controllerRef}`
    : "—";
  const statusClass = STATUS_CHIP_CLASS[equipment.status] || "point-mapping-status-chip point-mapping-status-chip--muted";

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-3">
        <div className="mb-2">
          <span className="text-white-50 small me-2">Equipment:</span>
          <SearchableEquipmentSelect
            equipmentList={equipmentList}
            value={equipment?.id || ""}
            onChange={(id) => onSelectEquipment && onSelectEquipment(id)}
            placeholder="Select equipment to create or edit graphics…"
          />
        </div>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex align-items-center">
            <FontAwesomeIcon icon={faObjectGroup} className="text-white-50 me-2 fa-lg" />
            <div>
              <div className="text-white fw-bold">{breadcrumb}</div>
              <div className="text-white-50 small mt-0">
                Controller: {controllerDisplay}
                {equipment.templateName && (
                  <span className="ms-3">Template: {equipment.templateName}</span>
                )}
              </div>
            </div>
          </div>
          <div className="ms-auto">
            <span className={statusClass}>{formatStatus(equipment.status)}</span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
