import React, { useState } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";

/**
 * Modal for adding a custom equipment group.
 * Lightweight UI-only grouping for now.
 */
export default function AddEquipmentGroupModal({ show, onHide, onCreate }) {
  const [groupName, setGroupName] = useState("");
  const [iconType, setIconType] = useState("folder");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onCreate({
      name: groupName.trim(),
      iconType: iconType.trim() || "folder",
    });
    setGroupName("");
    setIconType("folder");
    onHide();
  };

  const handleClose = () => {
    setGroupName("");
    setIconType("folder");
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
        <Modal.Title className="h6 text-white">Add Equipment Group</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white">
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Group Name *</Form.Label>
            <Form.Control
              required
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. Custom Zone Equipment"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white small">Icon / Type (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="folder"
              value={iconType}
              onChange={(e) => setIconType(e.target.value)}
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
            disabled={!groupName.trim()}
          >
            Add Group
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
