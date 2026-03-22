import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";

/**
 * Minimal fields to store a graphic in the site Template Library.
 */
export default function SaveGraphicTemplateModal({
  show,
  onHide,
  equipmentTemplates,
  initialName,
  initialEquipmentTemplateId,
  isUpdate,
  onSave,
}) {
  const [name, setName] = useState("");
  const [equipmentTemplateId, setEquipmentTemplateId] = useState("");

  useEffect(() => {
    if (show) {
      setName(initialName || "");
      setEquipmentTemplateId(initialEquipmentTemplateId || "");
    }
  }, [show, initialName, initialEquipmentTemplateId]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, equipmentTemplateId: equipmentTemplateId || null });
  };

  const hasTemplates = Array.isArray(equipmentTemplates) && equipmentTemplates.length > 0;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-primary border-light border-opacity-10">
        <Modal.Title className="text-white">
          {isUpdate ? "Update graphic template" : "Save as template"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-primary">
        <Form.Group className="mb-3">
          <Form.Label className="text-white">Template name</Form.Label>
          <Form.Control
            className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AHU overview"
          />
        </Form.Group>
        <Form.Group className="mb-0">
          <Form.Label className="text-white">
            Applies to equipment template <span className="text-white-50 fw-normal">(optional)</span>
          </Form.Label>
          <Form.Select
            className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
            value={equipmentTemplateId}
            onChange={(e) => setEquipmentTemplateId(e.target.value)}
            disabled={!hasTemplates}
          >
            <option value="">None — bind later from Template Library if needed</option>
            {(equipmentTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        {!hasTemplates && (
          <div className="text-white-50 small mt-3">
            No equipment templates on this site yet. You can still save; add templates anytime and bind from
            Template Library → Graphic Templates → Actions.
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-primary border-light border-opacity-10">
        <Button variant="outline-light" size="sm" onClick={onHide}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          {isUpdate ? "Update template" : "Save template"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
