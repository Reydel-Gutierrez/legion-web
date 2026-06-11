import React, { useState, useCallback, useEffect } from "react";
import { Modal, Button, Spinner } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBroadcastTower, faDownload, faSyncAlt } from "@fortawesome/free-solid-svg-icons";

import { discoverBacnetDevices, importBacnetDiscovery } from "../../../../lib/data/adapters/api/bacnetApiAdapter";
import { formatTimestamp } from "../bacnetExplorerUtils";

const DEFAULT_IMPORT_LIMIT = 200;

function DiscoverDeviceCard({ device, importing, disabled, onImport }) {
  return (
    <div className="bacnet-discover-device-card">
      <div className="bacnet-discover-device-card__info">
        <div className="bacnet-discover-device-card__address">{device.address}</div>
        <div className="bacnet-discover-device-card__meta">
          <span>Instance {device.deviceInstance}</span>
          <span>Vendor {device.vendorId ?? "—"}</span>
          <span>Max APDU {device.maxApdu ?? "—"}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline-light"
        className="bacnet-explorer-btn bacnet-discover-device-card__import"
        disabled={disabled}
        onClick={() => onImport(device)}
      >
        {importing ? (
          <Spinner animation="border" size="sm" className="me-1" />
        ) : (
          <FontAwesomeIcon icon={faDownload} className="me-1" />
        )}
        Import
      </Button>
    </div>
  );
}

export default function DiscoverDevicesModal({
  show,
  onHide,
  onImported,
}) {
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [discoverResult, setDiscoverResult] = useState(null);
  const [importingKey, setImportingKey] = useState(null);
  const [importError, setImportError] = useState(null);

  const runDiscover = useCallback(async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const result = await discoverBacnetDevices({ timeoutMs: 5000 });
      setDiscoverResult(result);
    } catch (err) {
      setDiscoverError(err?.message || "BACnet discovery failed");
      setDiscoverResult(null);
    } finally {
      setDiscovering(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      runDiscover();
    } else {
      setDiscoverError(null);
      setDiscoverResult(null);
      setImportError(null);
      setImportingKey(null);
    }
  }, [show, runDiscover]);

  const handleImport = async (device) => {
    const key = `${device.deviceInstance}:${device.address}`;
    setImportingKey(key);
    setImportError(null);
    try {
      const result = await importBacnetDiscovery({
        address: device.address,
        deviceInstance: device.deviceInstance,
        limit: DEFAULT_IMPORT_LIMIT,
      });
      await onImported?.(result);
      onHide();
    } catch (err) {
      setImportError(err?.message || "Import discovery failed");
    } finally {
      setImportingKey(null);
    }
  };

  const devices = discoverResult?.devices || [];

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="bacnet-discover-modal">
      <Modal.Header
        closeButton
        closeVariant="white"
        className="bacnet-discover-modal__header legion-operator-log-card-header"
      >
        <Modal.Title className="text-white fw-bold text-uppercase mb-0">
          <FontAwesomeIcon icon={faBroadcastTower} className="me-2" />
          Discover BACnet Devices
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bacnet-discover-modal__body">
        <div className="bacnet-discover-modal__toolbar">
          <div className="bacnet-discover-modal__status">
            <span className="bacnet-discover-modal__status-label">Who-Is broadcast</span>
            <span className="bacnet-discover-modal__status-detail">
              Timeout 5000 ms
              {discoverResult?.discoveredAt ? ` · ${formatTimestamp(discoverResult.discoveredAt)}` : ""}
              {devices.length > 0 ? ` · ${devices.length} device${devices.length === 1 ? "" : "s"}` : ""}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline-light"
            className="bacnet-explorer-btn"
            onClick={runDiscover}
            disabled={discovering}
          >
            {discovering ? (
              <Spinner animation="border" size="sm" className="me-2" />
            ) : (
              <FontAwesomeIcon icon={faSyncAlt} className="me-2" />
            )}
            Run Discover
          </Button>
        </div>

        {discoverError ? <div className="bacnet-discover-modal__error">{discoverError}</div> : null}
        {importError ? <div className="bacnet-discover-modal__error">{importError}</div> : null}

        {discovering && devices.length === 0 ? (
          <div className="bacnet-discover-modal__message">
            <Spinner animation="border" size="sm" className="me-2" />
            Listening for I-Am responses…
          </div>
        ) : null}

        {!discovering && !discoverError && devices.length === 0 ? (
          <div className="bacnet-discover-modal__message">
            No BACnet devices responded. Check subnet, firewall, and BACnet interface settings.
          </div>
        ) : null}

        {devices.length > 0 ? (
          <div className="bacnet-discover-modal__results">
            <div className="bacnet-discover-modal__results-title">
              Responded devices — import to cache objects for BACnet Explorer
            </div>
            <div className="bacnet-discover-modal__device-list">
              {devices.map((device) => {
                const key = `${device.deviceInstance}:${device.address}`;
                return (
                  <DiscoverDeviceCard
                    key={key}
                    device={device}
                    importing={importingKey === key}
                    disabled={!!importingKey}
                    onImport={handleImport}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
