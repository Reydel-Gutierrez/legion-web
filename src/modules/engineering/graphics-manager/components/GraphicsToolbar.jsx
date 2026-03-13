import React from "react";
import { Form, InputGroup, Button, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faSave,
  faFileImport,
  faImage,
  faCopy,
  faTrashAlt,
  faEye,
  faEllipsisV,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Toolbar for Graphics Manager: Save, New Graphic, Import, Duplicate, Delete, Preview, Validate.
 */
export default function GraphicsToolbar({
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  onSaveGraphic,
  onNewGraphic,
  onImportSvg,
  onImportImage,
  onDuplicate,
  onDelete,
  onPreview,
  onValidate,
  hasSelection,
}) {
  const filterOptions = [
    { value: "all", label: "All" },
    { value: "floor_plan", label: "Floor Plans" },
    { value: "equipment_diagram", label: "Equipment Diagrams" },
    { value: "system_view", label: "System Views" },
  ];

  return (
    <div className="graphics-manager-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
      <Form.Group className="mb-0">
        <InputGroup className="input-group-merge legion-search-bar">
          <InputGroup.Text className="legion-search-bar-addon">
            <FontAwesomeIcon icon={faSearch} />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search graphics..."
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
        onClick={onSaveGraphic}
        disabled={!hasSelection}
        title={hasSelection ? "Save graphic and bind to this equipment" : "Select equipment first"}
      >
        <FontAwesomeIcon icon={faSave} className="me-1" />
        Save graphic
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onNewGraphic}
      >
        <FontAwesomeIcon icon={faPlus} className="me-1" />
        New Graphic
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onImportSvg}
      >
        <FontAwesomeIcon icon={faFileImport} className="me-1" />
        Import SVG
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onImportImage}
      >
        <FontAwesomeIcon icon={faImage} className="me-1" />
        Import Image
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onDuplicate}
        disabled={!hasSelection}
      >
        <FontAwesomeIcon icon={faCopy} className="me-1" />
        Duplicate
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onDelete}
        disabled={!hasSelection}
      >
        <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
        Delete
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onPreview}
      >
        <FontAwesomeIcon icon={faEye} className="me-1" />
        Preview
      </Button>
      <div className="site-builder-toolbar-divider" />
      <select
        className="form-select form-select-sm bg-dark bg-opacity-50 border border-light border-opacity-10 text-white"
        style={{ width: "auto", minWidth: 140 }}
        value={filterValue}
        onChange={(e) => onFilterChange?.(e.target.value)}
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
        <Dropdown.Menu
          align="end"
          className="legion-dropdown-menu bg-dark border border-light border-opacity-10"
        >
          <Dropdown.Item className="text-white" onClick={onValidate}>
            <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
            Validate Graphics
          </Dropdown.Item>
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item className="text-white">
            Export Graphics
          </Dropdown.Item>
          <Dropdown.Item className="text-white">
            Batch Update Bindings
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
