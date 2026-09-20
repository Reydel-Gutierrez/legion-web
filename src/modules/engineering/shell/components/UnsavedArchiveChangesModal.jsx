import React from "react";
import { Modal, Button } from "react-bootstrap";

/** Guards New/Import/Open/Close/Delete against losing edits in the currently open archive. */
export default function UnsavedArchiveChangesModal({ show, label, onSave, onDiscard, onCancel }) {
  return (
    <Modal show={show} onHide={onCancel} centered className="engineering-light-form" contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Unsaved changes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white-50 small mb-0">
          You have unsaved changes in &quot;{label}&quot;. Save before continuing?
        </p>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline-light" onClick={onDiscard}>
          Don&apos;t Save
        </Button>
        <Button className="legion-hero-btn legion-hero-btn--primary" onClick={onSave}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
