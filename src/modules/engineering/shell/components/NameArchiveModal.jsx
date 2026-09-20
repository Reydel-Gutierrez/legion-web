import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { isArchiveNameTaken } from "../../../../lib/data/persistence/archiveCatalog";

/** Prompts for an archive name (New/Import/first Save) and enforces uniqueness against the catalog. */
export default function NameArchiveModal({ show, title, confirmLabel = "Save", defaultName = "", excludeId, onConfirm, onCancel }) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      setName(defaultName);
      setError("");
    }
  }, [show, defaultName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this archive.");
      return;
    }
    if (isArchiveNameTaken(trimmed, excludeId)) {
      setError(`An archive named "${trimmed}" already exists.`);
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Modal show={show} onHide={onCancel} centered className="engineering-light-form" contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">{title}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="text-white small">Archive name</Form.Label>
            <Form.Control
              autoFocus
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Miami HQ - March"
            />
          </Form.Group>
          <p className="small text-white-50 mt-2 mb-0">No two archives in the library can share a name.</p>
          {error ? <p className="small text-warning mt-2 mb-0">{error}</p> : null}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="legion-hero-btn legion-hero-btn--primary" disabled={!name.trim()}>
            {confirmLabel}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
