import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faBuilding,
  faCity,
  faLayerGroup,
  faPlus,
  faBoxOpen,
  faEdit,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import HierarchyEquipmentSection from "./HierarchyEquipmentSection";

const NODE_ICONS = {
  site: faCity,
  building: faBuilding,
  floor: faLayerGroup,
};

/**
 * Single node in the site hierarchy tree.
 * Supports expand/collapse, row actions (Add Child, Edit, Delete).
 * Hierarchy: Site → Building → Floor (Floor has no children)
 */
export default function SiteTreeNode({
  node,
  level = 0,
  expandedIds,
  selectedId,
  selectedEquipmentId,
  onToggleExpand,
  onSelect,
  onSelectEquipment,
  onAddChild,
  onAddEquipment,
  onEdit,
  onDelete,
}) {
  const { id, type, name, children = [], equipmentCount = 0, equipmentPreview = [] } = node;
  const hasEquipmentPreview = type === "floor" && equipmentPreview?.length > 0;
  const hasChildren = children.length > 0 || hasEquipmentPreview;
  const isExpanded = expandedIds?.has?.(id) ?? false;
  const isSelected = selectedId === id;
  const canAddChild =
    (type === "site" && true) ||
    (type === "building" && true) ||
    (type === "floor" && false);

  const canAddEquipment = type === "floor";

  const childType = type === "site" ? "building" : type === "building" ? "floor" : null;
  const addLabel = childType === "building" ? "Add Building" : childType === "floor" ? "Add Floor" : null;

  const Icon = NODE_ICONS[type] || faBuilding;
  const pad = 8 + level * 20;

  const handleRowClick = (e) => {
    if (e.target.closest(".site-tree-row-actions")) return;
    if (hasChildren && onToggleExpand) {
      onToggleExpand(id);
    }
    if (onSelect) {
      onSelect(node);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(node);
    }
  };

  return (
    <div className="site-tree-node">
      <div
        className={`site-tree-row ${isSelected ? "site-tree-row--active" : ""}`}
        style={{ paddingLeft: `${pad}px` }}
        onClick={handleRowClick}
      >
        <span className="site-tree-caret">
          {hasChildren ? (
            <FontAwesomeIcon
              icon={isExpanded ? faChevronDown : faChevronRight}
              className="fa-sm"
            />
          ) : (
            <span className="site-tree-caret-placeholder" />
          )}
        </span>
        <span className="site-tree-icon">
          <FontAwesomeIcon icon={Icon} className="fa-sm" />
        </span>
        <span className="site-tree-name-wrap">
          <span className="site-tree-name">{name}</span>
          {type === "floor" && (equipmentCount > 0 || equipmentPreview?.length > 0) && (
            <span className="site-tree-equipment-badge" title={`${equipmentCount || equipmentPreview?.length} equipment`}>
              [{equipmentCount || equipmentPreview?.length}]
            </span>
          )}
          <span className="site-tree-type-badge">
            {type === "site" ? "SITE" : type === "building" ? "BUILDING" : "FLOOR"}
          </span>
        </span>
        {(onAddChild || onAddEquipment || onEdit || onDelete) && (
        <div className="site-tree-row-actions">
          {canAddChild && onAddChild && (
            <>
              <button
                type="button"
                className="site-tree-action-btn site-tree-action-btn--add"
                title={addLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node);
                }}
              >
                <FontAwesomeIcon icon={faPlus} className="fa-xs" /> {addLabel}
              </button>
              <span className="site-tree-actions-divider" aria-hidden="true" />
            </>
          )}
          {canAddEquipment && onAddEquipment && (
            <>
              <button
                type="button"
                className="site-tree-action-btn site-tree-action-btn--add"
                title="Add Equipment"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddEquipment(node);
                }}
              >
                <FontAwesomeIcon icon={faBoxOpen} className="fa-xs" /> Add Equipment
              </button>
              <span className="site-tree-actions-divider" aria-hidden="true" />
            </>
          )}
          <button
            type="button"
            className="site-tree-action-btn site-tree-action-btn--edit"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              if (onEdit) {
                onEdit(node);
              }
            }}
          >
            <FontAwesomeIcon icon={faEdit} className="fa-xs" />
          </button>
          <button
            type="button"
            className="site-tree-action-btn site-tree-action-btn--danger"
            title="Delete"
            onClick={handleDelete}
          >
            <FontAwesomeIcon icon={faTrash} className="fa-xs" />
          </button>
        </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="site-tree-children">
          {children.map((child) => (
            <SiteTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              selectedEquipmentId={selectedEquipmentId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onSelectEquipment={onSelectEquipment}
              onAddChild={onAddChild}
              onAddEquipment={onAddEquipment}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {hasEquipmentPreview && isExpanded && type === "floor" && (
            <HierarchyEquipmentSection
              equipment={equipmentPreview}
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={onSelectEquipment}
            />
          )}
        </div>
      )}
    </div>
  );
}
