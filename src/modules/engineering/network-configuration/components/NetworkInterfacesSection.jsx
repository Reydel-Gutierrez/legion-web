import React from "react";
import { Button, Form } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt } from "@fortawesome/free-solid-svg-icons";

import NetworkConfigField, { NETWORK_FIELD_CLASS } from "./NetworkConfigField";

function InterfaceCard({ row, onUpdate, onRemove, canRemove }) {
  return (
    <div className="network-config-item-card">
      <div className="network-config-item-card__header">
        <Form.Check
          type="switch"
          id={`interface-${row.id}`}
          label={row.enabled ? "Active" : "Inactive"}
          checked={row.enabled}
          onChange={(event) => onUpdate(row.id, { enabled: event.target.checked })}
          className="network-config-item-card__switch"
        />
        {canRemove ? (
          <Button
            size="sm"
            variant="link"
            className="network-config-item-card__delete text-danger"
            onClick={() => onRemove(row.id)}
            title="Remove interface"
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </Button>
        ) : null}
      </div>
      <div className="network-config-item-card__grid">
        <NetworkConfigField label="Interface label" hint="How this adapter appears in engineering docs">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.label}
            onChange={(event) => onUpdate(row.id, { label: event.target.value })}
          />
        </NetworkConfigField>
        <NetworkConfigField
          label="Bind address"
          hint="Legion server IP on this adapter — leave blank to auto-detect"
        >
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.bindAddress}
            onChange={(event) => onUpdate(row.id, { bindAddress: event.target.value })}
            placeholder="192.168.1.100"
          />
        </NetworkConfigField>
        <NetworkConfigField label="UDP listen port" hint="Port Legion listens on for BACnet/IP (47808)">
          <Form.Control
            size="sm"
            type="number"
            className={NETWORK_FIELD_CLASS}
            value={row.listenUdp ?? ""}
            onChange={(event) =>
              onUpdate(row.id, {
                listenUdp: event.target.value === "" ? null : Number(event.target.value),
              })
            }
            placeholder="47808"
          />
        </NetworkConfigField>
        <NetworkConfigField label="Notes" hint="Adapter role, VPN caveat, or spare port" className="network-config-item-card__wide">
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

export default function NetworkInterfacesSection({ interfaces, onAdd, onUpdate, onRemove }) {
  return (
    <div className="network-config-section">
      <div className="network-config-section__head">
        <div>
          <h6 className="network-config-section__title">Legion server interfaces</h6>
          <p className="network-config-section__lead mb-0">
            Tell Legion which network adapter and UDP port to bind for BACnet/IP traffic. Match the subnet where
            your controllers live.
          </p>
        </div>
        <Button size="sm" variant="outline-light" className="network-config-btn" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          Add interface
        </Button>
      </div>

      <div className="network-config-item-list">
        {interfaces.map((row) => (
          <InterfaceCard
            key={row.id}
            row={row}
            onUpdate={onUpdate}
            onRemove={onRemove}
            canRemove={interfaces.length > 1}
          />
        ))}
      </div>
    </div>
  );
}
