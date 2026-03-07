import React, { useState, useEffect } from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { EQUIPMENT_TYPE_OPTIONS } from "../equipmentTypes";
import { EQUIPMENT_STATUSES } from "../../data/mockEngineeringData";

/**
 * Right panel: Edit selected equipment.
 * Matches NodeEditorPanel structure and styling from Site Builder.
 */
export default function EquipmentEditorPanel({
  equipment,
  breadcrumb,
  floors,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState({
    name: "",
    displayLabel: "",
    equipmentType: "",
    controllerRef: "",
    templateName: "",
    floorId: "",
    locationLabel: "",
    notes: "",
  });

  useEffect(() => {
    if (equipment) {
      setForm({
        name: equipment.name || "",
        displayLabel: equipment.displayLabel || equipment.name || "",
        equipmentType: equipment.type || "",
        controllerRef: equipment.controllerRef || "",
        templateName: equipment.templateName || "",
        floorId: equipment.floorId || "",
        locationLabel: equipment.locationLabel || "",
        notes: equipment.notes || "",
      });
    }
  }, [equipment]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (onSave && equipment) {
      onSave(equipment.id, form);
    }
  };

  const handleDelete = () => {
    if (onDelete && equipment) {
      onDelete(equipment.id);
    }
  };

  if (!equipment) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center text-white-50 py-5">
          <div className="small">Select equipment to edit.</div>
        </Card.Body>
      </Card>
    );
  }

  const statusLabel = EQUIPMENT_STATUSES[equipment.status] || equipment.status || "Draft";

  return (
    <Card className="bg-primary border border-light border-opacity-10 align-self-start">
      <Card.Header className="bg-transparent border-light border-opacity-10">
        <div className="text-white fw-bold">Edit Equipment</div>
        <div className="text-white-50 small mt-1">{breadcrumb || equipment.name}</div>
      </Card.Header>
      <Card.Body className="d-flex flex-column">
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Name</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Equipment name"
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
            <Form.Label className="text-white small">Equipment Type</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.equipmentType}
              onChange={(e) => handleChange("equipmentType", e.target.value)}
            >
              {EQUIPMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Assign Controller</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.controllerRef || ""}
              onChange={(e) => handleChange("controllerRef", e.target.value)}
            >
              <option value="">Unassigned</option>
              <option value="43001">BACnet/IP: 43001</option>
              <option value="43002">BACnet/IP: 43002</option>
              <option value="43020">BACnet/IP: 43020</option>
              <option value="43021">BACnet/IP: 43021</option>
              <option value="43100">BACnet/IP: 43100</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Template</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.templateName || ""}
              onChange={(e) => handleChange("templateName", e.target.value)}
            >
              <option value="">Select template</option>
              <option value="LC VMA-1832 AHU">LC VMA-1832 AHU</option>
              <option value="LC VAV-1832">LC VAV-1832</option>
              <option value="LC FCU-2-Pipe">LC FCU-2-Pipe</option>
              <option value="LC Chiller-500Ton">LC Chiller-500Ton</option>
              <option value="LC CHWP-VFD">LC CHWP-VFD</option>
              <option value="LC ExhaustFan">LC ExhaustFan</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Status</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
              value={statusLabel}
              readOnly
              disabled
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Floor / Location</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.floorId}
              onChange={(e) => handleChange("floorId", e.target.value)}
            >
              <option value="">Select floor</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </Form.Group>
        </Form>

        <div className="d-flex gap-2 mt-auto pt-3 border-top border-light border-opacity-10">
          <Button
            size="sm"
            variant="outline-danger"
            className="border-opacity-25"
            onClick={handleDelete}
          >
            <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
            Delete Equipment
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
