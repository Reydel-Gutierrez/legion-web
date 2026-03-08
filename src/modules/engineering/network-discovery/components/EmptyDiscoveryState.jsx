import React from "react";
import { Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNetworkWired, faSearch } from "@fortawesome/free-solid-svg-icons";

/**
 * Empty state when no devices have been discovered yet.
 */
export default function EmptyDiscoveryState({ onScanNetwork }) {
  return (
    <div className="discovery-empty-state text-center py-5 px-4">
      <div className="discovery-empty-icon mb-3">
        <FontAwesomeIcon icon={faNetworkWired} className="fa-3x text-white-50" />
      </div>
      <h6 className="text-white fw-bold mb-2">No devices discovered yet</h6>
      <p className="text-white-50 small mb-4 mx-auto" style={{ maxWidth: 360 }}>
        Run a network scan to discover BACnet devices on the selected site. Once discovery completes, devices will appear here for assignment to equipment.
      </p>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--primary"
        onClick={onScanNetwork}
      >
        <FontAwesomeIcon icon={faSearch} className="me-2" />
        Scan Network
      </Button>
    </div>
  );
}
