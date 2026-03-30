import React from "react";
import { Button, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faSave,
  faLink,
  faFileImport,
  faImage,
  faCopy,
  faTrashAlt,
  faEye,
  faEllipsisV,
  faCheckCircle,
  faCloudUploadAlt,
  faSpinner,
  faDrawPolygon,
  faPalette,
  faWindowMaximize,
  faMousePointer,
  faUndo,
  faArchive,
  faMapMarkedAlt,
} from "@fortawesome/free-solid-svg-icons";
import GraphicsSelectControl from "./GraphicsSelectControl";

/**
 * Toolbar for Graphics Manager: Select where to work, Save as template, Assign, New Graphic, Import, Duplicate, Delete, Preview, Validate.
 */
export default function GraphicsToolbar({
  layoutNodes,
  equipmentList,
  selectedLayoutNodeId,
  selectedEquipmentId,
  selectedLayoutNode,
  selectedEquipment,
  onSelectLayoutNode,
  onSelectEquipment,
  onOpenTreeModal,
  selectDisabled,
  filterValue,
  onFilterChange,
  onSaveAsTemplate,
  onAssignGraphic,
  onNewGraphic,
  onImportSvg,
  onImportImage,
  onDuplicate,
  onDelete,
  onPreview,
  onValidate,
  hasSelection,
  canPublishGraphicToGlobal = false,
  publishingGraphicToGlobal = false,
  onPublishGraphicToGlobal,
  selectedObjectIsShape = false,
  selectedZoneEnabled = false,
  onAddZone,
  onOpenZoneSettings,
  liveZonePreview = false,
  onToggleLiveZonePreview,
  onResetZoneStyle,
  onDuplicateZoneConfig,
  onOpenBindingMap,
  onArchiveGraphic,
  onRestoreGraphic,
  lifecycleStatus = "draft",
  graphicsCategory = "equipment",
  onGraphicsCategoryChange,
}) {
  const filterOptions = [
    { value: "all", label: "All" },
    { value: "floor_plan", label: "Floor Plans" },
    { value: "equipment_diagram", label: "Equipment Diagrams" },
    { value: "system_view", label: "System Views" },
  ];

  return (
    <div className="graphics-manager-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
      <GraphicsSelectControl
        inline
        layoutNodes={layoutNodes || []}
        equipmentList={equipmentList || []}
        selectedLayoutNodeId={selectedLayoutNodeId}
        selectedEquipmentId={selectedEquipmentId}
        selectedLayoutNode={selectedLayoutNode}
        selectedEquipment={selectedEquipment}
        onSelectLayoutNode={onSelectLayoutNode}
        onSelectEquipment={onSelectEquipment}
        onOpenTreeModal={onOpenTreeModal}
        disabled={selectDisabled}
      />
      <div className="site-builder-toolbar-divider" />
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--primary"
        onClick={onSaveAsTemplate}
        title="Save the current graphic to the Template Library as a reusable graphic template"
      >
        <FontAwesomeIcon icon={faSave} className="me-1" />
        Save As Template
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--primary"
        onClick={onAssignGraphic}
        title="Assign graphic to site, building, floor, or equipment"
      >
        <FontAwesomeIcon icon={faLink} className="me-1" />
        Assign Graphic
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
        title={hasSelection ? "Set SVG as workspace background" : "Assign a site, building, floor, or equipment first (opens Assign Graphic)"}
      >
        <FontAwesomeIcon icon={faFileImport} className="me-1" />
        Import SVG
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onImportImage}
        title={hasSelection ? "Set image as workspace background" : "Assign a site, building, floor, or equipment first (opens Assign Graphic)"}
      >
        <FontAwesomeIcon icon={faImage} className="me-1" />
        Import Image
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onDuplicate}
        title={hasSelection ? "Duplicate this graphic" : "Assign a site, building, floor, or equipment first (opens Assign Graphic)"}
      >
        <FontAwesomeIcon icon={faCopy} className="me-1" />
        Duplicate
      </Button>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary"
        onClick={onDelete}
        title={hasSelection ? "Delete this graphic (imported image and all objects)" : "Assign a site, building, floor, or equipment first (opens Assign Graphic)"}
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
      <Dropdown>
        <Dropdown.Toggle
          size="sm"
          variant="dark"
          className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
          disabled={!hasSelection}
        >
          <FontAwesomeIcon icon={faDrawPolygon} className="me-1" />
          Floor zones
        </Dropdown.Toggle>
        <Dropdown.Menu className="legion-dropdown-menu bg-dark border border-light border-opacity-10">
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedObjectIsShape}
            onClick={() => typeof onAddZone === "function" && onAddZone()}
          >
            <FontAwesomeIcon icon={faPlus} className="me-2" />
            Add / convert to zone
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onOpenZoneSettings === "function" && onOpenZoneSettings("general")}
          >
            Zone settings
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onOpenZoneSettings === "function" && onOpenZoneSettings("visual")}
          >
            <FontAwesomeIcon icon={faPalette} className="me-2" />
            State colors
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onOpenZoneSettings === "function" && onOpenZoneSettings("wedge")}
          >
            <FontAwesomeIcon icon={faWindowMaximize} className="me-2" />
            Wedge & interaction
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onOpenBindingMap === "function" && onOpenBindingMap()}
          >
            <FontAwesomeIcon icon={faMapMarkedAlt} className="me-2" />
            Binding map
          </Dropdown.Item>
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onResetZoneStyle === "function" && onResetZoneStyle()}
          >
            Reset zone style
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || !selectedZoneEnabled}
            onClick={() => typeof onDuplicateZoneConfig === "function" && onDuplicateZoneConfig()}
          >
            <FontAwesomeIcon icon={faCopy} className="me-2" />
            Duplicate zone config
          </Dropdown.Item>
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item
            className={liveZonePreview ? "text-info" : "text-white"}
            disabled={!hasSelection}
            onClick={() => typeof onToggleLiveZonePreview === "function" && onToggleLiveZonePreview()}
          >
            <FontAwesomeIcon icon={faMousePointer} className="me-2" />
            {liveZonePreview ? "Exit live zone preview" : "Preview live zone"}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <div className="site-builder-toolbar-divider" />
      <select
        className="form-select form-select-sm bg-dark bg-opacity-50 border border-light border-opacity-10 text-white"
        style={{ width: "auto", minWidth: 120 }}
        value={graphicsCategory}
        onChange={(e) => onGraphicsCategoryChange?.(e.target.value)}
        title="Graphics type"
        disabled={!hasSelection}
      >
        <option value="floor">Floor</option>
        <option value="equipment">Equipment</option>
        <option value="building">Building</option>
        <option value="site">Site</option>
      </select>
      <span
        className={`badge border small ${
          lifecycleStatus === "active"
            ? "bg-success bg-opacity-25 text-success border-success border-opacity-40"
            : lifecycleStatus === "archived"
              ? "bg-secondary bg-opacity-40 text-white-50 border-secondary"
              : "bg-warning bg-opacity-15 text-warning border-warning border-opacity-40"
        }`}
        title="Graphic lifecycle"
      >
        {lifecycleStatus === "active" ? "Active" : lifecycleStatus === "archived" ? "Archived" : "Draft"}
      </span>
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
          {typeof onPublishGraphicToGlobal === "function" && (
            <Dropdown.Item
              className="text-white"
              disabled={!canPublishGraphicToGlobal || publishingGraphicToGlobal}
              onClick={() => canPublishGraphicToGlobal && !publishingGraphicToGlobal && onPublishGraphicToGlobal()}
            >
              {publishingGraphicToGlobal ? (
                <FontAwesomeIcon icon={faSpinner} spin className="me-2" />
              ) : (
                <FontAwesomeIcon icon={faCloudUploadAlt} className="me-2" />
              )}
              Save to Global Library
            </Dropdown.Item>
          )}
          <Dropdown.Divider className="border-light border-opacity-10" />
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || lifecycleStatus === "archived"}
            onClick={() => typeof onArchiveGraphic === "function" && onArchiveGraphic()}
          >
            <FontAwesomeIcon icon={faArchive} className="me-2" />
            Archive graphic
          </Dropdown.Item>
          <Dropdown.Item
            className="text-white"
            disabled={!hasSelection || lifecycleStatus !== "archived"}
            onClick={() => typeof onRestoreGraphic === "function" && onRestoreGraphic()}
          >
            <FontAwesomeIcon icon={faUndo} className="me-2" />
            Restore graphic
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
