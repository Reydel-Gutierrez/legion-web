import React from "react";
import { Form } from "@themesberg/react-bootstrap";

import NetworkConfigField, { NETWORK_FIELD_CLASS } from "./NetworkConfigField";

export default function RoutingNotesSection({ routingNotes, onUpdate }) {
  return (
    <div className="network-config-section">
      <div className="network-config-section__head">
        <div>
          <h6 className="network-config-section__title">Topology & routing notes</h6>
          <p className="network-config-section__lead mb-0">
            Free-form documentation for the commissioning team — VLANs, BBMD placement, router instances, and
            anything that helps the next engineer understand the site.
          </p>
        </div>
      </div>

      <NetworkConfigField
        label="Site network notes"
        hint="Example: Supervisory on VLAN 40. Controllers on 10.57.2.0/24. MSTP via JACE router instance 7001."
      >
        <Form.Control
          as="textarea"
          rows={8}
          className={NETWORK_FIELD_CLASS}
          placeholder="Document VLANs, routers, JACE placement, MSTP topology…"
          value={routingNotes}
          onChange={(event) => onUpdate(event.target.value)}
        />
      </NetworkConfigField>
    </div>
  );
}
