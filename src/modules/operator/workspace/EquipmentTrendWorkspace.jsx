import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "@themesberg/react-bootstrap";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";
import { classifyOperatorPointKind } from "../../../lib/operator/pointKind";

const FILTERS = [["all", "All"], ["analog", "Analog"], ["binary", "Binary"], ["multistate", "Multi-State"]];
const pointLabel = (point) => point?.label || point?.name || point?.pointName || point?.id || "Point";
const pointType = (point) => { const kind = classifyOperatorPointKind(point); return kind === "analog" ? "Analog" : kind === "multistate" ? "Multi-State" : "Binary"; };

export default function EquipmentTrendWorkspace({ equipment, releaseData, siteKey, onBack, onSaved }) {
  const [store, setStore] = useState({ definitions: [], assignments: [] });
  const busy = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [tab, setTab] = useState("points"); const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState([]); const [name, setName] = useState(""); const [template, setTemplate] = useState(false); const [error, setError] = useState("");
  const catalog = useMemo(() => {
    const releasePoints = operatorRepository.getWorkspacePointsForEquipment(equipment.id, equipment.displayLabel || equipment.name, equipment.status, { activeRelease: releaseData }) || [];
    const source = releasePoints.length ? releasePoints : operatorRepository.getTrendPointCatalog(siteKey, equipment.id) || [];
    return source.map((point) => ({ ...point, id: point.id || point.pointKey || point.pointId, label: point.label || point.pointDescription || point.pointName || point.pointKey, kind: point.kind || point.dataType, value: point.value ?? point.presentValueRaw }));
  }, [siteKey, equipment, releaseData]); const equipmentList = releaseData?.equipment || []; const templates = store.definitions.filter((definition) => definition.isTemplate);
  const rows = catalog.filter((point) => { const kind = classifyOperatorPointKind(point); return (filter === "all" || kind === filter) && `${pointLabel(point)} ${point.id}`.toLowerCase().includes(search.toLowerCase()); }); const selectedPoints = selected.map((id) => catalog.find((point) => String(point.id) === String(id))).filter(Boolean);
  useEffect(() => {
    let active = true;
    setStore({ definitions: [], assignments: [] });
    setEditingId(null); setSelected([]);
    operatorDefinitionsRepository.fetchTrendStore(siteKey).then((next) => { if (active) setStore(next); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [siteKey, equipment.id]);
  const run = async (operation, message) => {
    if (busy.current) return;
    busy.current = true;
    try { await operation(); setStore(await operatorDefinitionsRepository.fetchTrendStore(siteKey)); setError(message); if (onSaved) onSaved(); }
    catch (err) { setError(err.message); }
    finally { busy.current = false; }
  };
  const loadTemplate = (definition) => {
    setEditingId(definition.id); setName(definition.name); setTemplate(true); setTab("points");
    setSelected(catalog.filter((point) => definition.pointIds.includes(String(point.pointKey || point.pointId || point.id))).map((point) => String(point.id)));
    setError("");
  };
  const saveTrend = (asTemplate = template) => {
    if (!selectedPoints.length || !name.trim()) { setError("Choose at least one point and enter a trend name."); return; }
    if (asTemplate && !editingId && templates.length >= 4) { setError("The site already has four trend templates. Delete one before creating another."); return; }
    const pointRequirements = selectedPoints.map((point) => ({ pointKey: String(point.pointKey || point.pointId || point.id), kind: classifyOperatorPointKind(point) }));
    run(async () => { const saved = await operatorDefinitionsRepository.saveDefinition(siteKey, "trend", {
      id: editingId || undefined, name: name.trim(), isTemplate: asTemplate, enabled: true,
      equipmentType: equipment.type || equipment.equipmentType, pointRequirements,
      equipmentIds: [String(equipment.id)],
    }); setEditingId(saved.id); }, "Trend configuration saved. Waiting for historian data.");
  };
  const deleteTemplate = (definition) => {
    if (window.confirm(`Delete ${definition.name} and all assigned trends?`)) run(() => operatorDefinitionsRepository.deleteDefinition(siteKey, "trend", definition.id), "Template deleted.");
  };
  const assign = (definition, equipmentId) => {
    const target = equipmentList.find((item) => String(item.id) === String(equipmentId));
    const points = operatorRepository.getWorkspacePointsForEquipment(equipmentId, target?.name, target?.status, { activeRelease: releaseData }) || [];
    const mappings = {};
    for (const requirement of definition.pointRequirements) {
      const point = points.find((item) => String(item.pointKey || item.pointId || item.id) === requirement.pointKey && classifyOperatorPointKind(item) === requirement.kind);
      if (!point) { setError(`Target equipment is missing compatible point ${requirement.pointKey}.`); return; }
      mappings[requirement.pointKey] = point.databasePointId || point.id;
    }
    run(() => operatorDefinitionsRepository.assignDefinition(siteKey, "trend", definition.id, [equipmentId], { [equipmentId]: mappings }), "Trend assigned. Waiting for historian data.");
  };
  return <section className="operator-full-workspace trend-workspace" aria-label="Trends workspace"><div className="operator-full-workspace__topbar"><Button variant="link" className="operator-back-link" onClick={onBack}>← Back to Equipment</Button><span className="operator-eyebrow">TRENDS</span></div><div className="operator-editor-panel trend-workspace__card"><div className="logic-wizard__toolbar"><div className="operator-workspace-tabs">{[["points", "Select Points"], ["save", "Save Trend"], ["templates", "Templates"], ["assignments", "Assignments"]].map(([id, label]) => <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div></div>{tab === "points" ? <PointsTab rows={rows} selected={selected} setSelected={setSelected} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} selectedPoints={selectedPoints} onNext={() => setTab("save")} onCancel={onBack} /> : null}{tab === "save" ? <SaveTab name={name} setName={setName} template={template} setTemplate={setTemplate} selectedPoints={selectedPoints} onBack={() => setTab("points")} onSave={() => saveTrend(template)} onSaveTemplate={() => saveTrend(true)} /> : null}{tab === "templates" ? <TemplatesTab templates={templates} assignments={store.assignments} onOpen={loadTemplate} onDelete={deleteTemplate} /> : null}{tab === "assignments" ? <AssignmentsTab templates={templates} assignments={store.assignments} equipmentList={equipmentList} onAssign={assign} /> : null}{error ? <div className="alert alert-info mt-3 mb-0">{error}</div> : null}</div></section>;
}

function PointsTab({ rows, selected, setSelected, search, setSearch, filter, setFilter, selectedPoints, onNext, onCancel }) { const toggle = (point) => { const id = String(point.id); setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]); }; return <><div className="logic-wizard__context">Choose one or more equipment points to record in this trend.</div><div className="trend-points-layout"><div><div className="d-flex align-items-center justify-content-between gap-2"><h2>Equipment points</h2><span className="text-muted small">{rows.length} shown</span></div><Form.Control aria-label="Optional point filter" placeholder="Filter points (optional)" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="logic-wizard__filters">{FILTERS.map(([id, label]) => <button type="button" key={id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="trend-point-list" aria-label="Scrollable equipment point list">{rows.length ? rows.map((point) => <div className="logic-point-row" key={point.id}><div><strong>{pointLabel(point)}</strong><span>{point.id} · {pointType(point)} · {point.value ?? "—"}</span></div><Button variant="link" size="sm" disabled={selected.includes(String(point.id))} onClick={() => toggle(point)}>+</Button></div>) : <div className="trend-point-empty">No equipment points match the current filter.</div>}</div></div><aside className="logic-wizard__selected"><h2>Selected Points</h2>{selectedPoints.length ? selectedPoints.map((point, index) => <div className="logic-selected-row" key={point.id}><span className="logic-input__key">{index + 1}</span><div><strong>{pointLabel(point)}</strong><span>{point.id} · {pointType(point)}</span></div><Button variant="link" size="sm" aria-label={`Remove ${pointLabel(point)}`} onClick={() => toggle(point)}>×</Button></div>) : <p className="text-muted small">Add points from the list.</p>}<div className="logic-wizard__help"><strong>TREND PREVIEW</strong><br />{selectedPoints.length} points selected<br /><span>Recording: Not configured yet</span></div></aside></div><div className="logic-wizard__footer"><Button variant="link" onClick={onCancel}>Cancel</Button><Button variant="primary" disabled={!selected.length} onClick={onNext}>Next</Button></div></>;
}

function SaveTab({ name, setName, template, setTemplate, selectedPoints, onBack, onSave, onSaveTemplate }) { return <><div className="logic-wizard__step"><div className="logic-wizard__intro"><span className="logic-wizard__kicker">FINAL CONFIGURATION</span><h2>Save trend</h2><p>Save the selected points for this equipment. History appears when historian data is available.</p></div><Form.Group><Form.Label>Trend Name</Form.Label><Form.Control value={name} onChange={(event) => setName(event.target.value)} placeholder="FCU temperature and fan trend" /></Form.Group><Form.Check className="mt-3" type="switch" label="Save as site-wide template" checked={template} onChange={(event) => setTemplate(event.target.checked)} /><div className="trend-save-points"><strong>Selected Points</strong>{selectedPoints.map((point) => <span key={point.id}>{pointLabel(point)}</span>)}</div></div><div className="logic-wizard__footer"><Button variant="outline-secondary" onClick={onBack}>Back</Button><div><Button variant="outline-secondary" onClick={onSaveTemplate}>Save as Template</Button><Button className="ms-2" variant="primary" onClick={onSave}>Save Trend</Button></div></div></>; }

function TemplatesTab({ templates, assignments, onOpen, onDelete }) { return <div className="trend-library"><div className="logic-library__heading"><h2>Trend Templates</h2></div>{templates.length ? templates.map((definition) => <div className="trend-library__row" key={definition.id}><div><strong>{definition.name}</strong><span>{definition.pointIds.length} points · Assigned to {assignments.filter((item) => item.trendDefinitionId === definition.id).length} equipment</span></div><Button size="sm" variant="link" onClick={() => onOpen(definition)}>Open / Edit</Button><Button size="sm" variant="link" className="text-danger" onClick={() => onDelete(definition)}>Delete</Button></div>) : <p className="text-muted">No trend templates saved.</p>}</div>; }
function AssignmentsTab({ templates, assignments, equipmentList, onAssign }) { return <div className="trend-library"><div className="logic-library__heading"><h2>Trend Assignments</h2></div>{templates.length ? templates.map((definition) => <AssignmentRow key={definition.id} definition={definition} assignments={assignments} equipmentList={equipmentList} onAssign={onAssign} />) : <p className="text-muted">Save a trend template before assigning it.</p>}</div>; }
function AssignmentRow({ definition, assignments, equipmentList, onAssign }) { const assigned = assignments.filter((item) => item.trendDefinitionId === definition.id); const [target, setTarget] = useState(""); const compatible = equipmentList.filter((item) => String(item.type || item.equipmentType).toUpperCase() === String(definition.equipmentType || item.type || item.equipmentType).toUpperCase() && !assigned.some((assignment) => String(assignment.assetId) === String(item.id))); return <div className="trend-library__assignment"><div><strong>{definition.name}</strong><span>{assigned.length} assigned</span></div><Form.Control as="select" size="sm" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Select compatible equipment...</option>{compatible.map((item) => <option key={item.id} value={item.id}>{item.displayLabel || item.name}</option>)}</Form.Control><Button size="sm" variant="outline-secondary" disabled={!target} onClick={() => { onAssign(definition, target); setTarget(""); }}>Assign</Button></div>; }
