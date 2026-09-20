import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import OperatorAlarmBell from "../../../components/legion/OperatorAlarmBell";
import { normalizeCommStatus } from "../../../lib/operator/statusUtils";

export default function FacilityTreeNode({
  node,
  depth,
  isLast = true,
  isFirst = false,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  reorderMode = false,
  onMoveEquipment,
}) {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(String(node.id));
  const selected = String(selectedId) === String(node.id);
  const commStatus = normalizeCommStatus(node.commStatus || node.equipmentCommStatus || node.status);
  const showReorderArrows = reorderMode && node.kind === "equipment";

  return (
    <li className={`facility-tree__item${isLast ? " is-last" : ""}${depth === 0 ? " is-root" : ""}`}>
      <div className={`facility-tree__row${selected ? " is-selected" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="facility-tree__twist"
            aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
          </button>
        ) : (
          <span className="facility-tree__twist facility-tree__twist--leaf" />
        )}
        <button type="button" className="facility-tree__hit" onClick={() => onSelect(node)}>
          <span className="facility-tree__icons">
            {node.kind === "equipment" ? (
              <span className="facility-tree__status-gutter">
                {node.alarmCount > 0 ? <OperatorAlarmBell /> : null}
              </span>
            ) : null}
            <FacilityKindIcon
              kind={node.kind}
              style={
                node.kind === "equipment" && commStatus === "OFFLINE"
                  ? { color: "#d64545", stroke: "#d64545" }
                  : undefined
              }
              className={`facility-tree__icon${
                node.kind === "equipment" && commStatus === "OFFLINE"
                  ? " facility-tree__icon--offline"
                  : ""
              }`}
            />
          </span>
          <span className="facility-tree__label">{node.label}</span>
        </button>
        {showReorderArrows ? (
          <div className="facility-tree__reorder" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="facility-tree__reorder-btn"
              disabled={isFirst}
              aria-label={`Move ${node.label} up`}
              onClick={() => onMoveEquipment(node.floorId, node.id, -1)}
            >
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
            <button
              type="button"
              className="facility-tree__reorder-btn"
              disabled={isLast}
              aria-label={`Move ${node.label} down`}
              onClick={() => onMoveEquipment(node.floorId, node.id, 1)}
            >
              <FontAwesomeIcon icon={faArrowDown} />
            </button>
          </div>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul className="facility-tree__children">
          {children.map((child, index) => (
            <FacilityTreeNode
              key={`${child.kind}-${child.id}`}
              node={child}
              depth={depth + 1}
              isLast={index === children.length - 1}
              isFirst={index === 0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              reorderMode={reorderMode}
              onMoveEquipment={onMoveEquipment}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
