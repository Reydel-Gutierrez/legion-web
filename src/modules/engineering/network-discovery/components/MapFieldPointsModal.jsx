import React, { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Alert, Table, Row, Col } from "@themesberg/react-bootstrap";
import { fetchRuntimeFieldPoints } from "../../../../lib/data/adapters/api/runtimeApiAdapter";
import { listPointsByEquipment } from "../../../../lib/data/adapters/api/hierarchyApiAdapter";
import {
  bindPointMapping,
  getPointMappingsByController,
} from "../../../../lib/data/adapters/api/pointMappingApiAdapter";

export default function MapFieldPointsModal({
  show,
  onHide,
  controllerCode,
  equipmentControllerId,
  equipmentId,
  onMapped,
}) {
  const [fieldPoints, setFieldPoints] = useState([]);
  const [legionPoints, setLegionPoints] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedFieldKey, setSelectedFieldKey] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!show || !controllerCode || !equipmentControllerId || !equipmentId) return;
    setLoading(true);
    setError("");
    try {
      const [fp, lp, mp] = await Promise.all([
        fetchRuntimeFieldPoints(controllerCode),
        listPointsByEquipment(equipmentId),
        getPointMappingsByController(equipmentControllerId),
      ]);
      setFieldPoints(Array.isArray(fp) ? fp : []);
      setLegionPoints(Array.isArray(lp) ? lp : []);
      setMappings(Array.isArray(mp) ? mp : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [controllerCode, equipmentControllerId, equipmentId, show]);

  useEffect(() => {
    if (show) {
      setSelectedFieldKey("");
      setSelectedPointId("");
      reload();
    }
  }, [show, reload]);

  const handleBind = useCallback(async () => {
    if (!selectedFieldKey || !selectedPointId) {
      setError("Select a field point and a Legion point.");
      return;
    }
    const fp = fieldPoints.find((p) => p.fieldPointKey === selectedFieldKey);
    setLoading(true);
    setError("");
    try {
      await bindPointMapping({
        equipmentControllerId,
        equipmentId,
        pointId: selectedPointId,
        fieldPointKey: selectedFieldKey,
        fieldPointName: fp?.fieldPointName ?? null,
        fieldObjectType: fp?.fieldObjectType ?? null,
        fieldObjectInstance: fp?.fieldObjectInstance ?? null,
        fieldDataType: fp?.fieldDataType ?? null,
        readEnabled: true,
        writeEnabled: false,
      });
      if (onMapped) onMapped();
      await reload();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [
    equipmentControllerId,
    equipmentId,
    fieldPoints,
    onMapped,
    reload,
    selectedFieldKey,
    selectedPointId,
  ]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="text-white">
      <Modal.Header closeButton closeVariant="white" className="bg-primary border-secondary">
        <Modal.Title>Map field points to Legion points</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-primary">
        <p className="text-white-50 small mb-3">
          Discovered / runtime keys on the left; Legion Point rows for this equipment on the right. Bindings are
          persisted and used by runtime polling.
        </p>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Row className="g-2 mb-3">
          <Col md={5}>
            <Form.Label className="small text-white-50">Field point (runtime)</Form.Label>
            <Form.Select
              className="bg-dark text-white border-secondary"
              value={selectedFieldKey}
              onChange={(e) => setSelectedFieldKey(e.target.value)}
              disabled={loading}
            >
              <option value="">Select…</option>
              {fieldPoints.map((p) => (
                <option key={p.fieldPointKey} value={p.fieldPointKey}>
                  {p.fieldPointKey}
                  {p.fieldPointName ? ` — ${p.fieldPointName}` : ""}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={5}>
            <Form.Label className="small text-white-50">Legion point</Form.Label>
            <Form.Select
              className="bg-dark text-white border-secondary"
              value={selectedPointId}
              onChange={(e) => setSelectedPointId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select…</option>
              {legionPoints.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pointCode} — {p.pointName || p.pointCode}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2} className="d-flex align-items-end">
            <Button
              className="legion-hero-btn legion-hero-btn--primary w-100"
              onClick={handleBind}
              disabled={loading}
            >
              Bind
            </Button>
          </Col>
        </Row>
        <div className="text-white fw-semibold small mb-2">Current mappings</div>
        <div className="table-responsive">
          <Table size="sm" className="text-white mb-0">
            <thead>
              <tr className="text-white-50 small">
                <th>Field key</th>
                <th>Legion point</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-white-50">
                    {loading ? "Loading…" : "No mappings yet."}
                  </td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fieldPointKey}</td>
                    <td className="text-white-50 small">
                      {m.legionPointCode || m.pointId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-primary border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
