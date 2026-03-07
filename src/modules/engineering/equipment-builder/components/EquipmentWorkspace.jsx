import React, { useMemo } from "react";
import { Form, InputGroup } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faSearch,
  faFolder,
  faWind,
  faFan,
  faSnowflake,
  faWater,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { EQUIPMENT_GROUPS } from "../../data/mockEngineeringData";

const GROUP_ICONS = {
  ahus: faWind,
  vavs: faFan,
  fcus: faSnowflake,
  "chiller-plant": faSnowflake,
  pumps: faWater,
  "exhaust-fans": faExclamationTriangle,
};

const STATUS_CHIP_CLASS = {
  MISSING_CONTROLLER: "equipment-status-chip equipment-status-chip--warning",
  READY_FOR_MAPPING: "equipment-status-chip equipment-status-chip--success",
  DRAFT: "equipment-status-chip equipment-status-chip--muted",
  NEEDS_TEMPLATE: "equipment-status-chip equipment-status-chip--warning",
  CONTROLLER_ASSIGNED: "equipment-status-chip equipment-status-chip--success",
};

function formatStatus(status) {
  if (!status) return "Draft";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Left panel: Equipment Workspace with grouped equipment table.
 * Matches Site Hierarchy card structure and styling from Site Builder.
 */
export default function EquipmentWorkspace({
  site,
  building,
  equipment,
  filterQuery,
  onFilterChange,
  expandedGroups,
  onToggleGroup,
  selectedId,
  onSelectEquipment,
}) {
  const floorsById = useMemo(() => {
    const map = {};
    (building?.floors || []).forEach((f) => {
      map[f.id] = f.name;
    });
    return map;
  }, [building]);

  const filteredAndGrouped = useMemo(() => {
    const q = (filterQuery || "").toLowerCase().trim();
    const filtered = q
      ? equipment.filter(
          (eq) =>
            (eq.name || "").toLowerCase().includes(q) ||
            (eq.type || "").toLowerCase().includes(q) ||
            (eq.locationLabel || "").toLowerCase().includes(q) ||
            (eq.controllerRef || "").toLowerCase().includes(q) ||
            (eq.templateName || "").toLowerCase().includes(q)
        )
      : equipment;

    const byGroup = {};
    EQUIPMENT_GROUPS.forEach((g) => {
      byGroup[g.id] = filtered.filter((eq) => eq.equipmentGroup === g.id);
    });
    return byGroup;
  }, [equipment, filterQuery]);

  const hasAnyMatches = Object.values(filteredAndGrouped).some((arr) => arr.length > 0);

  return (
    <div className="equipment-workspace-content">
      {/* Filter */}
      <div className="px-3 pt-2 pb-2 border-bottom border-light border-opacity-10">
        <InputGroup size="sm" className="legion-search-bar">
          <InputGroup.Text className="legion-search-bar-addon">
            <FontAwesomeIcon icon={faSearch} />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Filter equipment..."
            className="legion-search-bar-input"
            value={filterQuery || ""}
            onChange={(e) => onFilterChange?.(e.target.value)}
          />
        </InputGroup>
      </div>

      {/* Site/Building context */}
      {site && building && (
        <div className="px-3 py-2 border-bottom border-light border-opacity-10">
          <div className="text-white-50 small fw-semibold">{site.name}</div>
          <div className="text-white-50 small">{building.name}</div>
        </div>
      )}

      {/* Grouped equipment - wrapped in site-builder-tree for consistent styling */}
      <div className="legion-equipment-tree site-builder-tree equipment-workspace-groups">
          {EQUIPMENT_GROUPS.map((group) => {
            const items = filteredAndGrouped[group.id] || [];
            if (items.length === 0 && filterQuery) return null;

            const isExpanded = expandedGroups?.has?.(group.id) ?? true;
            const Icon = GROUP_ICONS[group.id] || faFolder;

            return (
              <div key={group.id} className="equipment-group">
                <div
                  className={`equipment-group-header site-tree-row ${isExpanded ? "equipment-group-header--expanded" : ""}`}
                  onClick={() => onToggleGroup?.(group.id)}
                >
                  <span className="site-tree-caret">
                    <FontAwesomeIcon
                      icon={isExpanded ? faChevronDown : faChevronRight}
                      className="fa-sm"
                    />
                  </span>
                  <span className="site-tree-icon">
                    <FontAwesomeIcon icon={Icon} className="fa-sm" />
                  </span>
                  <span className="site-tree-name-wrap">
                    <span className="site-tree-name">{group.label}</span>
                    <span className="equipment-group-badge">{items.length}</span>
                  </span>
                </div>

                {isExpanded && items.length > 0 && (
                  <div className="site-tree-children equipment-group-table">
                    <div className="equipment-table-header">
                      <span>Equipment</span>
                      <span>Location</span>
                      <span>Controller</span>
                      <span>Point Template</span>
                      <span>Points</span>
                      <span>Status</span>
                    </div>
                    {items.map((eq) => {
                      const isSelected = selectedId === eq.id;
                      const controllerDisplay = eq.controllerRef
                        ? `${eq.protocol || "BACnet/IP"}: ${eq.controllerRef}`
                        : "—";
                      const statusClass = STATUS_CHIP_CLASS[eq.status] || "equipment-status-chip equipment-status-chip--muted";

                      return (
                        <div
                          key={eq.id}
                          className={`equipment-table-row site-tree-row ${isSelected ? "site-tree-row--active" : ""}`}
                          onClick={() => onSelectEquipment?.(eq)}
                        >
                          <span className="equipment-col-name">
                            <FontAwesomeIcon icon={faFolder} className="fa-xs me-1 text-white-50" />
                            {eq.name}
                          </span>
                          <span className="equipment-col-location">{eq.locationLabel || floorsById[eq.floorId] || "—"}</span>
                          <span className="equipment-col-controller">{controllerDisplay}</span>
                          <span className="equipment-col-template">{eq.templateName || "—"}</span>
                          <span className="equipment-col-points">{eq.pointsDefined ?? 0}</span>
                          <span className={statusClass}>{formatStatus(eq.status)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isExpanded && items.length === 0 && !filterQuery && (
                  <div className="equipment-group-empty text-white-50 small px-3 py-2">
                    No equipment in this group
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {filterQuery && !hasAnyMatches && (
        <div className="text-center text-white-50 small py-4 px-3">
          No equipment matches &quot;{filterQuery}&quot;
        </div>
      )}
    </div>
  );
}
