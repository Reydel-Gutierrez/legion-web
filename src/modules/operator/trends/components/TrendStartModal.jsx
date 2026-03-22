import React, { useEffect, useState, useMemo } from "react";
import { Modal, Form, Button } from "@themesberg/react-bootstrap";

const PRESETS = [7, 14, 30, 60, 90];

/**
 * Choose recording duration, then confirm to start the trend session (mock historian).
 *
 * @param {{
 *   show: boolean;
 *   onHide: () => void;
 *   onConfirm: (durationDays: number) => void;
 * }} props
 */
export default function TrendStartModal({ show, onHide, onConfirm }) {
  const [preset, setPreset] = useState(14);
  const [useCustom, setUseCustom] = useState(false);
  const [customDays, setCustomDays] = useState("14");

  useEffect(() => {
    if (show) {
      setPreset(14);
      setUseCustom(false);
      setCustomDays("14");
    }
  }, [show]);

  const resolvedDays = useMemo(() => {
    if (useCustom) {
      const n = Math.floor(Number(customDays));
      return Math.max(1, Math.min(365, Number.isFinite(n) ? n : 14));
    }
    return preset;
  }, [useCustom, customDays, preset]);

  const apply = () => {
    onConfirm(resolvedDays);
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md" contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header closeButton className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Start trend recording</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white small opacity-90 mb-3 mb-md-4">
          Choose how long this recording session should run. The chart will switch to match that window, and history will collect for the selected points (mock).
        </p>
        <div className="text-white fw-semibold small mb-2">Duration</div>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {PRESETS.map((d) => (
            <Button
              key={d}
              size="sm"
              type="button"
              variant={!useCustom && preset === d ? "light" : "outline-light"}
              className={
                !useCustom && preset === d ? "text-primary fw-semibold" : "border-opacity-10"
              }
              onClick={() => {
                setUseCustom(false);
                setPreset(d);
              }}
            >
              {d} days
            </Button>
          ))}
          <Button
            size="sm"
            type="button"
            variant={useCustom ? "light" : "outline-light"}
            className={useCustom ? "text-primary fw-semibold" : "border-opacity-10"}
            onClick={() => setUseCustom(true)}
          >
            Custom
          </Button>
        </div>
        {useCustom ? (
          <Form.Group className="mb-0">
            <Form.Label className="text-white small">Days (1–365)</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="bg-primary text-white border border-light border-opacity-10"
              style={{ maxWidth: 120 }}
            />
          </Form.Group>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10 justify-content-end gap-2">
        <Button variant="outline-light" className="border-opacity-10" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="light" className="text-primary fw-semibold" onClick={apply}>
          Start trend
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
