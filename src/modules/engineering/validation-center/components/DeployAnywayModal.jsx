import React, { useState } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";

/**
 * Confirmation modal for Deploy Anyway when there are blocking errors.
 */
export default function DeployAnywayModal({
  show,
  onHide,
  onConfirm,
  errorCount,
  warningCount,
}) {
  const [reason, setReason] = useState("");
  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
    onHide();
  };
  const handleClose = () => {
    setReason("");
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      className="legion-modal-dark"
      contentClassName="bg-primary border border-light border-opacity-10"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="text-white">Override deployment</Modal.Title>
        <button
          type="button"
          className="btn-close btn-close-white"
          aria-label="Close"
          onClick={handleClose}
        />
      </Modal.Header>
      <Modal.Body className="text-white-50">
        <p className="mb-3">
          You are about to deploy a configuration with unresolved validation errors. This may result in missing graphics, unmapped points, offline controllers, or incomplete system operation.
        </p>
        <div className="mb-3">
          <span className="text-danger me-2">{errorCount} blocking error{errorCount !== 1 ? "s" : ""}</span>
          <span className="text-warning">{warningCount} warning{warningCount !== 1 ? "s" : ""}</span>
        </div>
        <Form.Group className="mb-0">
          <Form.Label className="text-white-50 small">Reason for override (optional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="bg-dark border border-light border-opacity-10 text-white"
            placeholder="e.g. Commissioning in progress, will fix post-deploy"
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm}>
          Confirm Override Deployment
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
