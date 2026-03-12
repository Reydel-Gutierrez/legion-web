import React, { useState } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import { engineeringRepository } from "../../../../lib/data";

/**
 * Modal for assigning selected discovered devices to equipment or equipment groups.
 * UI-only for now; ready for backend integration.
 */
export default function AssignDevicesModal({
  show,
  onHide,
  selectedCount,
  onAssign,
  siteStructure,
  equipmentOptions = [],
}) {
  const [targetType, setTargetType] = useState("equipment");
  const [equipmentId, setEquipmentId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");

  const buildings = siteStructure?.buildings || [];
  const floors = buildingId
    ? buildings.find((b) => b.id === buildingId)?.floors || []
    : [];
  const equipmentSelectOptions =
    equipmentOptions.length > 0
      ? equipmentOptions
      : [{ value: "", label: "No equipment defined yet" }];
  const groupSource = engineeringRepository.EQUIPMENT_GROUPS || [];
  const groupOptions = groupSource.map((g) => ({ value: g.id, label: g.label }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onAssign) {
      onAssign({
        targetType,
        equipmentId: targetType === "equipment" ? equipmentId : undefined,
        groupId: targetType === "group" ? groupId : undefined,
        buildingId: targetType === "new" ? buildingId : undefined,
        floorId: targetType === "new" ? floorId : undefined,
      });
    }
    onHide();
  };

  return (
    <Modal
      centered
      show={show}
      onHide={onHide}
      contentClassName="bg-primary border border-light border-opacity-10 text-white assign-devices-modal"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Assign Discovered Devices</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white">
          <p className="text-white-50 small mb-3">
            Assign {selectedCount} selected device{selectedCount !== 1 ? "s" : ""} to equipment or an equipment group.
          </p>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Assign to</Form.Label>
            <div className="d-flex gap-2 flex-wrap">
              {["equipment", "group", "unassigned"].map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={targetType === t ? "light" : "outline-light"}
                  className={targetType === t ? "" : "border-opacity-10"}
                  onClick={() => setTargetType(t)}
                >
                  {t === "equipment" ? "Equipment" : t === "group" ? "Equipment Group" : "Unassigned"}
                </Button>
              ))}
            </div>
          </Form.Group>
          {targetType === "equipment" && (
            <Form.Group className="mb-3">
              <Form.Label className="text-white small">Equipment</Form.Label>
              <LegionFormSelect
                options={equipmentSelectOptions}
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                placeholder="Select equipment..."
              />
            </Form.Group>
          )}
          {targetType === "group" && (
            <Form.Group className="mb-3">
              <Form.Label className="text-white small">Equipment Group</Form.Label>
              <LegionFormSelect
                options={groupOptions}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="Select group..."
              />
            </Form.Group>
          )}
          {targetType === "unassigned" && (
            <p className="text-white-50 small mb-0">
              Devices will remain unassigned until you assign them to equipment or a group.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            className="legion-hero-btn legion-hero-btn--primary"
          >
            Assign
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
