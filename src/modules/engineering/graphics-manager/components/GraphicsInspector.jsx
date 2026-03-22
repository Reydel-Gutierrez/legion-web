import React, { useState, useEffect, useRef } from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLink,
  faUnlink,
  faTrash,
  faCopy,
  faArrowUp,
  faArrowDown,
  faRedo,
  faEye,
  faEyeSlash,
  faLock,
  faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
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
  backgroundImage,
  onUpdateObject,
  onDeleteObject,
  onOpenLink,
  onDuplicateObject,
  onBringForwardObject,
  onSendBackwardObject,
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
    locked: false,
    visible: true,
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
    borderRadius: 4,
    fontSize: 14,
    textAlign: "center",
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
      locked: selectedObject.locked ?? false,
      visible: selectedObject.visible ?? true,
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
      borderRadius: selectedObject.borderRadius ?? 4,
      fontSize: selectedObject.fontSize ?? 14,
      textAlign: selectedObject.textAlign ?? "center",
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
      } else if (
        [
          "x",
          "y",
          "width",
          "height",
          "rotation",
          "opacity",
          "color",
          "stroke",
          "fill",
          "layer",
          "shapeColor",
          "locked",
          "visible",
          "borderRadius",
          "fontSize",
          "textAlign",
        ].includes(field)
      ) {
        updates[field] = value;
      }
      if (field === "labelText") {
        updates.label = value;
      }
      // Point binding only for non-text objects (not link)
      if (selectedObject.type === "value" && (field === "bindingPointId" || field === "bindingDisplayMode")) {
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
    if (selectedObject?.type !== "value") return; // Bind points only apply to Value objects.
    setForm((prev) => ({ ...prev, bindingPointId: pointId || "" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject };
      updates.bindings = pointId ? [{ pointId, displayMode: form.bindingDisplayMode }] : [];
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const handleClearBinding = () => {
    if (selectedObject?.type !== "value") return;
    setForm((prev) => ({ ...prev, bindingPointId: "", bindingDisplayMode: "value" }));
    if (onUpdateObject && selectedObject) {
      const updates = { ...selectedObject, bindings: [] };
      onUpdateObject(selectedObject.id, updates);
    }
  };

  const canBindPoint = selectedObject?.type === "value";

  const hasBackgroundImage = !!backgroundImage?.dataUrl;

  if (!selectedObject) {
    return (
      <Card className="graphics-object-inspector graphics-object-inspector--empty bg-primary border border-light border-opacity-10">
        <Card.Body className="p-0 border-0" aria-label="Object properties" />
      </Card>
    );
  }

  const typeLabelMap = {
    shape: "Shape",
    text: "Text",
    value: "Value",
    link: "Link",
  };

  const selectedTypeLabel = typeLabelMap[selectedObject.type] || selectedObject.type || "Object";
  const inspectorTitle =
    selectedObject.type === "shape"
      ? "Shape Properties"
      : selectedObject.type === "text"
        ? "Text Properties"
        : selectedObject.type === "value"
          ? "Value Binding"
          : selectedObject.type === "link"
            ? "Link Properties"
            : "Object Properties";

  const bindingSummaryChip = (() => {
    if (selectedObject.type !== "value") return null;
    if (!form.bindingPointId) return { label: "Unbound", variant: "muted" };
    if (boundPointUnavailable) return { label: "Binding missing", variant: "warning" };
    if (valueStateLabel) {
      const variant = valueStateLabel.includes("Live") ? "success" : valueStateLabel.includes("Offline") ? "warning" : valueStateLabel.includes("No") ? "warning" : "muted";
      return { label: valueStateLabel, variant };
    }
    return { label: "Bound", variant: "success" };
  })();

  const handleResetStyle = () => {
    if (!onUpdateObject || !selectedObject) return;

    if (selectedObject.type === "shape") {
      const nextShapeColor = DEFAULT_SHAPE_COLOR;
      const opt = SHAPE_COLOR_OPTIONS[nextShapeColor] || SHAPE_COLOR_OPTIONS[DEFAULT_SHAPE_COLOR];
      onUpdateObject(selectedObject.id, {
        shapeColor: nextShapeColor,
        fill: opt?.fill,
        stroke: opt?.stroke,
        opacity: 1,
        borderRadius: 4,
        // Keep label + transform (x/y/w/h/rot) as-is.
      });
      return;
    }

    onUpdateObject(selectedObject.id, {
      opacity: 1,
      color: "#e8c547",
      stroke: "#ffffff",
      fill: "#2b303d",
      ...(selectedObject.type === "text" ? { fontSize: 14, textAlign: "center" } : {}),
    });
  };

  return (
    <Card className="graphics-object-inspector bg-primary border border-light border-opacity-10">
      <Card.Header className="graphics-object-inspector__header bg-transparent border-light border-opacity-10">
        <div className="graphics-object-inspector__header-row d-flex align-items-center justify-content-between gap-3">
          <div>
            <div className="text-white fw-bold small">{inspectorTitle}</div>
            <div className="graphics-object-inspector__meta d-flex flex-wrap align-items-center gap-2 mt-2">
              <span className="graphics-object-inspector__meta-chip">
                Type: {selectedTypeLabel}
              </span>
              <span className="graphics-object-inspector__meta-chip">
                Layer: {form.layer || "default"}
              </span>
              <span className="graphics-object-inspector__meta-chip">
                Name: {form.labelText || "—"}
              </span>
              {bindingSummaryChip && (
                <span className={`graphics-object-inspector__meta-chip graphics-object-inspector__meta-chip--${bindingSummaryChip.variant}`}>
                  {bindingSummaryChip.label}
                </span>
              )}
            </div>
          </div>

          <div />
        </div>
      </Card.Header>

      <Card.Body className="graphics-object-inspector__body overflow-auto p-3 small">
        {/* Selection Summary */}
        <div className="graphics-object-inspector__section">
          <div className="graphics-object-inspector__section-title">Selection Summary</div>

          <div className="d-flex flex-column gap-2">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div style={{ minWidth: 220, flex: "1 1 240px" }}>
                <Form.Label className="text-white-50 small mb-1">Object name</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.labelText}
                  onChange={(e) => handleChange("labelText", e.target.value)}
                  placeholder={`Enter ${selectedTypeLabel.toLowerCase()} name`}
                />
              </div>

              <div style={{ minWidth: 160 }}>
                <Form.Label className="text-white-50 small mb-1">Object type</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
                  value={form.objectType}
                  readOnly
                  disabled
                />
              </div>
            </div>

            {selectedObject.type === "value" && (
              <div className="text-white-50 small">
                Display on the canvas comes from the selected template point (live/mapped/offline depending on binding state).
              </div>
            )}
            {selectedObject.type === "shape" && (
              <div className="text-white-50 small">
                Shape name is used for identification and organization (visual rendering is driven by style + geometry).
              </div>
            )}
          </div>
        </div>

        {/* Position & Size */}
        <div className="graphics-object-inspector__section mt-3">
          <div className="graphics-object-inspector__section-title">Position & Size</div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="d-flex align-items-center gap-1">
              <Form.Label className="text-white-50 small mb-0">X</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 78 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.x}
                onChange={(e) => handleChange("x", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="d-flex align-items-center gap-1">
              <Form.Label className="text-white-50 small mb-0">Y</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 78 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.y}
                onChange={(e) => handleChange("y", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="d-flex align-items-center gap-1">
              <Form.Label className="text-white-50 small mb-0">W</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 78 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.width}
                onChange={(e) => handleChange("width", parseInt(e.target.value, 10) || 40)}
              />
            </div>
            <div className="d-flex align-items-center gap-1">
              <Form.Label className="text-white-50 small mb-0">H</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 78 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.height}
                onChange={(e) => handleChange("height", parseInt(e.target.value, 10) || 40)}
              />
            </div>
            <div className="d-flex align-items-center gap-1 ms-2">
              <Form.Label className="text-white-50 small mb-0">Rot</Form.Label>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 78 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.rotation}
                onChange={(e) => handleChange("rotation", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Layer & Visibility */}
        <div className="graphics-object-inspector__section mt-3">
          <div className="graphics-object-inspector__section-title">Layer / Visibility</div>

          <div className="d-flex flex-column gap-3">
            <div style={{ maxWidth: 260 }}>
              <Form.Label className="text-white-50 small mb-1">Layer</Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.layer}
                onChange={(e) => handleChange("layer", e.target.value)}
              />
            </div>

            <div className="d-flex flex-wrap gap-3 align-items-center">
              <div className="d-flex align-items-center justify-content-between flex-grow-1 bg-dark bg-opacity-25 border border-light border-opacity-10 rounded p-2">
                <div>
                  <div className="text-white fw-semibold small d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={form.visible ? faEye : faEyeSlash} />
                    Visible
                  </div>
                  <div className="text-white-50 small">Toggle visibility in the workspace.</div>
                </div>
                <Form.Check
                  type="switch"
                  id="graphics-inspector-visible"
                  checked={!!form.visible}
                  onChange={(e) => handleChange("visible", e.target.checked)}
                />
              </div>

              <div className="d-flex align-items-center justify-content-between flex-grow-1 bg-dark bg-opacity-25 border border-light border-opacity-10 rounded p-2">
                <div>
                  <div className="text-white fw-semibold small d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={form.locked ? faLock : faLockOpen} />
                    Locked
                  </div>
                  <div className="text-white-50 small">Prevents drag/resize on the canvas.</div>
                </div>
                <Form.Check
                  type="switch"
                  id="graphics-inspector-locked"
                  checked={!!form.locked}
                  onChange={(e) => handleChange("locked", e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="graphics-object-inspector__section mt-3">
          <div className="graphics-object-inspector__section-title">Appearance</div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            <div className="d-flex align-items-center gap-2">
              <Form.Label className="text-white-50 small mb-0">Opacity</Form.Label>
              <Form.Control
                type="number"
                min="0"
                max="1"
                step="0.05"
                size="sm"
                style={{ width: 92 }}
                className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                value={form.opacity}
                onChange={(e) => handleChange("opacity", parseFloat(e.target.value) || 1)}
              />
            </div>

            {selectedObject.type === "shape" && (
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="text-white-50 small mb-0">Radius</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="1"
                  size="sm"
                  style={{ width: 92 }}
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.borderRadius}
                  onChange={(e) => handleChange("borderRadius", parseInt(e.target.value, 10) || 0)}
                />
              </div>
            )}
          </div>

          <div className="mt-3">
            {selectedObject.type === "shape" ? (
              <>
                <div className="text-white-50 small mb-1">Shape color</div>
                <div className="d-flex flex-wrap gap-2">
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
              </>
            ) : (
              <div className="d-flex flex-wrap align-items-end gap-3">
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small mb-1">Color</Form.Label>
                  <Form.Control
                    type="color"
                    size="sm"
                    className="bg-dark border border-light border-opacity-10 p-1"
                    value={form.color}
                    onChange={(e) => handleChange("color", e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small mb-1">Stroke</Form.Label>
                  <Form.Control
                    type="color"
                    size="sm"
                    className="bg-dark border border-light border-opacity-10 p-1"
                    value={form.stroke}
                    onChange={(e) => handleChange("stroke", e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small mb-1">Fill</Form.Label>
                  <Form.Control
                    type="color"
                    size="sm"
                    className="bg-dark border border-light border-opacity-10 p-1"
                    value={form.fill}
                    onChange={(e) => handleChange("fill", e.target.value)}
                  />
                </Form.Group>
              </div>
            )}
          </div>
        </div>

        {/* Text / Label */}
        {selectedObject.type === "text" && (
          <div className="graphics-object-inspector__section mt-3">
            <div className="graphics-object-inspector__section-title">Text / Label</div>

            <div className="d-flex flex-wrap gap-3 align-items-end">
              <div style={{ width: 140 }}>
                <Form.Label className="text-white-50 small mb-1">Font size</Form.Label>
                <Form.Control
                  type="number"
                  min="8"
                  step="1"
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.fontSize}
                  onChange={(e) => handleChange("fontSize", parseInt(e.target.value, 10) || 14)}
                />
              </div>

              <div style={{ flex: "1 1 180px", minWidth: 180 }}>
                <Form.Label className="text-white-50 small mb-1">Alignment</Form.Label>
                <select
                  className="form-select form-select-sm bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={form.textAlign}
                  onChange={(e) => handleChange("textAlign", e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="text-white-50 small mt-2">
              Text content is edited in the Selection Summary section.
            </div>
          </div>
        )}

        {/* Data / Value Binding */}
        {canBindPoint && (
          <div ref={bindPointSectionRef} className="graphics-object-inspector__section mt-3">
            <div className="graphics-object-inspector__section-title">
              Data / Value Binding
            </div>

            <div className="text-white-50 small mb-2">
              Bind value objects to template points. Canvas display is driven by the binding state and mapped BACnet when available.
            </div>

            {availablePoints.length === 0 ? (
              <div className="text-white-50 small py-2">
                No template points for {equipmentName || "this equipment"}. Add an equipment template in Site Builder to bind points.
              </div>
            ) : (
              <>
                {boundPointUnavailable && (
                  <div className="text-warning small py-2 mb-3 rounded bg-dark bg-opacity-25 border border-warning border-opacity-50">
                    Previously bound point is not available. Bind to a template point below.
                  </div>
                )}

                <SearchablePointSelect
                  points={availablePoints}
                  value={selectedPoint ? form.bindingPointId : ""}
                  onChange={handleBindingChange}
                  placeholder="— Select template point —"
                />

                {form.bindingPointId && selectedPoint && (
                  <div className="mt-3 p-3 rounded bg-dark bg-opacity-25 border border-light border-opacity-10">
                    <div className="text-white-50 small mb-2">Bound Template Point</div>
                    <div className="text-white fw-semibold">{selectedPoint.displayName}</div>
                    <div className="text-white-50 small mt-3">Mapped BACnet Object</div>
                    <div className="text-white small mt-1">
                      {selectedPoint.mappedBacnetRef || "No mapped BACnet object yet"}
                    </div>
                    <div className="text-white-50 small mt-3">Value</div>
                    <div className="text-white fw-semibold mt-1">
                      {boundValueDisplay ?? "—"}
                      {valueStateLabel && <span className="text-white-50 small fw-normal ms-2">({valueStateLabel})</span>}
                    </div>
                  </div>
                )}

                {form.bindingPointId && (
                  <div className="mt-3">
                    <Form.Group className="mb-2">
                      <Form.Label className="text-white-50 small">Display format</Form.Label>
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
                      className="text-white-50 p-0 mt-1"
                      onClick={handleClearBinding}
                    >
                      <FontAwesomeIcon icon={faUnlink} className="me-1" />
                      Clear Binding
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Navigation / Linking */}
        {selectedObject.type === "link" && (
          <div className="graphics-object-inspector__section mt-3">
            <div className="graphics-object-inspector__section-title">Navigation / Linking</div>

            <div className="text-white-50 small mb-2">
              Configure where the link should navigate in Operator.
            </div>

            <Form.Group className="mb-2">
              <Form.Label className="text-white-50 small">Link target</Form.Label>
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

            <div className="text-white-50 small mt-1">
              Clicking this link navigates to the selected layout level or equipment detail.
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
                  className="mt-3 border border-light border-opacity-25 text-white"
                  onClick={() => onOpenLink(selectedObject.linkTarget)}
                >
                  <FontAwesomeIcon icon={faLink} className="me-1" />
                  Open link
                </Button>
              )}
          </div>
        )}

        {/* Actions / Object Management */}
        {hasBackgroundImage && (
          <div className="graphics-object-inspector__section mt-3">
            <div className="graphics-object-inspector__section-title">Picture Crop</div>
            <div className="text-white-50 small">
              Select the background picture on the canvas, then use <strong>Crop Picture</strong> and <strong>Revert</strong> in the canvas toolbar to adjust or clear the crop.
            </div>
          </div>
        )}
        <div className="graphics-object-inspector__section mt-3">
          <div className="graphics-object-inspector__section-title">Actions / Object Management</div>

          <div className="d-flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              disabled={!onDuplicateObject}
              onClick={() => onDuplicateObject?.(selectedObject.id)}
              title="Duplicate selected object"
            >
              <FontAwesomeIcon icon={faCopy} className="me-1" />
              Duplicate
            </Button>

            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              disabled={!onBringForwardObject}
              onClick={() => onBringForwardObject?.(selectedObject.id)}
              title="Bring forward (render order)"
            >
              <FontAwesomeIcon icon={faArrowUp} className="me-1" />
              Forward
            </Button>

            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              disabled={!onSendBackwardObject}
              onClick={() => onSendBackwardObject?.(selectedObject.id)}
              title="Send backward (render order)"
            >
              <FontAwesomeIcon icon={faArrowDown} className="me-1" />
              Back
            </Button>

            <Button
              size="sm"
              variant="outline-secondary"
              className="border-opacity-10"
              onClick={handleResetStyle}
              disabled={!onUpdateObject}
              title="Reset appearance-related properties"
            >
              <FontAwesomeIcon icon={faRedo} className="me-1" />
              Reset style
            </Button>

            {onDeleteObject && (
              <Button
                size="sm"
                variant="outline-danger"
                className="border-opacity-10"
                onClick={() => onDeleteObject(selectedObject.id)}
                title="Delete selected object"
              >
                <FontAwesomeIcon icon={faTrash} className="me-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
