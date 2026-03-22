import React from "react";
import { Button } from "@themesberg/react-bootstrap";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNetworkWired, faSearch, faSlidersH } from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../../../routes";

/**
 * Empty state when no devices have been discovered yet.
 */
export default function EmptyDiscoveryState({ onScanNetwork, canRunScan = true }) {
  return (
    <div className="discovery-empty-state text-center py-5 px-4">
      <div className="discovery-empty-icon mb-3">
        <FontAwesomeIcon icon={faNetworkWired} className="fa-3x text-white-50" />
      </div>
      <h6 className="text-white fw-bold mb-2">No devices discovered yet</h6>
      <p className="text-white-50 small mb-4 mx-auto" style={{ maxWidth: 400 }}>
        Run a supervisory scan using the paths in Network Configuration. When discovery completes, devices appear here for assignment
        to equipment.
      </p>
      <div className="d-flex flex-wrap gap-2 justify-content-center align-items-center">
        <Button
          size="sm"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={() => onScanNetwork?.("all")}
          disabled={!canRunScan}
        >
          <FontAwesomeIcon icon={faSearch} className="me-2" />
          Scan Network
        </Button>
        <Button
          as={Link}
          to={Routes.EngineeringNetworkConfiguration.path}
          size="sm"
          variant="outline-light"
          className="border-light border-opacity-25 text-white"
        >
          <FontAwesomeIcon icon={faSlidersH} className="me-2" />
          Network Configuration
        </Button>
      </div>
    </div>
  );
}
