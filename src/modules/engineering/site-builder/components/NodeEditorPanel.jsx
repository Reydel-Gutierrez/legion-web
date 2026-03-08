import React, { useState, useEffect } from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";

import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import EquipmentEditorPanel from "../../equipment-builder/components/EquipmentEditorPanel";

/**
 * Right panel: Edit selected node (Site, Building, or Floor) or Equipment
 */
export default function NodeEditorPanel({
  node,
  selectedEquipment,
  breadcrumb,
  floors = [],
  onSave,
  onSaveEquipment,
  onDelete,
  onDeleteEquipment,
  onDeleteConfirm,
}) {
  const [form, setForm] = useState({
    name: "",
    displayLabel: "",
    description: "",
    icon: "",
    sortOrder: 0,
    siteType: "",
    timezone: "America/New_York",
    address: "",
    status: "Active",
    engineeringNotes: "",
    buildingType: "",
    buildingCode: "",
    floorType: "",
    occupancyType: "",
  });

  useEffect(() => {
    if (node) {
      setForm({
        name: node.name || "",
        displayLabel: node.displayLabel || node.name || "",
        description: node.description || "",
        icon: node.icon || "",
        sortOrder: node.sortOrder ?? 0,
        siteType: node.siteType || "",
        timezone: node.timezone || "America/New_York",
        address: node.address || "",
        status: node.status || "Active",
        engineeringNotes: node.engineeringNotes || "",
        buildingType: node.buildingType || "",
        buildingCode: node.buildingCode || "",
        floorType: node.floorType || "",
        occupancyType: node.occupancyType || "",
      });
    }
  }, [node]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(node?.id, form);
    }
  };

  const handleDelete = () => {
    if (node?.children?.length) {
      if (onDeleteConfirm) {
        onDeleteConfirm(node);
      }
    } else {
      if (onDelete) {
        onDelete(node?.id);
      }
    }
  };

  if (!node && !selectedEquipment) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center text-white-50 py-5">
          <div className="small">Select a node or equipment from the tree to edit</div>
        </Card.Body>
      </Card>
    );
  }

  // Equipment editor mode
  if (selectedEquipment) {
    return (
      <EquipmentEditorPanel
        equipment={selectedEquipment}
        breadcrumb={breadcrumb}
        floors={floors || []}
        onSave={onSaveEquipment}
        onDelete={onDeleteEquipment}
      />
    );
  }

  const nodeTypeLabel = node.type === "site" ? "Site" : node.type === "building" ? "Building" : "Floor";

  return (
    <Card className="bg-primary border border-light border-opacity-10 h-100">
      <Card.Header className="bg-transparent border-light border-opacity-10">
        <div className="text-white fw-bold">Edit Node</div>
        <div className="text-white-50 small mt-1">{breadcrumb || node.name}</div>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Name</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Node name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Display Label</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.displayLabel}
              onChange={(e) => handleChange("displayLabel", e.target.value)}
              placeholder="Display label"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Optional description"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Node Type</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
              value={nodeTypeLabel}
              readOnly
              disabled
            />
          </Form.Group>

          {node.type === "site" && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Site Type</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.siteType}
                  onChange={(e) => handleChange("siteType", e.target.value)}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "Office", label: "Office" },
                    { value: "Campus", label: "Campus" },
                    { value: "Residential", label: "Residential" },
                    { value: "Mixed Use", label: "Mixed Use" },
                    { value: "Garage", label: "Garage" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select..."
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Timezone</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  options={[
                    { value: "America/New_York", label: "America/New_York" },
                    { value: "America/Chicago", label: "America/Chicago" },
                    { value: "America/Denver", label: "America/Denver" },
                    { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                    { value: "UTC", label: "UTC" },
                  ]}
                  placeholder="Select timezone"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Address</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Street, City, State"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Status</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Draft", label: "Draft" },
                    { value: "Archived", label: "Archived" },
                  ]}
                  placeholder="Status"
                />
              </Form.Group>
            </>
          )}

          {node.type === "building" && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Building Type</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.buildingType}
                  onChange={(e) => handleChange("buildingType", e.target.value)}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "Office Tower", label: "Office Tower" },
                    { value: "Garage", label: "Garage" },
                    { value: "Mechanical", label: "Mechanical" },
                    { value: "Residential", label: "Residential" },
                    { value: "Mixed Use", label: "Mixed Use" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select..."
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Building Code / Ref</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.buildingCode}
                  onChange={(e) => handleChange("buildingCode", e.target.value)}
                  placeholder="e.g. TA, TB"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Sort Order</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.sortOrder}
                  onChange={(e) => handleChange("sortOrder", parseInt(e.target.value, 10) || 0)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Status</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Draft", label: "Draft" },
                    { value: "Archived", label: "Archived" },
                  ]}
                  placeholder="Status"
                />
              </Form.Group>
            </>
          )}

          {node.type === "floor" && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Floor Type</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.floorType}
                  onChange={(e) => handleChange("floorType", e.target.value)}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "Standard Floor", label: "Standard Floor" },
                    { value: "Roof", label: "Roof" },
                    { value: "Mechanical Level", label: "Mechanical Level" },
                    { value: "Basement", label: "Basement" },
                    { value: "Parking Level", label: "Parking Level" },
                    { value: "Penthouse", label: "Penthouse" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select..."
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Occupancy Type</Form.Label>
                <LegionFormSelect
                  size="sm"
                  value={form.occupancyType}
                  onChange={(e) => handleChange("occupancyType", e.target.value)}
                  options={[
                    { value: "", label: "Select..." },
                    { value: "Office", label: "Office" },
                    { value: "Tenant", label: "Tenant" },
                    { value: "Common Area", label: "Common Area" },
                    { value: "Mechanical", label: "Mechanical" },
                    { value: "Parking", label: "Parking" },
                    { value: "Mixed", label: "Mixed" },
                  ]}
                  placeholder="Select..."
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Sort Order</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.sortOrder}
                  onChange={(e) => handleChange("sortOrder", parseInt(e.target.value, 10) || 0)}
                />
              </Form.Group>
              {(node.equipmentCount > 0 || (node.equipmentPreview && node.equipmentPreview.length > 0)) && (
                <Form.Group className="mb-3">
                  <Form.Label className="text-white small">Equipment Preview Count</Form.Label>
                  <Form.Control
                    size="sm"
                    className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
                    value={node.equipmentCount ?? node.equipmentPreview?.length ?? 0}
                    readOnly
                    disabled
                  />
                </Form.Group>
              )}
            </>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Engineering Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.engineeringNotes}
              onChange={(e) => handleChange("engineeringNotes", e.target.value)}
              placeholder="Optional engineering notes"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Icon</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.icon}
              onChange={(e) => handleChange("icon", e.target.value)}
              placeholder="Icon name (optional)"
            />
          </Form.Group>
        </Form>

        <div className="d-flex gap-2 mt-3 pt-3 border-top border-light border-opacity-10">
          <Button
            size="sm"
            variant="outline-danger"
            className="border-opacity-25"
            onClick={handleDelete}
          >
            <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
            Delete Node
          </Button>
          <Button
            size="sm"
            className="legion-hero-btn legion-hero-btn--primary ms-auto"
            onClick={handleSave}
          >
            Save Node
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
