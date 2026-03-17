import React, { useState, useEffect, useRef } from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faUnlink, faTrash } from "@fortawesome/free-solid-svg-icons";
import SearchablePointSelect from "./SearchablePointSelect";
import { engineeringRepository } from "../../../../lib/data";
import { SHAPE_COLOR_OPTIONS, DEFAULT_SHAPE_COLOR } from "../shapeColorConstants";

/**
 * Right-side inspector panel for selected graphic object.
 * Bind Point binds to Template Points only. Values come from mapped BACnet when available.
 * Mental model: Graphic Object → Template Point → optional mapped BACnet Object.
 */
export default function GraphicsInspector({
  selectedObject,
  availablePoints = [],
  equipmentName,
  linkTargets = { layoutNodes: [], equipment: [] },
  onUpdateObject,
  onDeleteObject,
  onOpenLink,
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
    linkTargetType: "",
    linkTargetId: "",
    linkTargetKey: "",
    shapeColor: DEFAULT_SHAPE_COLOR,
  });

  const bindPointSectionRef = useRef(null);

  const selectedPoint = availablePoints.find((p) => p.id === form.bindingPointId);
  const boundPointUnavailable = form.bindingPointId && !selectedPoint;
  const boundValueDisplay = selectedPoint
    ? selectedPoint.displayValue != null
      ? typeof selectedPoint.displayValue === "number"
        ? `${selectedPoint.displayValue}${selectedPoint.units || ""}`
        : String(selectedPoint.displayValue)
      : (selectedPoint.valueState === engineeringRepository.GRAPHICS_VALUE_STATES.OFFLINE ? "Offline" : "—")
    : null;
  const valueStateLabel =
    selectedPoint?.valueState === engineeringRepository.GRAPHICS_VALUE_STATES.MAPPED
      ? "Live value"
      : selectedPoint?.valueState === engineeringRepository.GRAPHICS_VALUE_STATES.OFFLINE
        ? "Controller offline"
        : selectedPoint?.valueState === engineeringRepository.GRAPHICS_VALUE_STATES.UNMAPPED
          ? "No mapped BACnet object yet"
          : selectedPoint?.valueState === engineeringRepository.GRAPHICS_VALUE_STATES.TEMPLATE_ONLY
            ? "Using template point only"
            : null;

  useEffect(() => {
    if (!selectedObject) return;
    const isText = selectedObject.type === "text";
    const isLink = selectedObject.type === "link";
    const bind = isText ? null : selectedObject.bindings?.[0];
    const linkTarget = isLink ? selectedObject.linkTarget || {} : {};
    if (isText && selectedObject.bindings?.length && onUpdateObject) {
      onUpdateObject(selectedObject.id, { ...selectedObject, bindings: [] });
    }
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
      shapeColor: selectedObject.shapeColor || DEFAULT_SHAPE_COLOR,
      labelText: selectedObject.label || "",
      bindingPointId: bind?.pointId || "",
      bindingDisplayMode: bind?.displayMode || "value",
      linkTargetType: linkTarget.type || "",
      linkTargetId: linkTarget.id || "",
      linkTargetKey:
        linkTarget.type === "layout" && linkTarget.id
          ? `layout:${linkTarget.id}`
          : linkTarget.type === "equipment" && linkTarget.id
            ? `equipment:${linkTarget.id}`
            : "",
    });
  }, [selectedObject]);

  useEffect(() => {
    if (selectedObject?.type === "value" && bindPointSectionRef.current) {
      bindPointSectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedObject?.id, selectedObject?.type]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject };
      if (field === "shapeColor" && SHAPE_COLOR_OPTIONS[value]) {
        updates.shapeColor = value;
        updates.fill = SHAPE_COLOR_OPTIONS[value].fill;
        updates.stroke = SHAPE_COLOR_OPTIONS[value].stroke;
      } else if (["x", "y", "width", "height", "rotation", "opacity", "color", "stroke", "fill", "layer", "shapeColor"].includes(field)) {
        updates[field] = value;
      }
      if (field === "labelText") {
        updates.label = value;
      }
      // Point binding only for non-text objects (not link)
      if (selectedObject.type !== "text" && selectedObject.type !== "link" && (field === "bindingPointId" || field === "bindingDisplayMode")) {
        const pointId = field === "bindingPointId" ? value : form.bindingPointId;
        const displayMode = field === "bindingDisplayMode" ? value : form.bindingDisplayMode;
        updates.bindings = pointId ? [{ pointId, displayMode }] : [];
      }
      // Link target for link objects — choose within this project's site/building/floor/equipment
      if (selectedObject.type === "link" && field === "linkTargetKey") {
        const key = value || "";
        if (!key) {
          updates.linkTarget = {};
        } else if (key.startsWith("layout:")) {
          updates.linkTarget = { type: "layout", id: key.slice("layout:".length) };
        } else if (key.startsWith("equipment:")) {
          updates.linkTarget = { type: "equipment", id: key.slice("equipment:".length) };
        } else {
          updates.linkTarget = {};
        }
      }
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const handleBindingChange = (pointId) => {
    if (selectedObject?.type === "text") return; // Text objects cannot have point bindings
    setForm((prev) => ({ ...prev, bindingPointId: pointId || "" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject };
      updates.bindings = pointId ? [{ pointId, displayMode: form.bindingDisplayMode }] : [];
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const handleClearBinding = () => {
    if (selectedObject?.type === "text") return;
    setForm((prev) => ({ ...prev, bindingPointId: "", bindingDisplayMode: "value" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject, bindings: [] };
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const canBindPoint = selectedObject?.type !== "text";

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
            {selectedObject.type === "shape" ? (
              <Form.Group className="mb-0">
                <Form.Label className="text-white-50 small">Shape color</Form.Label>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {Object.entries(SHAPE_COLOR_OPTIONS).map(([key, opt]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={form.shapeColor === key ? "primary" : "outline-secondary"}
                      className={form.shapeColor === key ? "" : "border border-light border-opacity-25 text-white"}
                      style={
                        form.shapeColor !== key
                          ? {
                              backgroundColor: opt.fill,
                              borderColor: opt.stroke,
                              color: "var(--bs-dark)",
                            }
                          : undefined
                      }
                      onClick={() => handleChange("shapeColor", key)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <div className="text-white-50 small mt-2">Transparent fill with light border. (Area temp can drive this later.)</div>
              </Form.Group>
            ) : (
              <>
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
              </>
            )}
            {selectedObject.type !== "shape" && (
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
            )}
          </div>
        </div>

        {/* Link Target - only for link objects */}
        {selectedObject.type === "link" && (
          <div className="mb-4">
            <div className="text-white small fw-semibold mb-2">Link Target</div>
            <div className="bg-dark bg-opacity-25 rounded p-3 border border-light border-opacity-10">
              <Form.Group className="mb-2">
                <Form.Label className="text-white-50 small">Link to</Form.Label>
                <select
                  className="form-select form-select-sm bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.linkTargetKey}
                  onChange={(e) => handleChange("linkTargetKey", e.target.value)}
                >
                  <option value="">— Select site, building, floor, or equipment —</option>
                  {(linkTargets.layoutNodes || []).length > 0 && (
                    <optgroup label="Site & Layout">
                      {(linkTargets.layoutNodes || []).map((n) => (
                        <option key={n.id} value={`layout:${n.id}`}>
                          {n.name} ({n.type})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(linkTargets.equipment || []).length > 0 && (
                    <optgroup label="Equipment">
                      {(linkTargets.equipment || []).map((eq) => (
                        <option key={eq.id} value={`equipment:${eq.id}`}>
                          {eq.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Form.Group>
              <div className="text-white-50 small mt-2">
                In Operator, clicking this link will navigate to the selected layout level graphic or equipment detail.
              </div>
              {onOpenLink &&
                selectedObject.linkTarget?.type &&
                (selectedObject.linkTarget.type === "layout" || selectedObject.linkTarget.type === "equipment"
                  ? selectedObject.linkTarget.id
                  : selectedObject.linkTarget.type === "url"
                    ? selectedObject.linkTarget.url
                    : selectedObject.linkTarget.type === "route"
                      ? selectedObject.linkTarget.path
                      : null) && (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="mt-2 border border-light border-opacity-25 text-white"
                    onClick={() => onOpenLink(selectedObject.linkTarget)}
                  >
                    <FontAwesomeIcon icon={faLink} className="me-1" />
                    Open link
                  </Button>
                )}
            </div>
          </div>
        )}

        {/* Point Binding - only for value (point) objects, not text */}
        {canBindPoint && (
          <div ref={bindPointSectionRef} className="mb-3">
            <div className="text-white small fw-semibold mb-2">
              <FontAwesomeIcon icon={faLink} className="me-1" />
              Bind Point
            </div>
            <div className="text-white-50 small mb-2">
              Bind to template points. Values come from mapped BACnet when available.
            </div>
            {availablePoints.length === 0 ? (
              <div className="text-white-50 small py-2">
                No template points for {equipmentName || "this equipment"}. Add an equipment template in Site Builder to bind points.
              </div>
            ) : (
              <>
                {boundPointUnavailable && (
                  <div className="text-warning small py-2 mb-2 rounded bg-dark bg-opacity-25 border border-warning border-opacity-50">
                    Previously bound point is not available. Bind to a template point below. (Graphics now bind to template points only.)
                  </div>
                )}
                <SearchablePointSelect
                  points={availablePoints}
                  value={selectedPoint ? form.bindingPointId : ""}
                  onChange={handleBindingChange}
                  placeholder="— Select template point —"
                />
                {form.bindingPointId && selectedPoint && (
                  <div className="mt-2 p-2 rounded bg-dark bg-opacity-25 border border-light border-opacity-10">
                    <div className="text-white-50 small mb-1">Bound Template Point</div>
                    <div className="text-white fw-semibold">{selectedPoint.displayName}</div>
                    <div className="text-white-50 small mt-2 mb-1">Mapped BACnet Object</div>
                    <div className="text-white small">
                      {selectedPoint.mappedBacnetRef || "No mapped BACnet object yet"}
                    </div>
                    <div className="text-white-50 small mt-2 mb-1">Value</div>
                    <div className="text-white fw-semibold">
                      {boundValueDisplay ?? "—"}
                      {valueStateLabel && (
                        <span className="text-white-50 small fw-normal ms-2">({valueStateLabel})</span>
                      )}
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
                        {engineeringRepository.BINDING_DISPLAY_OPTIONS.map((o) => (
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
        )}
        {selectedObject.type === "text" && (
          <div className="text-white-50 small mb-3">Point binding is only available for Value objects.</div>
        )}

        {/* Delete object */}
        {onDeleteObject && (
          <div className="mt-3 pt-3 border-top border-light border-opacity-10">
            <Button
              size="sm"
              variant="outline-danger"
              className="w-100"
              onClick={() => onDeleteObject(selectedObject.id)}
            >
              <FontAwesomeIcon icon={faTrash} className="me-1" />
              Delete object
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
