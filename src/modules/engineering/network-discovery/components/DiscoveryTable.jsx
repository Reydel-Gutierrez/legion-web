import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faServer,
  faMicrochip,
  faNetworkWired,
  faCog,
} from "@fortawesome/free-solid-svg-icons";
import { Form } from "@themesberg/react-bootstrap";

const DEVICE_ICONS = {
  router: faNetworkWired,
  supervisor: faServer,
  vav: faMicrochip,
  default: faCog,
};

function getDeviceIcon(device) {
  const name = (device?.name || "").toLowerCase();
  if (name.includes("router") || name.includes("mstp")) return DEVICE_ICONS.router;
  if (name.includes("jace") || name.includes("supervisor")) return DEVICE_ICONS.supervisor;
  if (name.includes("vav") || name.includes("vma")) return DEVICE_ICONS.vav;
  return DEVICE_ICONS.default;
}

function StatusBadge({ status }) {
  const isOnline = status === "Online";
  const isOffline = status === "Offline";
  const isWarning = status === "Warning";
  let variant = "muted";
  if (isOnline) variant = "success";
  else if (isOffline) variant = "danger";
  else if (isWarning) variant = "warning";

  return (
    <span className={`discovery-status-badge discovery-status-badge--${variant}`}>
      <span className="discovery-status-dot" />
      {status}
    </span>
  );
}

function DiscoveryRow({
  device,
  level,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
  onSelectRow,
}) {
  const hasChildren = device.children && device.children.length > 0;
  const isExpanded = expandedIds.has(device.id);
  const isSelected = selectedIds.has(device.id);
  const Icon = getDeviceIcon(device);
  const padLeft = 12 + level * 24;

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    onToggleSelect(device);
  };

  const handleRowClick = (e) => {
    if (e.target.closest("input[type='checkbox']")) return;
    if (hasChildren && onToggleExpand) {
      onToggleExpand(device.id);
    }
    if (onSelectRow) onSelectRow(device);
  };

  return (
    <>
      <tr
        className={`discovery-table-row ${isSelected ? "discovery-table-row--selected" : ""}`}
        style={{ paddingLeft: 0 }}
        onClick={handleRowClick}
      >
        <td className="discovery-table-cell discovery-table-cell--checkbox">
          <Form.Check
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="discovery-checkbox"
          />
        </td>
        <td className="discovery-table-cell discovery-table-cell--name" style={{ paddingLeft: `${padLeft}px` }}>
          <span className="discovery-table-caret">
            {hasChildren ? (
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                className="fa-sm"
              />
            ) : (
              <span className="discovery-caret-placeholder" />
            )}
          </span>
          <span className="discovery-table-icon">
            <FontAwesomeIcon icon={Icon} className="fa-sm" />
          </span>
          <span className="discovery-table-name">{device.name}</span>
        </td>
        <td className="discovery-table-cell">{device.vendor || "—"}</td>
        <td className="discovery-table-cell">{device.deviceInstance ?? "—"}</td>
        <td className="discovery-table-cell">{device.network || "—"}</td>
        <td className="discovery-table-cell">{device.macOrMstpId ?? "—"}</td>
        <td className="discovery-table-cell">{device.objectCount ?? "—"}</td>
        <td className="discovery-table-cell discovery-table-cell--muted">{device.lastSeen || "—"}</td>
        <td className="discovery-table-cell">
          <StatusBadge status={device.status || "Offline"} />
        </td>
      </tr>
      {hasChildren && isExpanded &&
        device.children.map((child) => (
          <DiscoveryRow
            key={child.id}
            device={child}
            level={level + 1}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            onToggleExpand={onToggleExpand}
            onToggleSelect={onToggleSelect}
            onSelectRow={onSelectRow}
          />
        ))}
    </>
  );
}

function collectVisibleIds(roots, expandedIds) {
  const ids = new Set();
  const addVisible = (node) => {
    if (!node?.id) return;
    ids.add(node.id);
    if (expandedIds?.has?.(node.id) && node.children?.length) {
      node.children.forEach(addVisible);
    }
  };
  (roots || []).forEach(addVisible);
  return ids;
}

export default function DiscoveryTable({
  devices,
  expandedIds,
  selectedIds,
  onToggleExpand,
  onToggleSelect,
  onSelectAll,
  onSelectRow,
  pagedRows,
  emptyMessage,
}) {
  const visibleIdsOnPage = React.useMemo(
    () => collectVisibleIds(pagedRows, expandedIds),
    [pagedRows, expandedIds]
  );
  const visibleArr = [...visibleIdsOnPage];
  const allSelected = visibleArr.length > 0 && visibleArr.every((id) => selectedIds.has(id));
  const someSelected = visibleArr.some((id) => selectedIds.has(id));

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    if (onSelectAll) onSelectAll(visibleIdsOnPage, checked);
  };

  if (!devices || devices.length === 0) {
    return (
      <div className="discovery-table-empty">
        <p className="discovery-table-empty-title">{emptyMessage || "No devices discovered yet"}</p>
        <p className="discovery-table-empty-desc">
          Run a network scan to discover BACnet devices on the selected site.
        </p>
      </div>
    );
  }

  return (
    <div className="discovery-table-wrap">
      <table className="table discovery-table">
        <thead>
          <tr>
            <th className="discovery-table-header discovery-table-header--checkbox">
              <Form.Check
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={handleSelectAll}
                className="discovery-checkbox"
              />
            </th>
            <th className="discovery-table-header">Device Name</th>
            <th className="discovery-table-header">Vendor</th>
            <th className="discovery-table-header">Device Instance</th>
            <th className="discovery-table-header">Network</th>
            <th className="discovery-table-header">MAC / MSTP ID</th>
            <th className="discovery-table-header">Object Count</th>
            <th className="discovery-table-header">Last Seen</th>
            <th className="discovery-table-header">Status</th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((device) => (
            <DiscoveryRow
              key={device.id}
              device={device}
              level={0}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              onSelectRow={onSelectRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
