import React from "react";
import { Form, InputGroup, Button, ButtonGroup, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faNetworkWired,
  faEllipsisV,
  faFilter,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Toolbar for Network Discovery: search, split scan control, refresh, assign, actions.
 */
export default function DiscoveryToolbar({
  searchValue,
  onSearchChange,
  onScanAll,
  onScanBacnetIp,
  onScanMstp,
  onAdvancedScan,
  onRefresh,
  onAssign,
  isScanning,
  canRunScan,
}) {
  return (
    <div className="discovery-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
      <Form.Group className="mb-0">
        <InputGroup className="input-group-merge legion-search-bar">
          <InputGroup.Text className="legion-search-bar-addon">
            <FontAwesomeIcon icon={faSearch} />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Filter discovered devices..."
            className="legion-search-bar-input"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </InputGroup>
      </Form.Group>
      <div className="site-builder-toolbar-divider" />
      <ButtonGroup size="sm">
        <Button
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={onScanAll}
          disabled={isScanning || !canRunScan}
        >
          <FontAwesomeIcon icon={faNetworkWired} className="me-1" />
          {isScanning ? "Scanning…" : "Scan Network"}
        </Button>
        <Dropdown as={ButtonGroup} align="end">
          <Dropdown.Toggle
            split
            className="legion-hero-btn legion-hero-btn--primary"
            disabled={isScanning || !canRunScan}
          >
            <FontAwesomeIcon icon={faChevronDown} />
            <span className="visually-hidden">More scan modes</span>
          </Dropdown.Toggle>
          <Dropdown.Menu className="legion-dropdown-menu bg-dark border border-light border-opacity-10">
            <Dropdown.Header className="text-white-50 small">Scan mode</Dropdown.Header>
            <Dropdown.Item className="text-white" onClick={onScanAll}>
              Scan All (recommended)
            </Dropdown.Item>
            <Dropdown.Item className="text-white" onClick={onScanBacnetIp}>
              BACnet/IP
            </Dropdown.Item>
            <Dropdown.Item className="text-white" onClick={onScanMstp}>
              BACnet MS/TP
            </Dropdown.Item>
            <Dropdown.Divider className="border-light border-opacity-10" />
            <Dropdown.Item className="text-white" onClick={onAdvancedScan}>
              Advanced…
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </ButtonGroup>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onRefresh}
      >
        <FontAwesomeIcon icon={faSync} className="me-1" />
        Refresh
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onAssign}
      >
        Assign
      </Button>
      <Dropdown>
        <Dropdown.Toggle
          size="sm"
          variant="dark"
          className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </Dropdown.Toggle>
        <Dropdown.Menu
          align="end"
          className="legion-dropdown-menu bg-dark border border-light border-opacity-10"
        >
          <Dropdown.Item className="text-white">
            <FontAwesomeIcon icon={faFilter} className="me-2" /> Filter by Status
          </Dropdown.Item>
          <Dropdown.Item className="text-white">
            <FontAwesomeIcon icon={faFilter} className="me-2" /> Filter by Vendor
          </Dropdown.Item>
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item className="text-white">Expand All</Dropdown.Item>
          <Dropdown.Item className="text-white">Collapse All</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
