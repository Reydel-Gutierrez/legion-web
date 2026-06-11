import React, { useState } from "react";
import { Col, Form, Row } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";

import { SCAN_MODES } from "../../network/networkConfigModel";
import NetworkConfigField, { NETWORK_FIELD_CLASS } from "./NetworkConfigField";

const SCAN_MODE_LABELS = {
  [SCAN_MODES.ALL]: "Scan All (BACnet/IP + MS/TP)",
  [SCAN_MODES.BACNET_IP]: "BACnet/IP only",
  [SCAN_MODES.BACNET_MSTP]: "BACnet MS/TP only",
};

export default function ScanDefaultsSection({ scanDefaults, onUpdate }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="network-config-section">
      <div className="network-config-section__head">
        <div>
          <h6 className="network-config-section__title">Discovery scan defaults</h6>
          <p className="network-config-section__lead mb-0">
            Controls how Network Discovery behaves when you run a site scan. BACnet Explorer uses its own live
            Who-Is timeout separately.
          </p>
        </div>
      </div>

      <Row className="g-3">
        <Col md={6} lg={5}>
          <NetworkConfigField
            label="Default scan mode"
            hint="Which protocol families Network Discovery includes by default"
          >
            <Form.Select
              size="sm"
              className={NETWORK_FIELD_CLASS}
              value={scanDefaults.defaultScanMode}
              onChange={(event) => onUpdate({ defaultScanMode: event.target.value })}
            >
              {Object.entries(SCAN_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </NetworkConfigField>
        </Col>
        <Col md={3} lg={2}>
          <NetworkConfigField label="Timeout (sec)" hint="How long to wait for device responses">
            <Form.Control
              size="sm"
              type="number"
              className={NETWORK_FIELD_CLASS}
              value={scanDefaults.scanTimeoutSec}
              onChange={(event) =>
                onUpdate({ scanTimeoutSec: Math.max(1, Number(event.target.value) || 15) })
              }
            />
          </NetworkConfigField>
        </Col>
        <Col md={3} lg={2}>
          <NetworkConfigField label="Retries" hint="Repeat scan attempts before giving up">
            <Form.Control
              size="sm"
              type="number"
              className={NETWORK_FIELD_CLASS}
              value={scanDefaults.retries}
              onChange={(event) => onUpdate({ retries: Math.max(0, Number(event.target.value) || 0) })}
            />
          </NetworkConfigField>
        </Col>
      </Row>

      <button
        type="button"
        className="network-config-advanced-toggle"
        onClick={() => setShowAdvanced((open) => !open)}
      >
        <FontAwesomeIcon icon={showAdvanced ? faChevronDown : faChevronRight} className="me-2" />
        Advanced options
      </button>

      {showAdvanced ? (
        <div className="network-config-advanced-panel">
          <Form.Check
            id="include-unconfigured"
            type="checkbox"
            className="text-white small mb-2"
            label="Include unconfigured protocol families during commissioning scans"
            checked={scanDefaults.includeUnconfiguredProtocols}
            onChange={(event) => onUpdate({ includeUnconfiguredProtocols: event.target.checked })}
          />
          <Form.Check
            id="autoscan-open"
            type="checkbox"
            className="text-white-50 small mb-0"
            label="Auto-scan when opening Network Discovery"
            checked={scanDefaults.autoScanOnOpen}
            onChange={(event) => onUpdate({ autoScanOnOpen: event.target.checked })}
            disabled
          />
          <div className="network-config-field__hint mt-1">
            Auto-scan will be available when backend job orchestration is wired up.
          </div>
        </div>
      ) : null}
    </div>
  );
}
