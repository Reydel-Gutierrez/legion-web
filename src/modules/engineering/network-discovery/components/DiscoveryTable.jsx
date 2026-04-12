import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faServer,
  faMicrochip,
  faNetworkWired,
  faCog,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import { Form, Button } from "@themesberg/react-bootstrap";

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
  selectedIds,
  onToggleSelect,
  onViewDevice,
}) {
  const isSelected = selectedIds.has(device.id);
  const Icon = getDeviceIcon(device);

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    onToggleSelect(device);
  };

  const handleRowClick = (e) => {
    if (e.target.closest("input[type='checkbox']")) return;
    if (e.target.closest(".discovery-table-cell--actions")) return;
    if (onViewDevice) onViewDevice(device);
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    if (onViewDevice) onViewDevice(device);
  };

  return (
    <tr
      className={`discovery-table-row ${isSelected ? "discovery-table-row--selected" : ""}`}
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
      <td className="discovery-table-cell discovery-table-cell--name">
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
      <td className="discovery-table-cell discovery-table-cell--actions text-end">
        <Button
          variant="link"
          size="sm"
          className="text-white-50 p-0"
          onClick={handleViewClick}
          title="View device"
          aria-label="View device"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} className="fa-sm" />
        </Button>
      </td>
    </tr>
  );
}

export default function DiscoveryTable({
  devices,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDevice,
  pagedRows,
  emptyMessage,
}) {
  const visibleIdsOnPage = React.useMemo(
    () => new Set((pagedRows || []).map((d) => d.id).filter(Boolean)),
    [pagedRows]
  );
  const visibleArr = [...visibleIdsOnPage];
  const allSelected = visibleArr.length > 0 && visibleArr.every((id) => selectedIds.has(id));
  const someSelected = visibleArr.some((id) => selectedIds.has(id));

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    if (onSelectAll) onSelectAll(visibleIdsOnPage, checked);
  };

  const hasRows = pagedRows && pagedRows.length > 0;

  if (!hasRows) {
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
            <th className="discovery-table-header">Device Address</th>
            <th className="discovery-table-header">Object Count</th>
            <th className="discovery-table-header">Last Seen</th>
            <th className="discovery-table-header">Status</th>
            <th className="discovery-table-header discovery-table-header--actions" style={{ width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((device) => (
            <DiscoveryRow
              key={device.id}
              device={device}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onViewDevice={onViewDevice}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
