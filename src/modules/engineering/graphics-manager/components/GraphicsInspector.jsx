import React, { useState, useEffect } from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faUnlink } from "@fortawesome/free-solid-svg-icons";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import SearchablePointSelect from "./SearchablePointSelect";
import { BINDING_DISPLAY_OPTIONS } from "../../data/mockGraphicsData";

/**
 * Right-side inspector panel for selected graphic object.
 * Point Binding uses equipment's available points (from Point Mapping / discovered BACnet).
 */
export default function GraphicsInspector({
  selectedObject,
  availablePoints = [],
  equipmentName,
  onUpdateObject,
}) {
  const [form, setForm] = useState({
    objectType: "",
    layer: "default",
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    rotation: 0,
    opacity: 1,
    color: "#e8c547",
    stroke: "#ffffff",
    fill: "#2b303d",
    labelText: "",
    bindingPointId: "",
    bindingDisplayMode: "value",
  });

  const selectedPoint = availablePoints.find((p) => p.id === form.bindingPointId);
  const boundValueDisplay = selectedPoint
    ? selectedPoint.presentValue != null
      ? typeof selectedPoint.presentValue === "number"
        ? `${selectedPoint.presentValue}${selectedPoint.units || ""}`
        : String(selectedPoint.presentValue)
      : "—"
    : null;

  useEffect(() => {
    if (!selectedObject) return;
    const bind = selectedObject.bindings?.[0];
    setForm({
      objectType: selectedObject.type || "text",
      layer: selectedObject.layer || "default",
      x: selectedObject.x ?? 0,
      y: selectedObject.y ?? 0,
      width: selectedObject.width ?? 60,
      height: selectedObject.height ?? 24,
      rotation: selectedObject.rotation ?? 0,
      opacity: selectedObject.opacity ?? 1,
      color: selectedObject.color || "#e8c547",
      stroke: selectedObject.stroke || "#ffffff",
      fill: selectedObject.fill || "#2b303d",
      labelText: selectedObject.label || "",
      bindingPointId: bind?.pointId || "",
      bindingDisplayMode: bind?.displayMode || "value",
    });
  }, [selectedObject]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject };
      if (["x", "y", "width", "height", "rotation", "opacity", "color", "stroke", "fill", "label"].includes(field)) {
        updates[field] = value;
      }
      if (field === "bindingPointId" || field === "bindingDisplayMode") {
        updates.bindings = value ? [{ pointId: form.bindingPointId || value, displayMode: form.bindingDisplayMode }] : [];
      }
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const handleBindingChange = (pointId) => {
    setForm((prev) => ({ ...prev, bindingPointId: pointId || "" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject };
      updates.bindings = pointId ? [{ pointId, displayMode: form.bindingDisplayMode }] : [];
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const handleClearBinding = () => {
    setForm((prev) => ({ ...prev, bindingPointId: "", bindingDisplayMode: "value" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject, bindings: [] };
      onUpdateObject(selectedObject.id, updates);
    }
  };

  if (!selectedObject) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center text-white-50 py-5">
          <div className="small">Select a graphic object to view properties</div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="bg-primary border border-light border-opacity-10 h-100">
      <Card.Header className="bg-transparent border-light border-opacity-10">
        <div className="text-white fw-bold">Object Properties</div>
        <div className="text-white-50 small mt-1">{selectedObject.label || selectedObject.type}</div>
      </Card.Header>
      <Card.Body className="overflow-auto">
        {/* Graphic Object */}
        <div className="mb-4">
          <div className="text-white small fw-semibold mb-2">Graphic Object</div>
          <div className="bg-dark bg-opacity-25 rounded p-3 border border-light border-opacity-10">
            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Object Type</Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
                value={form.objectType}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Layer</Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.layer}
                onChange={(e) => handleChange("layer", e.target.value)}
              />
            </Form.Group>
            <div className="row g-2">
              <div className="col-6">
                <Form.Label className="text-white-50 small">X</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.x}
                  onChange={(e) => handleChange("x", parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="col-6">
                <Form.Label className="text-white-50 small">Y</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.y}
                  onChange={(e) => handleChange("y", parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-6">
                <Form.Label className="text-white-50 small">Width</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.width}
                  onChange={(e) => handleChange("width", parseInt(e.target.value, 10) || 40)}
                />
              </div>
              <div className="col-6">
                <Form.Label className="text-white-50 small">Height</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.height}
                  onChange={(e) => handleChange("height", parseInt(e.target.value, 10) || 40)}
                />
              </div>
            </div>
            <Form.Group className="mb-0 mt-2">
              <Form.Label className="text-white-50 small">Rotation</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.rotation}
                onChange={(e) => handleChange("rotation", parseInt(e.target.value, 10) || 0)}
              />
            </Form.Group>
            <Form.Group className="mb-0 mt-2">
              <Form.Label className="text-white-50 small">Opacity</Form.Label>
              <Form.Control
                type="number"
                min="0"
                max="1"
                step="0.1"
                size="sm"
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.opacity}
                onChange={(e) => handleChange("opacity", parseFloat(e.target.value) || 1)}
              />
            </Form.Group>
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-4">
          <div className="text-white small fw-semibold mb-2">Appearance</div>
          <div className="bg-dark bg-opacity-25 rounded p-3 border border-light border-opacity-10">
            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Color</Form.Label>
              <Form.Control
                type="color"
                size="sm"
                className="bg-dark border border-light border-opacity-10 p-1"
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Stroke</Form.Label>
              <Form.Control
                type="color"
                size="sm"
                className="bg-dark border border-light border-opacity-10 p-1"
                value={form.stroke}
                onChange={(e) => handleChange("stroke", e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Fill</Form.Label>
              <Form.Control
                type="color"
                size="sm"
                className="bg-dark border border-light border-opacity-10 p-1"
                value={form.fill}
                onChange={(e) => handleChange("fill", e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-0 mt-2">
              <Form.Label className="text-white-50 small">
                {selectedObject.type === "value" ? "Display (Point when unbound)" : "Label Text"}
              </Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.labelText}
                onChange={(e) => handleChange("labelText", e.target.value)}
                placeholder={selectedObject.type === "value" ? "Point (or value when bound)" : "Enter text"}
                readOnly={selectedObject.type === "value"}
              />
            </Form.Group>
          </div>
        </div>

        {/* Point Binding */}
        <div className="mb-3">
          <div className="text-white small fw-semibold mb-2">
            <FontAwesomeIcon icon={faLink} className="me-1" />
            Bind Point
          </div>
          {availablePoints.length === 0 ? (
            <div className="text-white-50 small py-2">
              No points available for {equipmentName || "this equipment"}. Assign a controller in Site Builder first.
            </div>
          ) : (
            <>
              <SearchablePointSelect
                points={availablePoints}
                value={form.bindingPointId}
                onChange={handleBindingChange}
                placeholder="— Select point to bind —"
              />
              {form.bindingPointId && selectedPoint && (
                <div className="mt-2 p-2 rounded bg-dark bg-opacity-25 border border-light border-opacity-10">
                  <div className="text-white-50 small">Current Value</div>
                  <div className="text-white fw-semibold">
                    {boundValueDisplay ?? "—"}
                  </div>
                </div>
              )}
              {form.bindingPointId && (
                <>
                  <Form.Group className="mt-2">
                    <Form.Label className="text-white-50 small">Display Mode</Form.Label>
                    <select
                      className="form-select form-select-sm bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                      value={form.bindingDisplayMode}
                      onChange={(e) => handleChange("bindingDisplayMode", e.target.value)}
                    >
                      {BINDING_DISPLAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Form.Group>
                  <Button
                    size="sm"
                    variant="link"
                    className="text-white-50 p-0 mt-2"
                    onClick={handleClearBinding}
                  >
                    <FontAwesomeIcon icon={faUnlink} className="me-1" />
                    Clear Binding
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
