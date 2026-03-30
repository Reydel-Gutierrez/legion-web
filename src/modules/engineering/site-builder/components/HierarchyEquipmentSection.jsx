import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder, faGripVertical, faCopy } from "@fortawesome/free-solid-svg-icons";

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

function SortableHeader({ field, label, title, canSort, nextDir, onSort }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (!canSort) return;
    onSort(field, nextDir);
  };
  const handleKeyDown = (e) => {
    if (!canSort) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSort(field, nextDir);
    }
  };
  return (
    <span
      role={canSort ? "button" : undefined}
      tabIndex={canSort ? 0 : undefined}
      className={
        canSort
          ? "hierarchy-equipment-header-cell hierarchy-equipment-header-cell--sortable"
          : "hierarchy-equipment-header-cell"
      }
      title={canSort ? title : undefined}
      onClick={canSort ? handleClick : undefined}
      onKeyDown={canSort ? handleKeyDown : undefined}
    >
      {label}
    </span>
  );
}

/**
 * Equipment section under a floor in the Site Builder hierarchy.
 * Drag reorder; sortable headers: Equipment, Address #, Instance #.
 */
export default function HierarchyEquipmentSection({
  floorId,
  equipment = [],
  selectedEquipmentId,
  onSelectEquipment,
  compact = false,
  onReorderEquipment,
  onSortFloorEquipment,
  onDuplicateEquipment,
}) {
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [nextSortDir, setNextSortDir] = useState({
    name: "asc",
    address: "asc",
    instanceNumber: "asc",
  });

  if (!equipment?.length) return null;

  const canReorder = typeof onReorderEquipment === "function";
  const canSort = typeof onSortFloorEquipment === "function";
  const canDuplicate = typeof onDuplicateEquipment === "function";

  const applySort = (field, direction) => {
    if (!canSort) return;
    onSortFloorEquipment(floorId, { field, direction });
    setNextSortDir((prev) => ({ ...prev, [field]: direction === "asc" ? "desc" : "asc" }));
  };

  const handleDragStart = (e, eq) => {
    if (!canReorder) return;
    e.stopPropagation();
    setDraggingId(eq.id);
    try {
      e.dataTransfer.setData("text/plain", eq.id);
      e.dataTransfer.effectAllowed = "move";
    } catch {
      /* ignore */
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e, eqId) => {
    if (!canReorder || !draggingId || draggingId === eqId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(eqId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e, targetId) => {
    if (!canReorder) return;
    e.preventDefault();
    e.stopPropagation();
    let draggedId = draggingId;
    try {
      const fromData = e.dataTransfer.getData("text/plain");
      if (fromData) draggedId = fromData;
    } catch {
      /* ignore */
    }
    setDragOverId(null);
    setDraggingId(null);
    if (!draggedId || draggedId === targetId) return;
    onReorderEquipment(floorId, draggedId, targetId);
  };

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
        <span className="hierarchy-equipment-header-drag" aria-hidden="true" />
        <SortableHeader
          field="name"
          label="Equipment"
          title="Sort by equipment name (A–Z, then Z–A)"
          canSort={canSort}
          nextDir={nextSortDir.name}
          onSort={applySort}
        />
        <SortableHeader
          field="address"
          label="Address #"
          title="Sort by address # (A–Z, then Z–A)"
          canSort={canSort}
          nextDir={nextSortDir.address}
          onSort={applySort}
        />
        <SortableHeader
          field="instanceNumber"
          label="Instance #"
          title="Sort by instance # (A–Z, then Z–A)"
          canSort={canSort}
          nextDir={nextSortDir.instanceNumber}
          onSort={applySort}
        />
        <span className="hierarchy-equipment-header-cell">Controller</span>
        <span className="hierarchy-equipment-header-cell">Point Template</span>
        <span className="hierarchy-equipment-header-cell">Points Defined</span>
        <span className="hierarchy-equipment-header-cell">Status</span>
      </div>
      {equipment.map((eq) => {
        const isSelected = selectedEquipmentId === eq.id;
        const controllerDisplay = eq.controllerRef
          ? `${eq.protocol || "BACnet/IP"}: ${eq.controllerRef}`
          : "—";
        const statusClass =
          STATUS_CHIP_CLASS[eq.status] || "hierarchy-equipment-status-chip hierarchy-equipment-status-chip--muted";
        const isDragOver = dragOverId === eq.id && draggingId && draggingId !== eq.id;

        return (
          <div
            key={eq.id}
            role="row"
            className={`hierarchy-equipment-row ${isSelected ? "site-tree-row--active" : ""} ${
              draggingId === eq.id ? "hierarchy-equipment-row--dragging" : ""
            } ${isDragOver ? "hierarchy-equipment-row--drag-over" : ""}`}
            onClick={() => onSelectEquipment?.(eq)}
            onDragOver={(e) => handleDragOver(e, eq.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, eq.id)}
          >
            <span
              className="hierarchy-equipment-col-drag"
              draggable={canReorder}
              onDragStart={(e) => handleDragStart(e, eq)}
              onDragEnd={handleDragEnd}
              onClick={(e) => e.stopPropagation()}
              title={canReorder ? "Drag to reorder" : undefined}
            >
              {canReorder && (
                <FontAwesomeIcon icon={faGripVertical} className="fa-sm text-white-50 hierarchy-equipment-drag-icon" />
              )}
            </span>
            <span className="hierarchy-equipment-col-name">
              <FontAwesomeIcon icon={faFolder} className="fa-xs me-1 text-white-50" />
              {eq.name}
              {canDuplicate && (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-white-50 p-0 ms-2 hierarchy-equipment-duplicate-btn"
                  title="Duplicate equipment"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateEquipment(eq.id);
                  }}
                >
                  <FontAwesomeIcon icon={faCopy} className="fa-xs" />
                </button>
              )}
            </span>
            <span className="hierarchy-equipment-col-address text-break">{eq.address || "—"}</span>
            <span className="hierarchy-equipment-col-instance">{eq.instanceNumber ?? "—"}</span>
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
