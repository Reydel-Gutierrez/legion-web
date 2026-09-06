import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import StatusIndicator from "../../../components/legion/StatusIndicator";

export default function FacilityTreeNode({
  node,
  depth,
  isLast = true,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
}) {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(String(node.id));
  const selected = String(selectedId) === String(node.id);

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
          <FacilityKindIcon kind={node.kind} className="facility-tree__icon" />
          <span className="facility-tree__label">{node.label}</span>
          {node.kind === "equipment" && node.commStatus ? (
            <StatusIndicator
              className="facility-tree__comm"
              status={node.commStatus}
              label={
                node.commStatus === "LIVE"
                  ? "Online"
                  : node.commStatus === "STALE"
                    ? "Stale"
                    : node.commStatus === "OFFLINE"
                      ? "Offline"
                      : node.commStatus
              }
            />
          ) : null}
          {node.alarmCount > 0 ? (
            <span className="facility-tree__alarm">
              {node.alarmCount} Alarm{node.alarmCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul className="facility-tree__children">
          {children.map((child, index) => (
            <FacilityTreeNode
              key={`${child.kind}-${child.id}`}
              node={child}
              depth={depth + 1}
              isLast={index === children.length - 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
