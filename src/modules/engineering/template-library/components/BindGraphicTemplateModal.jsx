import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";

/**
 * Set or change which equipment template a graphic template is bound to (for point bindings).
 */
export default function BindGraphicTemplateModal({
  show,
  onHide,
  graphicTemplateName,
  equipmentTemplates,
  initialEquipmentTemplateId,
  onConfirm,
}) {
  const [equipmentTemplateId, setEquipmentTemplateId] = useState("");

  useEffect(() => {
    if (show) {
      setEquipmentTemplateId(initialEquipmentTemplateId || "");
    }
  }, [show, initialEquipmentTemplateId]);

  const hasTemplates = Array.isArray(equipmentTemplates) && equipmentTemplates.length > 0;

  const handleSubmit = () => {
    if (!equipmentTemplateId) return;
    onConfirm({ equipmentTemplateId });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-primary border-light border-opacity-10">
        <Modal.Title className="text-white">Bind to equipment template</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-primary">
        <p className="text-white-50 small mb-3">
          Link <span className="text-white fw-semibold">{graphicTemplateName || "this graphic"}</span> to an
          equipment template so Graphics Manager can bind objects to that template&apos;s points.
        </p>
        <Form.Group className="mb-0">
          <Form.Label className="text-white">Equipment template</Form.Label>
          <Form.Select
            className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
            value={equipmentTemplateId}
            onChange={(e) => setEquipmentTemplateId(e.target.value)}
            disabled={!hasTemplates}
          >
            <option value="">Select equipment template…</option>
            {(equipmentTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        {!hasTemplates && (
          <div className="text-warning small mt-3">Add an equipment template to this site first.</div>
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
          disabled={!equipmentTemplateId || !hasTemplates}
        >
          Bind template
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
