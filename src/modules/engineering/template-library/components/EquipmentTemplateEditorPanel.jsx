import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Button, Form, Table, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrashAlt,
  faCopy,
  faSave,
  faTimes,
  faCopy as faDuplicate,
} from "@fortawesome/free-solid-svg-icons";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import { engineeringRepository } from "../../../../lib/data";

const EQUIPMENT_TYPES = [
  { value: "VAV", label: "VAV" },
  { value: "AHU", label: "AHU" },
  { value: "FCU", label: "FCU" },
  { value: "Chiller", label: "Chiller" },
  { value: "RTU", label: "RTU" },
  { value: "PAC", label: "PAC" },
  { value: "CUSTOM", label: "Custom" },
];

const REQUIRED_OPTIONS = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

function generatePointId() {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toPointRow(p) {
  return {
    id: p.id || generatePointId(),
    pointLabel: p.pointLabel || "",
    pointKey: p.pointKey || "",
    referenceId: p.referenceId !== undefined ? (p.referenceId || "") : (p.pointKey || ""),
    required: p.required !== false,
    expectedType: p.expectedType || "AI",
    notes: p.notes || "",
  };
}

export default function EquipmentTemplateEditorPanel({
  template,
  mode = "create",
  graphicOptions = [],
  onSave,
  onCancel,
  onDuplicate,
  onSwitchToEdit,
}) {
  const isView = mode === "view";
  const readOnly = isView;

  const [name, setName] = useState("");
  const [equipmentType, setEquipmentType] = useState("VAV");
  const [description, setDescription] = useState("");
  const [defaultGraphic, setDefaultGraphic] = useState("");
  const [points, setPoints] = useState([]);
  const [errors, setErrors] = useState({});

  const pointCount = points.length;
  const graphicSelectOptions = useMemo(
    () => [{ value: "", label: "None" }, ...graphicOptions.map((n) => ({ value: n, label: n }))],
    [graphicOptions]
  );

  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setEquipmentType(template.equipmentType || "VAV");
      setDescription(template.description || "");
      setDefaultGraphic(template.defaultGraphic || "");
      setPoints((template.points || []).map(toPointRow));
    } else {
      setName("");
      setEquipmentType("VAV");
      setDescription("");
      setDefaultGraphic("");
      setPoints([]);
    }
    setErrors({});
  }, [template]);

  const updatePoint = useCallback((pointId, field, value) => {
    if (readOnly) return;
    setPoints((prev) =>
      prev.map((p) => (p.id === pointId ? { ...p, [field]: value } : p))
    );
  }, [readOnly]);

  const addPoint = useCallback(() => {
    if (readOnly) return;
    setPoints((prev) => [...prev, toPointRow({})]);
  }, [readOnly]);

  const deletePoint = useCallback((pointId) => {
    if (readOnly) return;
    setPoints((prev) => prev.filter((p) => p.id !== pointId));
  }, [readOnly]);

  const duplicatePoint = useCallback((point) => {
    if (readOnly) return;
    setPoints((prev) => [...prev, toPointRow({ ...point, id: undefined })]);
  }, [readOnly]);

  const loadStarterSet = useCallback((type) => {
    if (readOnly) return;
    const starter = engineeringRepository.getStarterPointsForEquipmentType(type);
    if (starter.length) setPoints(starter.map(toPointRow));
  }, [readOnly]);

  const validate = useCallback(() => {
    const next = {};
    if (!(name || "").trim()) next.name = "Template name is required.";
    if (!(equipmentType || "").trim()) next.equipmentType = "Equipment type is required.";
    const keys = new Set();
    points.forEach((p, i) => {
      if (!(p.pointLabel || "").trim()) next[`pointLabel-${p.id}`] = "Required";
      if (!(p.pointKey || "").trim()) next[`pointKey-${p.id}`] = "Required";
      else if (keys.has((p.pointKey || "").trim().toLowerCase())) next[`pointKey-${p.id}`] = "Must be unique";
      else keys.add((p.pointKey || "").trim().toLowerCase());
      if (!(p.expectedType || "").trim()) next[`expectedType-${p.id}`] = "Required";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, equipmentType, points]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    const payload = {
      id: template?.id,
      name: name.trim(),
      equipmentType: equipmentType.trim(),
      description: description.trim() || null,
      defaultGraphic: defaultGraphic || null,
      pointCount: points.length,
      points: points.map((p) => ({
        id: p.id,
        pointLabel: (p.pointLabel || "").trim(),
        pointKey: (p.pointKey || "").trim().toLowerCase().replace(/\s+/g, "_"),
        referenceId: (p.referenceId || "").trim() || null,
        required: !!p.required,
        expectedType: (p.expectedType || "AI").trim(),
        notes: (p.notes || "").trim() || null,
      })),
    };
    if (typeof onSave === "function") onSave(payload);
  }, [template?.id, name, equipmentType, description, defaultGraphic, points, validate, onSave]);

  const handleDuplicate = useCallback(() => {
    if (typeof onDuplicate === "function") {
      onDuplicate({
        name: name.trim() ? `${name} (Copy)` : "New Template (Copy)",
        equipmentType,
        description,
        defaultGraphic: defaultGraphic || null,
        points: points.map((p) => ({ ...p, id: undefined })),
      });
    }
  }, [name, equipmentType, description, defaultGraphic, points, onDuplicate]);

  const canSave =
    !readOnly &&
    (name || "").trim().length > 0 &&
    (equipmentType || "").trim().length > 0;

  const title =
    mode === "create"
      ? "Create Equipment Template"
      : isView
        ? "View Equipment Template"
        : "Edit Equipment Template";

  return (
    <div className="equipment-template-editor-panel d-flex flex-column h-100">
      <div className="equipment-template-editor-header border-bottom border-light border-opacity-10 px-4 py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h5 className="text-white fw-bold mb-0">{title}</h5>
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={onCancel}
            >
              <FontAwesomeIcon icon={faTimes} className="me-1" /> Cancel
            </Button>
            {isView && typeof onSwitchToEdit === "function" && (
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                onClick={() => onSwitchToEdit(template)}
              >
                Edit
              </Button>
            )}
            {!readOnly && (
              <>
                {template && (
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="legion-hero-btn legion-hero-btn--secondary"
                    onClick={handleDuplicate}
                  >
                    <FontAwesomeIcon icon={faDuplicate} className="me-1" /> Duplicate
                  </Button>
                )}
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--primary"
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  <FontAwesomeIcon icon={faSave} className="me-1" /> Save
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="equipment-template-editor-body flex-grow-1 overflow-auto px-4 py-3">
        {/* Metadata card */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between">
            <span className="text-white fw-bold small text-uppercase">Template details</span>
            <div className="d-flex align-items-center gap-2">
              {template?.source && (
                <span
                  className={`template-library-source-badge ${
                    template.source === engineeringRepository.SOURCE.SITE_CUSTOM
                      ? "template-library-source-badge--site"
                      : "template-library-source-badge--global"
                  }`}
                >
                  {template.source}
                </span>
              )}
              <span className="text-white-50 small">
                {pointCount} point{pointCount !== 1 ? "s" : ""}
              </span>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small">Template Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. LC VAV-1832"
                    readOnly={readOnly}
                    className={`bg-dark border border-light border-opacity-10 text-white ${errors.name ? "border-danger" : ""}`}
                  />
                  {errors.name && <Form.Text className="text-danger small">{errors.name}</Form.Text>}
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small">Equipment Type</Form.Label>
                  {readOnly ? (
                    <Form.Control
                      type="text"
                      value={equipmentType}
                      readOnly
                      className="bg-dark border border-light border-opacity-10 text-white"
                    />
                  ) : (
                    <LegionFormSelect
                      value={equipmentType}
                      onChange={(e) => setEquipmentType(e.target.value)}
                      options={EQUIPMENT_TYPES}
                      placeholder="Select type"
                    />
                  )}
                  {errors.equipmentType && <Form.Text className="text-danger small">{errors.equipmentType}</Form.Text>}
                </Form.Group>
              </div>
              <div className="col-12">
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small">Description (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    readOnly={readOnly}
                    className="bg-dark border border-light border-opacity-10 text-white"
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-0">
                  <Form.Label className="text-white-50 small">Default Graphic Template</Form.Label>
                  {readOnly ? (
                    <Form.Control
                      type="text"
                      value={defaultGraphic || "—"}
                      readOnly
                      className="bg-dark border border-light border-opacity-10 text-white"
                    />
                  ) : (
                    <LegionFormSelect
                      value={defaultGraphic}
                      onChange={(e) => setDefaultGraphic(e.target.value)}
                      options={graphicSelectOptions}
                      placeholder="None"
                    />
                  )}
                </Form.Group>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Points table card */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold small text-uppercase">Template points</span>
            {!readOnly && (
              <div className="d-flex align-items-center gap-2">
                {points.length === 0 && (
                  <Dropdown className="d-inline-block">
                    <Dropdown.Toggle
                      size="sm"
                      variant="outline-light"
                      className="legion-hero-btn legion-hero-btn--secondary"
                    >
                      Load starter set
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="legion-dropdown-menu">
                      <Dropdown.Item className="text-white" onClick={() => loadStarterSet("VAV")}>VAV</Dropdown.Item>
                      <Dropdown.Item className="text-white" onClick={() => loadStarterSet("AHU")}>AHU</Dropdown.Item>
                      <Dropdown.Item className="text-white" onClick={() => loadStarterSet("FCU")}>FCU</Dropdown.Item>
                      <Dropdown.Item className="text-white" onClick={() => loadStarterSet("Chiller")}>Chiller</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                )}
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--primary"
                  onClick={addPoint}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Point
                </Button>
              </div>
            )}
          </Card.Header>
          <Card.Body className="p-0">
            <p className="text-white-50 small px-3 pt-2 mb-2">
              Template points define the logical structure used by equipment instances, point mapping, and graphics bindings.
            </p>
            {points.length === 0 ? (
              <div className="equipment-template-editor-empty-points text-center py-5 px-3">
                <p className="text-white-50 mb-3 mb-0">
                  No points defined yet. Add logical points to build this equipment template.
                </p>
                {!readOnly && (
                  <div className="d-flex justify-content-center gap-2 flex-wrap">
                    <Button size="sm" className="legion-hero-btn legion-hero-btn--secondary" onClick={addPoint}>
                      <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Point
                    </Button>
                    <Dropdown className="d-inline-block">
                      <Dropdown.Toggle size="sm" variant="outline-light" className="legion-hero-btn legion-hero-btn--secondary">
                        Load starter set
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="legion-dropdown-menu">
                        <Dropdown.Item className="text-white" onClick={() => loadStarterSet("VAV")}>VAV</Dropdown.Item>
                        <Dropdown.Item className="text-white" onClick={() => loadStarterSet("AHU")}>AHU</Dropdown.Item>
                        <Dropdown.Item className="text-white" onClick={() => loadStarterSet("FCU")}>FCU</Dropdown.Item>
                        <Dropdown.Item className="text-white" onClick={() => loadStarterSet("Chiller")}>Chiller</Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                )}
              </div>
            ) : (
              <div className="template-library-table-wrap overflow-auto">
                <Table className="discovery-table equipment-template-points-table mb-0" responsive>
                  <thead>
                    <tr>
                      <th>Point Label</th>
                      <th>Point Key</th>
                      <th>Reference ID</th>
                      <th>Required</th>
                      <th>Expected Type</th>
                      <th>Notes</th>
                      {!readOnly && <th className="text-end" style={{ width: 100 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id} className="discovery-table-row">
                        <td>
                          {readOnly ? (
                            <span className="text-white">{(p.pointLabel || "").trim() || "—"}</span>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.pointLabel}
                              onChange={(e) => updatePoint(p.id, "pointLabel", e.target.value)}
                              placeholder="Label"
                              className={`bg-dark border border-light border-opacity-10 text-white form-control-sm ${errors[`pointLabel-${p.id}`] ? "border-danger" : ""}`}
                            />
                          )}
                          {errors[`pointLabel-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`pointLabel-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <code className="text-white-50 small">{(p.pointKey || "").trim() || "—"}</code>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.pointKey}
                              onChange={(e) => updatePoint(p.id, "pointKey", e.target.value)}
                              placeholder="pointKey"
                              className={`bg-dark border border-light border-opacity-10 text-white form-control-sm font-monospace ${errors[`pointKey-${p.id}`] ? "border-danger" : ""}`}
                            />
                          )}
                          {errors[`pointKey-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`pointKey-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td title="Used in point address and commands; defaults to Point Key if blank.">
                          {readOnly ? (
                            <code className="text-white-50 small">{(p.referenceId || p.pointKey || "").trim() || "—"}</code>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.referenceId}
                              onChange={(e) => updatePoint(p.id, "referenceId", e.target.value)}
                              placeholder={p.pointKey || "e.g. DA-T"}
                              className="bg-dark border border-light border-opacity-10 text-white form-control-sm font-monospace"
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <span className="text-white-50">{p.required ? "Yes" : "No"}</span>
                          ) : (
                            <LegionFormSelect
                              value={p.required}
                              onChange={(e) => updatePoint(p.id, "required", e.target.value === true || e.target.value === "true")}
                              options={REQUIRED_OPTIONS}
                              placeholder="Yes"
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <span className="text-white-50">{p.expectedType || "—"}</span>
                          ) : (
                            <LegionFormSelect
                              value={p.expectedType}
                              onChange={(e) => updatePoint(p.id, "expectedType", e.target.value)}
                              options={engineeringRepository.EXPECTED_POINT_TYPES}
                              placeholder="Type"
                            />
                          )}
                          {errors[`expectedType-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`expectedType-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <span className="text-white-50 small">{(p.notes || "").trim() || "—"}</span>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.notes}
                              onChange={(e) => updatePoint(p.id, "notes", e.target.value)}
                              placeholder="Notes"
                              className="bg-dark border border-light border-opacity-10 text-white form-control-sm"
                            />
                          )}
                        </td>
                        {!readOnly && (
                          <td className="text-end">
                            <Button
                              variant="link"
                              size="sm"
                              className="text-white-50 p-0 me-1"
                              onClick={() => duplicatePoint(p)}
                              title="Duplicate row"
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-danger p-0"
                              onClick={() => deletePoint(p.id)}
                              title="Delete row"
                            >
                              <FontAwesomeIcon icon={faTrashAlt} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
