import React from "react";
import { Form, InputGroup, Button, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faNetworkWired,
  faEllipsisV,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Toolbar for Network Discovery: search, scan, refresh, assign, actions.
 */
export default function DiscoveryToolbar({
  searchValue,
  onSearchChange,
  onScan,
  onRefresh,
  onAssign,
  isScanning,
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
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--primary"
        onClick={onScan}
        disabled={isScanning}
      >
        <FontAwesomeIcon icon={faNetworkWired} className="me-1" />
        {isScanning ? "Scanning..." : "Scan Network"}
      </Button>
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
