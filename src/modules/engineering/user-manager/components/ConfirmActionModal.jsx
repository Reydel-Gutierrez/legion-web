import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function ConfirmActionModal({ show, onHide, onConfirm, title, body, confirmLabel = "Confirm", confirmVariant = "danger" }) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      className="legion-modal-dark engineering-light-form"
      contentClassName="bg-primary border border-light border-opacity-10"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="text-white">{title}</Modal.Title>
        <button type="button" className="btn-close" aria-label="Close" onClick={onHide} />
      </Modal.Header>
      <Modal.Body className="text-white-50">{body}</Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
