import React from "react";
import { Modal, Button } from "@themesberg/react-bootstrap";

/** Placeholder for future multi-subnet / BBMD / directed who-is workflows */
export default function AdvancedScanModal({ show, onHide }) {
  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header closeButton closeVariant="white" className="border-light border-opacity-10">
        <Modal.Title className="h6">Advanced scan</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white-50 small mb-0">
          Directed discovery, BBMD lists, and trunk-specific who-is targeting will be configured here. Hook this modal to the
          supervisory discovery service when backend endpoints are available.
        </p>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button size="sm" variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
