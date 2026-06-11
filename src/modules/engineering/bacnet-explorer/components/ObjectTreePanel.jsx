import React, { useMemo, useState, useEffect } from "react";
import { Form, Spinner } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight, faSitemap } from "@fortawesome/free-solid-svg-icons";

import {
  TREE_GROUP_ORDER,
  TREE_GROUP_LABELS,
  flattenTreeGroups,
  filterTreeObjects,
  groupFilteredObjects,
  countTreeObjects,
  formatDisplayValue,
  formatObjectRef,
} from "../bacnetExplorerUtils";

function ObjectRow({ object, selected, onSelect }) {
  const ref = formatObjectRef(object.objectType, object.objectInstance);
  const name = object.objectName || "—";
  const value = formatDisplayValue(object.presentValue);
  const units = object.units ? String(object.units) : "NO_UNITS";
  const reliability = object.reliability ? String(object.reliability) : "—";

  return (
    <button
      type="button"
      className={`bacnet-explorer-tree-row ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(object.id)}
    >
      <span className="bacnet-explorer-tree-row__ref">{ref}</span>
      <span className="bacnet-explorer-tree-row__name text-truncate" title={name}>
        {name}
      </span>
      <span className="bacnet-explorer-tree-row__value text-truncate" title={value}>
        {value}
      </span>
      <span className="bacnet-explorer-tree-row__units">{units}</span>
      <span className="bacnet-explorer-tree-row__rel text-truncate" title={reliability}>
        {reliability}
      </span>
    </button>
  );
}

function TreeGroupSection({ groupKey, objects, expanded, onToggle, selectedObjectId, onSelectObject }) {
  if (!objects.length) return null;

  return (
    <div className="bacnet-explorer-tree-group">
      <button type="button" className="bacnet-explorer-tree-group__header" onClick={onToggle}>
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="me-2" />
        <span>{TREE_GROUP_LABELS[groupKey] || groupKey}</span>
        <span className="bacnet-explorer-tree-group__count">{objects.length}</span>
      </button>
      {expanded ? (
        <div className="bacnet-explorer-tree-group__body">
          {objects.map((object) => (
            <ObjectRow
              key={object.id}
              object={object}
              selected={object.id === selectedObjectId}
              onSelect={onSelectObject}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ObjectTreePanel({
  device,
  groups,
  loading,
  error,
  selectedObjectId,
  onSelectObject,
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [onlyWithPresentValue, setOnlyWithPresentValue] = useState(false);
  const [onlyFaulted, setOnlyFaulted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  const flatObjects = useMemo(() => flattenTreeGroups(groups), [groups]);
  const filteredObjects = useMemo(
    () =>
      filterTreeObjects(flatObjects, {
        search,
        groupKey: groupFilter,
        onlyWithPresentValue,
        onlyFaulted,
      }),
    [flatObjects, search, groupFilter, onlyWithPresentValue, onlyFaulted]
  );
  const filteredGroups = useMemo(
    () => groupFilteredObjects(filteredObjects),
    [filteredObjects]
  );

  useEffect(() => {
    const total = countTreeObjects(groups);
    const next = {};
    for (const key of TREE_GROUP_ORDER) {
      const count = groups?.[key]?.length || 0;
      next[key] = total <= 80 ? count > 0 : count > 0 && count <= 25;
    }
    setExpandedGroups(next);
  }, [device?.id, groups]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  return (
    <div className="bacnet-explorer-panel bacnet-explorer-panel--tree">
      <div className="bacnet-explorer-panel__header legion-operator-log-card-header bacnet-explorer-panel__header--stacked">
        <div className="bacnet-explorer-panel__title text-white fw-bold text-uppercase">
          <FontAwesomeIcon icon={faSitemap} className="me-2 opacity-75" />
          Object Tree
        </div>
        {device ? (
          <div className="bacnet-explorer-panel__subtitle text-truncate">
            {device.objectName || device.address} · {filteredObjects.length}/{flatObjects.length}
          </div>
        ) : null}
      </div>

      <div className="bacnet-explorer-panel__toolbar">
        <Form.Control
          size="sm"
          className="legion-operator-log-field mb-2"
          placeholder="Search object name, type, instance…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={!device}
        />
        <div className="bacnet-explorer-tree-filters">
          <Form.Select
            size="sm"
            className="legion-operator-log-field"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            disabled={!device}
          >
            <option value="all">All groups</option>
            {TREE_GROUP_ORDER.map((key) => (
              <option key={key} value={key}>
                {TREE_GROUP_LABELS[key]}
              </option>
            ))}
          </Form.Select>
          <Form.Check
            type="checkbox"
            id="bacnet-filter-present-value"
            className="bacnet-explorer-muted small"
            label="Has presentValue"
            checked={onlyWithPresentValue}
            onChange={(event) => setOnlyWithPresentValue(event.target.checked)}
            disabled={!device}
          />
          <Form.Check
            type="checkbox"
            id="bacnet-filter-faulted"
            className="bacnet-explorer-muted small"
            label="Faulted reliability"
            checked={onlyFaulted}
            onChange={(event) => setOnlyFaulted(event.target.checked)}
            disabled={!device}
          />
        </div>
      </div>

      <div className="bacnet-explorer-panel__body">
        {!device ? (
          <div className="bacnet-explorer-empty">Select a BACnet device to browse its object tree.</div>
        ) : null}

        {device && loading ? (
          <div className="bacnet-explorer-empty">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading object tree…
          </div>
        ) : null}

        {device && error ? <div className="bacnet-explorer-error">{error}</div> : null}

        {device && !loading && !error && flatObjects.length === 0 ? (
          <div className="bacnet-explorer-empty">
            <p className="mb-2">No cached objects for this device.</p>
            <p className="small bacnet-explorer-muted mb-0">Use Import Discovery to scan the controller object-list.</p>
          </div>
        ) : null}

        {device && !loading && !error && flatObjects.length > 0 && filteredObjects.length === 0 ? (
          <div className="bacnet-explorer-empty">No objects match the current filters.</div>
        ) : null}

        {device && !loading && !error
          ? TREE_GROUP_ORDER.map((groupKey) => (
              <TreeGroupSection
                key={groupKey}
                groupKey={groupKey}
                objects={filteredGroups[groupKey] || []}
                expanded={!!expandedGroups[groupKey]}
                onToggle={() => toggleGroup(groupKey)}
                selectedObjectId={selectedObjectId}
                onSelectObject={onSelectObject}
              />
            ))
          : null}
      </div>
    </div>
  );
}
