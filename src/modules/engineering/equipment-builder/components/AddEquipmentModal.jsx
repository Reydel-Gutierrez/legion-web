import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";

const EQUIPMENT_TYPES = [
  { value: "AHU", label: "Air Handling Unit" },
  { value: "VAV", label: "Variable Air Volume" },
  { value: "FCU", label: "Fan Coil Unit" },
  { value: "CH", label: "Chiller" },
  { value: "CHWP", label: "Chilled Water Pump" },
  { value: "EF", label: "Exhaust Fan" },
  { value: "BLR", label: "Boiler" },
  { value: "CT", label: "Cooling Tower" },
  { value: "CUSTOM", label: "Custom" },
];

/**
 * Modal for adding new equipment.
 * Building and floor options derived from site structure.
 */
export default function AddEquipmentModal({
  show,
  onHide,
  onCreate,
  siteStructure,
  defaultBuildingId,
  defaultFloorId,
}) {
  const [name, setName] = useState("");
  const [equipmentType, setEquipmentType] = useState("AHU");
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [controllerRef, setControllerRef] = useState("");
  const [notes, setNotes] = useState("");

  const buildings = siteStructure?.buildings || [];
  const floors = buildingId
    ? buildings.find((b) => b.id === buildingId)?.floors || []
    : [];

  useEffect(() => {
    if (defaultFloorId && buildings.length) {
      const bldgWithFloor = buildings.find((b) =>
        (b.floors || []).some((f) => f.id === defaultFloorId)
      );
      if (bldgWithFloor) {
        setBuildingId(bldgWithFloor.id);
        setFloorId(defaultFloorId);
        return;
      }
    }
    if (defaultBuildingId && buildings.length) {
      setBuildingId(defaultBuildingId);
      const bldg = buildings.find((b) => b.id === defaultBuildingId);
      if (bldg?.floors?.length) {
        setFloorId(defaultFloorId && (bldg.floors || []).some((f) => f.id === defaultFloorId)
          ? defaultFloorId
          : bldg.floors[0]?.id || "");
      }
    } else if (buildings.length && !buildingId) {
      setBuildingId(buildings[0]?.id || "");
      const firstFloors = buildings[0]?.floors || [];
      setFloorId(firstFloors[0]?.id || "");
    }
  }, [defaultBuildingId, defaultFloorId, buildings, buildingId]);

  useEffect(() => {
    if (buildingId && !floors.some((f) => f.id === floorId)) {
      setFloorId(floors[0]?.id || "");
    }
  }, [buildingId, floors, floorId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      displayLabel: name.trim(),
      equipmentType,
      buildingId,
      floorId,
      templateName: templateName.trim() || undefined,
      controllerRef: controllerRef.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    resetForm();
    onHide();
  };

  const resetForm = () => {
    setName("");
    setEquipmentType("AHU");
    setBuildingId(buildings[0]?.id || "");
    setFloorId(buildings[0]?.floors?.[0]?.id || "");
    setTemplateName("");
    setControllerRef("");
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onHide();
  };

  return (
    <Modal
      centered
      show={show}
      onHide={handleClose}
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Add Equipment</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white">
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Equipment Name *</Form.Label>
            <Form.Control
              required
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. AHU-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Equipment Type</Form.Label>
            <LegionFormSelect
              size="sm"
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              options={EQUIPMENT_TYPES}
              placeholder="Select type"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Building</Form.Label>
            <LegionFormSelect
              size="sm"
              value={buildingId}
              onChange={(e) => {
                setBuildingId(e.target.value);
                setFloorId("");
              }}
              options={buildings.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Select building"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Floor</Form.Label>
            <LegionFormSelect
              size="sm"
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              options={floors.map((f) => ({ value: f.id, label: f.name }))}
              placeholder="Select floor"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Template (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. LC VMA-1832 AHU"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Controller (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. BACnet/IP: 43001"
              value={controllerRef}
              onChange={(e) => setControllerRef(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white small">Notes (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="legion-hero-btn legion-hero-btn--primary"
            disabled={!name.trim()}
          >
            Add Equipment
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
