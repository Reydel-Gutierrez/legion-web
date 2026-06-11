import React from "react";
import { Button, Form } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt } from "@fortawesome/free-solid-svg-icons";

import NetworkConfigField, { NETWORK_FIELD_CLASS } from "./NetworkConfigField";

const BAUD_RATES = ["9600", "19200", "38400", "57600", "76800", "115200"];

function MstpTrunkCard({ row, onUpdate, onRemove }) {
  return (
    <div className="network-config-item-card">
      <div className="network-config-item-card__header">
        <Form.Check
          type="switch"
          id={`mstp-${row.id}`}
          label={row.enabled ? "Enabled" : "Disabled"}
          checked={row.enabled}
          onChange={(event) => onUpdate(row.id, { enabled: event.target.checked })}
          className="network-config-item-card__switch"
        />
        <Button
          size="sm"
          variant="link"
          className="network-config-item-card__delete text-danger"
          onClick={() => onRemove(row.id)}
          title="Remove trunk"
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </Button>
      </div>
      <div className="network-config-item-card__grid">
        <NetworkConfigField label="Trunk name" hint="Field bus label (e.g. Tower A VAV trunk)">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.name}
            onChange={(event) => onUpdate(row.id, { name: event.target.value })}
          />
        </NetworkConfigField>
        <NetworkConfigField label="COM port" hint="Serial port on the supervisory PC or router">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.comPort}
            onChange={(event) => onUpdate(row.id, { comPort: event.target.value })}
            placeholder="COM3"
          />
        </NetworkConfigField>
        <NetworkConfigField label="Baud rate" hint="Must match the MS/TP trunk">
          <Form.Select
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.baudRate}
            onChange={(event) => onUpdate(row.id, { baudRate: event.target.value })}
          >
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </Form.Select>
        </NetworkConfigField>
        <NetworkConfigField label="MAC scan range" hint="Typical range 0–127 on each trunk">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.macRange}
            onChange={(event) => onUpdate(row.id, { macRange: event.target.value })}
            placeholder="0–127"
          />
        </NetworkConfigField>
        <NetworkConfigField label="Max master" hint="Highest MS/TP master address on the trunk">
          <Form.Control
            size="sm"
            type="number"
            className={NETWORK_FIELD_CLASS}
            value={row.maxMaster}
            onChange={(event) => onUpdate(row.id, { maxMaster: Number(event.target.value) || 127 })}
          />
        </NetworkConfigField>
        <NetworkConfigField label="Notes" hint="Router instance, panel location, wiring notes" className="network-config-item-card__wide">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.notes}
            onChange={(event) => onUpdate(row.id, { notes: event.target.value })}
          />
        </NetworkConfigField>
      </div>
    </div>
  );
}

export default function MstpTrunksSection({ trunks, onAdd, onUpdate, onRemove }) {
  return (
    <div className="network-config-section">
      <div className="network-config-section__head">
        <div>
          <h6 className="network-config-section__title">BACnet MS/TP trunks</h6>
          <p className="network-config-section__lead mb-0">
            Serial segments behind BACnet routers. Configure each trunk Legion should scan for downstream field
            controllers.
          </p>
        </div>
        <Button size="sm" variant="outline-light" className="network-config-btn" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          Add trunk
        </Button>
      </div>

      {trunks.length === 0 ? (
        <div className="network-config-empty">
          <p className="mb-2">No MS/TP trunks configured.</p>
          <p className="small mb-0">Skip this section if your site is BACnet/IP only.</p>
        </div>
      ) : (
        <div className="network-config-item-list">
          {trunks.map((row) => (
            <MstpTrunkCard key={row.id} row={row} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
