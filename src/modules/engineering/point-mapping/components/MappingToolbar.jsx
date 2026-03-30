import React from "react";
import { Form, InputGroup, Button, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faMagic,
  faCheckCircle,
  faEraser,
  faEllipsisV,
  faRedo,
  faFileImport,
  faFileExport,
  faEye,
  faCompressAlt,
  faExpandAlt,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Toolbar for Point Mapping: search, filters, Auto Map, Validate, etc.
 */
export default function MappingToolbar({
  searchValue,
  onSearchChange,
  onAutoMap,
  onValidate,
  onClearUnmapped,
  onSaveWorkingVersion,
  onSaveDraft,
  filterValue,
  onFilterChange,
  onShowUnused,
  onExpandAll,
  onCollapseAll,
}) {
  const handleSave = onSaveWorkingVersion ?? onSaveDraft;
  const filterOptions = [
    { value: "all", label: "All" },
    { value: "command", label: "Command points" },
    { value: "missing", label: "Unmapped command" },
    { value: "auto_mapped", label: "Auto-Mapped" },
    { value: "unused", label: "Unused Objects" },
    { value: "type_mismatch", label: "Type Mismatch" },
  ];

  return (
    <div className="point-mapping-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
      <Form.Group className="mb-0">
        <InputGroup className="input-group-merge legion-search-bar">
          <InputGroup.Text className="legion-search-bar-addon">
            <FontAwesomeIcon icon={faSearch} />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search template point or BACnet object..."
            className="legion-search-bar-input"
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </InputGroup>
      </Form.Group>
      <div className="site-builder-toolbar-divider" />
      <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" onClick={handleSave}>
        Save
      </Button>
      <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" onClick={onAutoMap}>
        <FontAwesomeIcon icon={faMagic} className="me-1" />
        Auto Map
      </Button>
      <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" onClick={onValidate}>
        <FontAwesomeIcon icon={faCheckCircle} className="me-1" />
        Validate Mapping
      </Button>
      <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" onClick={onClearUnmapped}>
        <FontAwesomeIcon icon={faEraser} className="me-1" />
        Clear Unmapped
      </Button>
      <div className="site-builder-toolbar-divider" />
      <select
        className="form-select form-select-sm bg-dark bg-opacity-50 border border-light border-opacity-10 text-white"
        style={{ width: "auto", minWidth: 140 }}
        value={filterValue}
        onChange={(e) => onFilterChange && onFilterChange(e.target.value)}
      >
        {filterOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Dropdown>
        <Dropdown.Toggle
          size="sm"
          variant="dark"
          className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
        >
          Actions <FontAwesomeIcon icon={faEllipsisV} className="ms-1" />
        </Dropdown.Toggle>
        <Dropdown.Menu align="end" className="legion-dropdown-menu bg-dark border border-light border-opacity-10">
          <Dropdown.Item className="text-white" onClick={onShowUnused}>
            <FontAwesomeIcon icon={faEye} className="me-2" /> Show Unused Objects
          </Dropdown.Item>
          <Dropdown.Item className="text-white" onClick={onExpandAll}>
            <FontAwesomeIcon icon={faExpandAlt} className="me-2" /> Expand All
          </Dropdown.Item>
          <Dropdown.Item className="text-white" onClick={onCollapseAll}>
            <FontAwesomeIcon icon={faCompressAlt} className="me-2" /> Collapse All
          </Dropdown.Item>
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item className="text-white">
            <FontAwesomeIcon icon={faRedo} className="me-2" /> Reset Mapping
          </Dropdown.Item>
          <Dropdown.Item className="text-white">
            <FontAwesomeIcon icon={faFileImport} className="me-2" /> Import Template Mapping
          </Dropdown.Item>
          <Dropdown.Item className="text-white">
            <FontAwesomeIcon icon={faFileExport} className="me-2" /> Export Mapping
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
