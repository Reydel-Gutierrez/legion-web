import React from "react";
import { Modal, Button } from "@themesberg/react-bootstrap";

/**
 * Placeholder modal for Graphic Template Editor (future).
 * Would require equipment template association.
 */
export default function CreateGraphicTemplateModal({ show, onHide }) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Graphic Template Editor</Modal.Title>
        <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={onHide} aria-label="Close">
          <span aria-hidden>×</span>
        </Button>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white-50 small mb-0">
          Graphic template editor will be implemented here. You will select an equipment template and design the graphic with bindings to template points.
        </p>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button size="sm" variant="secondary" className="legion-hero-btn legion-hero-btn--secondary" onClick={onHide}>
          Close
        </Button>
        <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" disabled>
          Save (placeholder)
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
