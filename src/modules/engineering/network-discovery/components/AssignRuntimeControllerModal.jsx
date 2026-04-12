import React, { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Alert } from "@themesberg/react-bootstrap";
import { listEquipmentBySite } from "../../../../lib/data/adapters/api/hierarchyApiAdapter";
import { assignEquipmentController } from "../../../../lib/data/adapters/api/equipmentControllerApiAdapter";

export default function AssignRuntimeControllerModal({
  show,
  onHide,
  siteId,
  controllerCode,
  displayName,
  protocol = "SIM",
  isSimulated = true,
  onAssigned,
}) {
  const [options, setOptions] = useState([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show || !siteId) return;
    let cancelled = false;
    listEquipmentBySite(siteId)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [show, siteId]);

  useEffect(() => {
    if (show) {
      setEquipmentId("");
      setError("");
    }
  }, [show]);

  const handleSubmit = useCallback(async () => {
    if (!equipmentId || !controllerCode) {
      setError("Choose equipment.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const row = await assignEquipmentController({
        equipmentId,
        controllerCode: String(controllerCode).trim(),
        displayName: displayName != null ? String(displayName) : null,
        protocol: String(protocol || "SIM").trim(),
        pollRateMs: 20000,
        isSimulated: Boolean(isSimulated),
      });
      if (onAssigned) onAssigned(row);
      onHide();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [controllerCode, displayName, equipmentId, isSimulated, onAssigned, onHide, protocol]);

  return (
    <Modal show={show} onHide={onHide} centered className="text-white">
      <Modal.Header closeButton closeVariant="white" className="bg-primary border-secondary">
        <Modal.Title>Assign controller to equipment</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-primary">
        <p className="text-white-50 small">
          Persist discovery controller <strong className="text-white">{controllerCode || "—"}</strong> to a Legion
          equipment row. Runtime polling will use this assignment.
        </p>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Form.Group className="mb-3">
          <Form.Label>Equipment</Form.Label>
          <Form.Select
            className="bg-dark text-white border-secondary"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            disabled={loading || !options.length}
          >
            <option value="">Select equipment…</option>
            {options.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.code || eq.name} — {eq.name}
                {eq.buildingName && eq.floorName ? ` (${eq.buildingName} / ${eq.floorName})` : ""}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer className="bg-primary border-secondary">
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button className="legion-hero-btn legion-hero-btn--primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving…" : "Assign"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
