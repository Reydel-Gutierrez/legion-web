import React from "react";
import { Button, Spinner } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSyncAlt,
  faBroadcastTower,
  faDownload,
  faServer,
} from "@fortawesome/free-solid-svg-icons";

import {
  formatDisplayValue,
  getDeviceDisplayStatus,
  formatDeviceAddressCompact,
  formatDeviceStatusTooltip,
  formatTimestamp,
} from "../bacnetExplorerUtils";

function DeviceCard({ device, selected, onSelect, health }) {
  const status = getDeviceDisplayStatus(device, health);
  const title = device.objectName || `Device ${device.deviceInstance}`;
  const addressLine = formatDeviceAddressCompact(device);
  const metaLine = [
    `${device.objectCount ?? 0} obj`,
    device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      className={`bacnet-explorer-device-card ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(device.id)}
    >
      <span
        className={`bacnet-explorer-status-dot ${status.className}`}
        title={formatDeviceStatusTooltip(status, device)}
      />
      <div className="bacnet-explorer-device-card__content">
        <div className="bacnet-explorer-device-card__title text-truncate">{title}</div>
        <div className="bacnet-explorer-device-card__address text-truncate">{addressLine}</div>
        {device.modelName ? (
          <div className="bacnet-explorer-device-card__model text-truncate">{device.modelName}</div>
        ) : null}
        <div className="bacnet-explorer-device-card__meta text-truncate">{metaLine}</div>
      </div>
    </button>
  );
}

export default function DeviceListPanel({
  devices,
  selectedDeviceId,
  loading,
  healthCheckLoading,
  importing,
  onRefresh,
  onDiscover,
  onImportSelected,
  onSelectDevice,
  deviceHealthById,
}) {
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
  const refreshLoading = healthCheckLoading || loading;

  return (
    <div className="bacnet-explorer-panel bacnet-explorer-panel--devices">
      <div className="bacnet-explorer-panel__header legion-operator-log-card-header">
        <div className="bacnet-explorer-panel__title text-white fw-bold text-uppercase">
          <FontAwesomeIcon icon={faServer} className="me-2 opacity-75" />
          Devices
        </div>
        <Button
          size="sm"
          variant="outline-light"
          className="bacnet-explorer-btn bacnet-explorer-panel__refresh"
          onClick={onRefresh}
          disabled={refreshLoading}
          title="Check cached device health"
        >
          <FontAwesomeIcon icon={faSyncAlt} spin={healthCheckLoading} />
        </Button>
      </div>

      <div className="bacnet-explorer-panel__toolbar">
        <Button
          size="sm"
          variant="outline-light"
          className="bacnet-explorer-btn w-100 mb-2"
          onClick={onDiscover}
        >
          <FontAwesomeIcon icon={faBroadcastTower} className="me-2" />
          Discover BACnet Devices
        </Button>
        <Button
          size="sm"
          variant="outline-light"
          className="bacnet-explorer-btn w-100"
          onClick={onImportSelected}
          disabled={!selectedDevice || importing}
        >
          {importing ? (
            <Spinner animation="border" size="sm" className="me-2" />
          ) : (
            <FontAwesomeIcon icon={faDownload} className="me-2" />
          )}
          Import Discovery
        </Button>
      </div>

      <div className="bacnet-explorer-panel__body bacnet-explorer-panel__body--device-list">
        {loading && devices.length === 0 ? (
          <div className="bacnet-explorer-empty">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading devices…
          </div>
        ) : null}

        {!loading && devices.length === 0 ? (
          <div className="bacnet-explorer-empty">
            <p className="mb-2">No cached BACnet devices.</p>
            <p className="small bacnet-explorer-muted mb-0">
              Run Discover, then Import Discovery to populate the explorer cache.
            </p>
          </div>
        ) : null}

        <div className="bacnet-explorer-device-list">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              selected={device.id === selectedDeviceId}
              onSelect={onSelectDevice}
              health={deviceHealthById?.[device.id]}
            />
          ))}
        </div>
      </div>

      {selectedDevice ? (
        <div className="bacnet-explorer-panel__device-hint small bacnet-explorer-muted">
          {formatDisplayValue(selectedDevice.objectName || selectedDevice.address)} · limit 200
        </div>
      ) : null}
    </div>
  );
}
