import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import { useHistory } from "react-router-dom";
import { Routes } from "../../../../routes";

/**
 * Pick an equipment template, then open Graphics Manager to author a reusable graphic template
 * (template points come from that equipment definition).
 */
export default function CreateGraphicTemplateModal({ show, onHide, equipmentTemplates = [] }) {
  const history = useHistory();
  const [equipmentTemplateId, setEquipmentTemplateId] = useState("");

  useEffect(() => {
    if (show) {
      const first = equipmentTemplates[0]?.id || "";
      setEquipmentTemplateId(first);
    }
  }, [show, equipmentTemplates]);

  const handleOpenManager = () => {
    if (!equipmentTemplateId) return;
    if (typeof onHide === "function") {
      onHide();
    }
    const q = new URLSearchParams({
      newGraphicTemplate: "1",
      equipmentTemplateId,
    });
    history.push(`${Routes.EngineeringGraphicsManager.path}?${q.toString()}`);
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Create graphic template</Modal.Title>
        <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={onHide} aria-label="Close">
          <span aria-hidden>×</span>
        </Button>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white-50 small mb-3">
          Choose which equipment template supplies the template points for bindings. You will design the graphic in Graphics
          Manager; when finished, use <strong className="text-white">Save As Template</strong> to add it to this site&apos;s
          Template Library. Publish to the company library from Template Library → Actions → Save to Global Library.
        </p>
        <Form.Label className="text-white-50 small">Equipment template</Form.Label>
        <Form.Select
          className="bg-dark border-light border-opacity-25 text-white"
          value={equipmentTemplateId}
          onChange={(e) => setEquipmentTemplateId(e.target.value)}
          disabled={!equipmentTemplates.length}
        >
          {!equipmentTemplates.length ? (
            <option value="">No equipment templates — create or import one first</option>
          ) : (
            equipmentTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.equipmentType || "—"})
              </option>
            ))
          )}
        </Form.Select>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button size="sm" variant="secondary" className="legion-hero-btn legion-hero-btn--secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={handleOpenManager}
          disabled={!equipmentTemplateId}
        >
          Open in Graphics Manager
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
