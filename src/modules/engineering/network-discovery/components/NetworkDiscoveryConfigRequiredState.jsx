import React from "react";
import { Button } from "@themesberg/react-bootstrap";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSlidersH, faEthernet } from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../../../routes";

export default function NetworkDiscoveryConfigRequiredState() {
  return (
    <div className="discovery-empty-state text-center py-5 px-4">
      <div className="discovery-empty-icon mb-3">
        <FontAwesomeIcon icon={faEthernet} className="fa-3x text-white-50" />
      </div>
      <h6 className="text-white fw-bold mb-2">No network paths configured yet</h6>
      <p className="text-white-50 small mb-4 mx-auto" style={{ maxWidth: 420 }}>
        Discovery runs from the supervisory engine using BACnet/IP networks and BACnet MS/TP trunks defined for this site. Add at
        least one enabled path in Network Configuration, or turn on &quot;Include unconfigured protocols&quot; in scan defaults if
        you are commissioning without full site metadata.
      </p>
      <Button
        as={Link}
        to={Routes.EngineeringNetworkConfiguration.path}
        size="sm"
        className="legion-hero-btn legion-hero-btn--primary"
      >
        <FontAwesomeIcon icon={faSlidersH} className="me-2" />
        Open Network Configuration
      </Button>
    </div>
  );
}
