import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

const STEPS = [
  { key: "name", label: "Name" },
  { key: "details", label: "Details" },
];

const INITIAL_FORM = {
  siteName: "",
  description: "",
  timezone: "America/New_York",
  location: "",
};

/**
 * "+" → Create Site — a short wizard (Name → Details) rather than one long form, so the only thing
 * standing between a user and a usable site is its name. Buildings/floors/equipment are added
 * afterward from the sidebar's +, not seeded here. Location is a plain text field, not a map — most
 * BMS deployments run with no internet access, so no live map tiles or address geocoding here.
 */
export default function CreateSiteModal({ show, onHide, onCreate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const reset = () => {
    setStep(0);
    setForm(INITIAL_FORM);
  };

  const handleClose = () => {
    reset();
    onHide();
  };

  const canAdvance = step !== 0 || form.siteName.trim().length > 0;

  const handleNext = () => {
    if (!canAdvance) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    if (!form.siteName.trim()) return;
    onCreate({
      name: form.siteName.trim(),
      description: form.description.trim() || undefined,
      timezone: form.timezone.trim() || undefined,
      location: form.location.trim() ? { address: form.location.trim() } : null,
    });
    reset();
    onHide();
  };

  return (
    <Modal
      centered
      show={show}
      onHide={handleClose}
      className="engineering-light-form"
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Create Site</Modal.Title>
      </Modal.Header>

      <div className="create-site-steps px-3 pt-3">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`create-site-steps__item${i === step ? " is-active" : ""}${i < step ? " is-done" : ""}`}>
            <span className="create-site-steps__dot">{i < step ? <FontAwesomeIcon icon={faCheck} /> : i + 1}</span>
            <span className="create-site-steps__label">{s.label}</span>
            {i < STEPS.length - 1 ? <span className="create-site-steps__line" /> : null}
          </div>
        ))}
      </div>

      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white">
          {step === 0 ? (
            <Form.Group className="mb-0">
              <Form.Label className="text-white small">Site Name *</Form.Label>
              <Form.Control
                autoFocus
                required
                size="sm"
                className="bg-dark border border-light border-opacity-10 text-white"
                placeholder="e.g. Miami HQ"
                value={form.siteName}
                onChange={(e) => handleChange("siteName", e.target.value)}
              />
            </Form.Group>
          ) : null}

          {step === 1 ? (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Description (optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  size="sm"
                  className="bg-dark border border-light border-opacity-10 text-white"
                  placeholder="Site description"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="text-white small">Location (optional)</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark border border-light border-opacity-10 text-white"
                  placeholder="e.g. 123 Main St, Miami, FL"
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-0">
                <Form.Label className="text-white small">Timezone *</Form.Label>
                <Form.Select
                  size="sm"
                  className="bg-dark border border-light border-opacity-10 text-white"
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                >
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Denver">America/Denver</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="UTC">UTC</option>
                </Form.Select>
              </Form.Group>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10 justify-content-between">
          <Button variant="link" className="text-white-50 p-0" onClick={handleClose}>
            Cancel
          </Button>
          <div className="d-flex gap-2">
            {step > 0 ? (
              <Button variant="outline-light" size="sm" onClick={handleBack}>
                Back
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              disabled={!canAdvance}
            >
              {step < STEPS.length - 1 ? "Next" : "Create Site"}
            </Button>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
