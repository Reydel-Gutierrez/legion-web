import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { Button, Dropdown } from "@themesberg/react-bootstrap";

/**
 * Top informational banner for Network Discovery.
 * Tells users that discovered devices are not yet assigned to equipment.
 */
export default function DiscoveryStatusBanner({ onAssign, onMore }) {
  return (
    <div className="discovery-status-banner d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 rounded border border-light border-opacity-10 mb-3">
      <div className="d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-warning fa-lg" />
        <div>
          <div className="text-white fw-semibold small">Discovered devices are not assigned yet</div>
          <div className="text-white-50 small">
            Select controllers and assign them to equipment groups or equipment records once discovery is complete.
          </div>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <Button
          size="sm"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={() => onAssign?.()}
        >
          Assign
        </Button>
        <Dropdown>
          <Dropdown.Toggle
            as={Button}
            variant="dark"
            size="sm"
            className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
          >
            More...
          </Dropdown.Toggle>
          <Dropdown.Menu
            align="end"
            className="legion-dropdown-menu bg-dark border border-light border-opacity-10"
          >
            <Dropdown.Item className="text-white" onClick={onMore}>
              Export Discovery Results
            </Dropdown.Item>
            <Dropdown.Item className="text-white" onClick={onMore}>
              Clear Discovery Cache
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}
