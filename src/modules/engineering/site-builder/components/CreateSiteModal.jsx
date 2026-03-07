import React, { useState } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";

/**
 * Modal for creating the first site.
 * Fields: Site Name, Address (optional), Description (optional),
 * Default Building Name, Timezone (optional)
 */
export default function CreateSiteModal({ show, onHide, onCreate }) {
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [defaultBuildingName, setDefaultBuildingName] = useState("Building 1");
  const [timezone, setTimezone] = useState("America/New_York");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!siteName.trim()) return;
    onCreate({
      name: siteName.trim(),
      address: address.trim() || undefined,
      description: description.trim() || undefined,
      defaultBuildingName: defaultBuildingName.trim() || "Building 1",
      timezone: timezone.trim() || undefined,
    });
    setSiteName("");
    setAddress("");
    setDescription("");
    setDefaultBuildingName("Building 1");
    setTimezone("America/New_York");
    onHide();
  };

  const handleClose = () => {
    setSiteName("");
    setAddress("");
    setDescription("");
    setDefaultBuildingName("Building 1");
    setTimezone("America/New_York");
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
        <Modal.Title className="h6 text-white">Create Site</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white">
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Site Name *</Form.Label>
            <Form.Control
              required
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. Miami HQ"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Address (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="Street, City, State"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Description (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="Site description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Default Building Name</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="Building 1"
              value={defaultBuildingName}
              onChange={(e) => setDefaultBuildingName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white small">Timezone (optional)</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="legion-hero-btn legion-hero-btn--primary"
            disabled={!siteName.trim()}
          >
            Create Site
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
