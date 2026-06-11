import React from "react";
import { Button, Form } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashAlt } from "@fortawesome/free-solid-svg-icons";

import NetworkConfigField, { NETWORK_FIELD_CLASS } from "./NetworkConfigField";

function BacnetIpCard({ row, onUpdate, onRemove }) {
  return (
    <div className="network-config-item-card">
      <div className="network-config-item-card__header">
        <Form.Check
          type="switch"
          id={`bacnet-ip-${row.id}`}
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
          title="Remove network"
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </Button>
      </div>
      <div className="network-config-item-card__grid">
        <NetworkConfigField label="Network name" hint="Friendly label shown in Network Discovery">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.name}
            onChange={(event) => onUpdate(row.id, { name: event.target.value })}
          />
        </NetworkConfigField>
        <NetworkConfigField label="Network adapter" hint="Windows adapter name or description">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.interfaceName}
            onChange={(event) => onUpdate(row.id, { interfaceName: event.target.value })}
            placeholder="Ethernet — Building LAN"
          />
        </NetworkConfigField>
        <NetworkConfigField label="Subnet / IP range" hint="CIDR or host IP Legion should scan">
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.localIpSubnet}
            onChange={(event) => onUpdate(row.id, { localIpSubnet: event.target.value })}
            placeholder="10.57.2.0/24"
          />
        </NetworkConfigField>
        <NetworkConfigField label="UDP port" hint="BACnet/IP port (default 47808)">
          <Form.Control
            size="sm"
            type="number"
            className={NETWORK_FIELD_CLASS}
            value={row.udpPort}
            onChange={(event) => onUpdate(row.id, { udpPort: Number(event.target.value) || 47808 })}
          />
        </NetworkConfigField>
        <NetworkConfigField
          label="BBMD / Foreign Device"
          hint="Optional — only if BACnet traffic crosses subnets"
          className="network-config-item-card__wide"
        >
          <Form.Control
            size="sm"
            className={NETWORK_FIELD_CLASS}
            value={row.bbmdOrForeignDevice}
            onChange={(event) => onUpdate(row.id, { bbmdOrForeignDevice: event.target.value })}
            placeholder="Optional"
          />
        </NetworkConfigField>
        <NetworkConfigField label="Notes" hint="JACE placement, VLAN ID, switch port…" className="network-config-item-card__wide">
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

export default function BacnetIpNetworksSection({ networks, onAdd, onUpdate, onRemove }) {
  return (
    <div className="network-config-section">
      <div className="network-config-section__head">
        <div>
          <h6 className="network-config-section__title">BACnet/IP networks</h6>
          <p className="network-config-section__lead mb-0">
            Define each building LAN or VLAN where BACnet/IP controllers respond to Who-Is. Network Discovery uses
            these paths to find devices.
          </p>
        </div>
        <Button size="sm" variant="outline-light" className="network-config-btn" onClick={onAdd}>
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          Add network
        </Button>
      </div>

      {networks.length === 0 ? (
        <div className="network-config-empty">
          <p className="mb-2">No BACnet/IP networks configured yet.</p>
          <p className="small mb-0">
            Add your supervisory PC subnet or the controller VLAN (for example <code>10.57.2.0/24</code>).
          </p>
        </div>
      ) : (
        <div className="network-config-item-list">
          {networks.map((row) => (
            <BacnetIpCard key={row.id} row={row} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
