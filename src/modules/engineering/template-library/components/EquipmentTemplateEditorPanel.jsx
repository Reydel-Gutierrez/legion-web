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
import {
  COMMAND_TYPE_OPTIONS,
  defaultCommandConfig,
  sanitizeCommandConfigForSave,
  sanitizeTemplatePointKeyForSave,
  templatePointToEditorRow,
  validateTemplatePointRow,
} from "../../../../lib/equipmentTemplatePointModel";

const EQUIPMENT_TYPES = [
  { value: "VAV", label: "VAV" },
  { value: "VAV-CLG-ONLY", label: "VAV (cooling only)" },
  { value: "VAV-HTG", label: "VAV (cooling + heat)" },
  { value: "AHU", label: "AHU" },
  { value: "FCU", label: "FCU" },
  { value: "Chiller", label: "Chiller" },
  { value: "RTU", label: "RTU" },
  { value: "PAC", label: "PAC" },
  { value: "CUSTOM", label: "Custom" },
];

function generatePointId() {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Inline command config in the same table row as the point (compact). */
function CommandConfigInline({ point, readOnly, onChange }) {
  const { commandType, commandConfig } = point;
  const cfg = commandConfig && typeof commandConfig === "object" ? commandConfig : {};

  if (commandType === "none") {
    return <span className="text-white-50 small">—</span>;
  }

  if (commandType === "numeric" || commandType === "percentage") {
    return (
      <div className="d-flex flex-wrap align-items-end gap-2 equipment-template-inline-config">
        {[
          { key: "min", label: "Min" },
          { key: "max", label: "Max" },
          { key: "step", label: "Step" },
          { key: "unit", label: "Unit", text: true },
        ].map((field) => (
          <div key={field.key} className="equipment-template-inline-field">
            <Form.Label className="text-white-50 mb-0 d-block equipment-template-inline-label">{field.label}</Form.Label>
            <Form.Control
              size="sm"
              type={field.text ? "text" : "number"}
              value={cfg[field.key] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const next =
                  field.key === "unit"
                    ? { ...cfg, unit: v }
                    : { ...cfg, [field.key]: v === "" ? null : v };
                onChange(point.id, "commandConfig", next);
              }}
              readOnly={readOnly}
              placeholder={field.key === "unit" ? "°F" : ""}
              className={`bg-dark border border-light border-opacity-10 text-white ${
                field.key === "unit" ? "equipment-template-cfg-unit" : ""
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (commandType === "boolean") {
    return (
      <div className="d-flex flex-wrap align-items-end gap-2 equipment-template-inline-config">
        <div className="equipment-template-inline-field equipment-template-inline-field--grow">
          <Form.Label className="text-white-50 mb-0 d-block equipment-template-inline-label">Off</Form.Label>
          <Form.Control
            size="sm"
            type="text"
            value={cfg.offLabel ?? "Off"}
            onChange={(e) => onChange(point.id, "commandConfig", { ...cfg, offLabel: e.target.value })}
            readOnly={readOnly}
            className="bg-dark border border-light border-opacity-10 text-white"
          />
        </div>
        <div className="equipment-template-inline-field equipment-template-inline-field--grow">
          <Form.Label className="text-white-50 mb-0 d-block equipment-template-inline-label">On</Form.Label>
          <Form.Control
            size="sm"
            type="text"
            value={cfg.onLabel ?? "On"}
            onChange={(e) => onChange(point.id, "commandConfig", { ...cfg, onLabel: e.target.value })}
            readOnly={readOnly}
            className="bg-dark border border-light border-opacity-10 text-white"
          />
        </div>
      </div>
    );
  }

  if (commandType === "enum") {
    const options = Array.isArray(cfg.options) ? cfg.options : [];
    return (
      <div className="equipment-template-enum-inline d-flex flex-column gap-1">
        <div className="d-flex flex-wrap gap-1 align-items-center">
          {options.map((opt, idx) => (
            <div key={idx} className="d-flex flex-wrap gap-1 align-items-center">
              <Form.Control
                size="sm"
                type="text"
                value={opt.label ?? ""}
                placeholder="Label"
                onChange={(e) => {
                  const next = [...options];
                  next[idx] = { ...next[idx], label: e.target.value };
                  onChange(point.id, "commandConfig", { ...cfg, options: next });
                }}
                readOnly={readOnly}
                className="bg-dark border border-light border-opacity-10 text-white equipment-template-enum-label"
              />
              <Form.Control
                size="sm"
                type="text"
                value={opt.value ?? ""}
                placeholder="Val"
                onChange={(e) => {
                  const next = [...options];
                  const v = e.target.value;
                  const num = v === "" ? "" : Number.isNaN(Number(v)) ? v : Number(v);
                  next[idx] = { ...next[idx], value: num };
                  onChange(point.id, "commandConfig", { ...cfg, options: next });
                }}
                readOnly={readOnly}
                className="bg-dark border border-light border-opacity-10 text-white font-monospace equipment-template-enum-val"
              />
              {!readOnly && (
                <Button
                  size="sm"
                  variant="link"
                  className="text-danger p-0"
                  onClick={() => {
                    const next = options.filter((_, i) => i !== idx);
                    onChange(point.id, "commandConfig", { ...cfg, options: next });
                  }}
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button
              size="sm"
              variant="outline-light"
              className="legion-hero-btn legion-hero-btn--secondary py-0 px-2"
              onClick={() =>
                onChange(point.id, "commandConfig", {
                  ...cfg,
                  options: [...options, { label: "", value: 0 }],
                })
              }
            >
              <FontAwesomeIcon icon={faPlus} />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
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
      setPoints((template.points || []).map((p) => templatePointToEditorRow(p)));
    } else {
      setName("");
      setEquipmentType("VAV");
      setDescription("");
      setDefaultGraphic("");
      setPoints([]);
    }
    setErrors({});
  }, [template]);

  const updatePoint = useCallback(
    (pointId, field, value) => {
      if (readOnly) return;
      setPoints((prev) =>
        prev.map((p) => (p.id === pointId ? { ...p, [field]: value } : p))
      );
    },
    [readOnly]
  );

  const updateCommandConfig = useCallback(
    (pointId, nextCfg) => {
      if (readOnly) return;
      setPoints((prev) => prev.map((p) => (p.id === pointId ? { ...p, commandConfig: nextCfg } : p)));
    },
    [readOnly]
  );

  const setCommandType = useCallback(
    (pointId, commandType) => {
      if (readOnly) return;
      setPoints((prev) =>
        prev.map((p) => {
          if (p.id !== pointId) return p;
          return {
            ...p,
            commandType,
            commandConfig: defaultCommandConfig(commandType, { units: p.commandConfig?.unit }),
          };
        })
      );
    },
    [readOnly]
  );

  const addPoint = useCallback(() => {
    if (readOnly) return;
    setPoints((prev) => [...prev, templatePointToEditorRow({ id: generatePointId() })]);
  }, [readOnly]);

  const deletePoint = useCallback((pointId) => {
    if (readOnly) return;
    setPoints((prev) => prev.filter((p) => p.id !== pointId));
  }, [readOnly]);

  const duplicatePoint = useCallback((point) => {
    if (readOnly) return;
    setPoints((prev) => {
      const row = templatePointToEditorRow({ ...point, id: generatePointId() });
      return [...prev, row];
    });
  }, [readOnly]);

  const loadStarterSet = useCallback(
    (type) => {
      if (readOnly) return;
      const starter = engineeringRepository.getStarterPointsForEquipmentType(type);
      if (starter.length) {
        setPoints(
          starter.map((p) => {
            return templatePointToEditorRow({ ...p, id: generatePointId() });
          })
        );
      }
    },
    [readOnly]
  );

  const validate = useCallback(() => {
    const next = {};
    if (!(name || "").trim()) next.name = "Template name is required.";
    if (!(equipmentType || "").trim()) next.equipmentType = "Equipment type is required.";
    const keys = new Set();
    points.forEach((p) => {
      const rowErr = validateTemplatePointRow(p);
      if (rowErr.key) next[`pointKey-${p.id}`] = rowErr.key;
      if (rowErr.label) next[`pointDescription-${p.id}`] = rowErr.label;
      if (rowErr.expectedType) next[`expectedType-${p.id}`] = rowErr.expectedType;
      if (rowErr.commandType) next[`commandType-${p.id}`] = rowErr.commandType;
      if (rowErr.commandConfig) next[`commandConfig-${p.id}`] = rowErr.commandConfig;
      const k = sanitizeTemplatePointKeyForSave(p.key).toLowerCase();
      if (k) {
        if (keys.has(k)) next[`pointKey-${p.id}`] = "Another point uses the same key.";
        else keys.add(k);
      }
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
      points: points.map((p) => {
        const commandConfig = sanitizeCommandConfigForSave(p.commandType, p.commandConfig, {
          units: p.commandConfig?.unit,
        });
        const key = sanitizeTemplatePointKeyForSave(p.key);
        const label = (p.label || "").trim();
        return {
          id: p.id,
          label,
          key,
          pointLabel: label,
          pointKey: key,
          expectedType: (p.expectedType || "AI").trim(),
          commandType: p.commandType,
          commandConfig,
          mappingHint: null,
          notes: null,
        };
      }),
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
        points: points.map((p) => ({ ...p, id: generatePointId() })),
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
              Point is the logical key (no spaces; e.g. SA-T, BUILDING-P). Point description is the operator-facing name. Command type controls Operator inputs; expected type is the BACnet-style object type.
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
              <div className="template-library-table-wrap">
                <Table className="discovery-table equipment-template-points-table equipment-template-points-table--wide mb-0">
                  <thead>
                    <tr>
                      <th className="equipment-template-col-pointkey">Point</th>
                      <th className="equipment-template-col-label">Point description</th>
                      <th className="equipment-template-col-type">Expected type</th>
                      <th className="equipment-template-col-cmd">Command type</th>
                      <th className="equipment-template-col-config">Command config</th>
                      {!readOnly && <th className="text-end equipment-template-col-actions" style={{ width: 88 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id} className="discovery-table-row align-top">
                        <td className="equipment-template-col-pointkey">
                          {readOnly ? (
                            <span className="text-white font-monospace">{(p.key || "").trim() || "—"}</span>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.key}
                              onChange={(e) => updatePoint(p.id, "key", e.target.value)}
                              placeholder="SA-T"
                              className={`bg-dark border border-light border-opacity-10 text-white font-monospace form-control-sm ${errors[`pointKey-${p.id}`] ? "border-danger" : ""}`}
                            />
                          )}
                          {errors[`pointKey-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`pointKey-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td className="equipment-template-col-label">
                          {readOnly ? (
                            <span className="text-white">{(p.label || "").trim() || "—"}</span>
                          ) : (
                            <Form.Control
                              size="sm"
                              type="text"
                              value={p.label}
                              onChange={(e) => updatePoint(p.id, "label", e.target.value)}
                              placeholder="Description"
                              className={`bg-dark border border-light border-opacity-10 text-white form-control-sm ${errors[`pointDescription-${p.id}`] ? "border-danger" : ""}`}
                            />
                          )}
                          {errors[`pointDescription-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`pointDescription-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td className="equipment-template-col-type">
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
                        <td className="equipment-template-col-cmd">
                          {readOnly ? (
                            <span className="text-white-50">{p.commandType || "—"}</span>
                          ) : (
                            <LegionFormSelect
                              value={p.commandType}
                              onChange={(e) => setCommandType(p.id, e.target.value)}
                              options={COMMAND_TYPE_OPTIONS}
                              placeholder="Command"
                            />
                          )}
                          {errors[`commandType-${p.id}`] && (
                            <Form.Text className="text-danger small d-block">{errors[`commandType-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        <td className="equipment-template-col-config">
                          <CommandConfigInline
                            point={p}
                            readOnly={readOnly}
                            onChange={(id, _field, nextCfg) => updateCommandConfig(id, nextCfg)}
                          />
                          {errors[`commandConfig-${p.id}`] && (
                            <Form.Text className="text-danger small d-block mt-1">{errors[`commandConfig-${p.id}`]}</Form.Text>
                          )}
                        </td>
                        {!readOnly && (
                          <td className="text-end text-nowrap">
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
