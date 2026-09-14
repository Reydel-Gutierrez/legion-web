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
  const [sampleInterval, setSampleInterval] = useState("20"); const [retentionDays, setRetentionDays] = useState("30");
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
    setSampleInterval(definition.sampleInterval != null ? String(definition.sampleInterval) : "20");
    setRetentionDays(definition.retentionDays != null ? String(definition.retentionDays) : "30");
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
      sampleInterval: sampleInterval ? Number(sampleInterval) : undefined,
      retentionDays: retentionDays ? Number(retentionDays) : undefined,
      // Save is per-equipment (this asset only) whether or not the same action also saves a
      // template row — Save as Template never implicitly assigns it anywhere else, and a plain
      // Save never becomes a global template. equipmentIds only ever names the current asset here.
      equipmentIds: [String(equipment.id)],
    }); setEditingId(saved.id); }, asTemplate ? "Template saved for this equipment. Use Assignments to deploy it elsewhere." : "Trend configuration saved. Waiting for historian data."); };
  const deleteTemplate = (definition) => {
    if (window.confirm(`Delete ${definition.name} and all assigned trends?`)) run(() => operatorDefinitionsRepository.deleteDefinition(siteKey, "trend", definition.id), "Template deleted.");
  };
  /** Resolve every pointRequirement of `definition` against one candidate equipment's live points. */
  const resolveForEquipment = (definition, targetEquipmentId) => {
    const target = equipmentList.find((item) => String(item.id) === String(targetEquipmentId));
    const points = operatorRepository.getWorkspacePointsForEquipment(targetEquipmentId, target?.name, target?.status, { activeRelease: releaseData }) || [];
    const mappings = {}; const missing = [];
    for (const requirement of definition.pointRequirements) {
      const point = points.find((item) => String(item.pointKey || item.pointId || item.id) === requirement.pointKey && classifyOperatorPointKind(item) === requirement.kind);
      if (point) mappings[requirement.pointKey] = point.databasePointId || point.id;
      else missing.push(requirement.pointKey);
    }
    return { equipment: target, mappings, missing };
  };
  /** Assign one template to multiple equipment; each target is its own request so one failure never blocks the rest. */
  const assignMany = async (definition, targetIds) => {
    if (busy.current || !targetIds.length) return;
    busy.current = true; setError("");
    const outcomes = [];
    for (const targetId of targetIds) {
      const resolved = resolveForEquipment(definition, targetId);
      if (resolved.missing.length) { outcomes.push({ id: targetId, name: resolved.equipment?.name || targetId, ok: false, reason: `missing ${resolved.missing.join(", ")}` }); continue; }
      try {
        await operatorDefinitionsRepository.assignDefinition(siteKey, "trend", definition.id, [targetId], { [targetId]: resolved.mappings });
        outcomes.push({ id: targetId, name: resolved.equipment?.name || targetId, ok: true });
      } catch (err) { outcomes.push({ id: targetId, name: resolved.equipment?.name || targetId, ok: false, reason: err.message }); }
    }
    try { setStore(await operatorDefinitionsRepository.fetchTrendStore(siteKey)); } catch (err) { /* store refresh best-effort */ }
    const succeeded = outcomes.filter((o) => o.ok);
    const failed = outcomes.filter((o) => !o.ok);
    setError(failed.length
      ? `Assigned to ${succeeded.length} of ${outcomes.length} equipment. Not assigned: ${failed.map((f) => `${f.name} (${f.reason})`).join("; ")}`
      : `Trend assigned to ${succeeded.length} equipment. Waiting for historian data.`);
    if (onSaved) onSaved();
    busy.current = false;
  };
  return <section className="operator-full-workspace trend-workspace" aria-label="Trends workspace"><div className="operator-full-workspace__topbar"><Button variant="link" className="operator-back-link" onClick={onBack}>← Back to Equipment</Button><span className="operator-eyebrow">TRENDS</span></div><div className="operator-editor-panel trend-workspace__card"><div className="logic-wizard__toolbar"><div className="operator-workspace-tabs">{[["points", "Select Points"], ["save", "Save Trend"], ["templates", "Templates"], ["assignments", "Assignments"]].map(([id, label]) => <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div></div>{tab === "points" ? <PointsTab rows={rows} selected={selected} setSelected={setSelected} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} selectedPoints={selectedPoints} onNext={() => setTab("save")} onCancel={onBack} /> : null}{tab === "save" ? <SaveTab name={name} setName={setName} template={template} setTemplate={setTemplate} selectedPoints={selectedPoints} sampleInterval={sampleInterval} setSampleInterval={setSampleInterval} retentionDays={retentionDays} setRetentionDays={setRetentionDays} onBack={() => setTab("points")} onSave={() => saveTrend(template)} onSaveTemplate={() => saveTrend(true)} /> : null}{tab === "templates" ? <TemplatesTab templates={templates} assignments={store.assignments} onOpen={loadTemplate} onDelete={deleteTemplate} /> : null}{tab === "assignments" ? <AssignmentsTab templates={templates} assignments={store.assignments} equipmentList={equipmentList} resolveForEquipment={resolveForEquipment} onAssignMany={assignMany} /> : null}{error ? <div className="alert alert-info mt-3 mb-0">{error}</div> : null}</div></section>;
}

function PointsTab({ rows, selected, setSelected, search, setSearch, filter, setFilter, selectedPoints, onNext, onCancel }) { const toggle = (point) => { const id = String(point.id); setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]); }; return <><div className="logic-wizard__context">Choose one or more equipment points to record in this trend.</div><div className="trend-points-layout"><div><div className="d-flex align-items-center justify-content-between gap-2"><h2>Equipment points</h2><span className="text-muted small">{rows.length} shown</span></div><Form.Control aria-label="Optional point filter" placeholder="Filter points (optional)" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="logic-wizard__filters">{FILTERS.map(([id, label]) => <button type="button" key={id} className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="trend-point-list" aria-label="Scrollable equipment point list">{rows.length ? rows.map((point) => <div className="logic-point-row" key={point.id}><div><strong>{pointLabel(point)}</strong><span>{point.id} · {pointType(point)} · {point.value ?? "—"}</span></div><Button variant="link" size="sm" disabled={selected.includes(String(point.id))} onClick={() => toggle(point)}>+</Button></div>) : <div className="trend-point-empty">No equipment points match the current filter.</div>}</div></div><aside className="logic-wizard__selected"><h2>Selected Points</h2>{selectedPoints.length ? selectedPoints.map((point, index) => <div className="logic-selected-row" key={point.id}><span className="logic-input__key">{index + 1}</span><div><strong>{pointLabel(point)}</strong><span>{point.id} · {pointType(point)}</span></div><Button variant="link" size="sm" aria-label={`Remove ${pointLabel(point)}`} onClick={() => toggle(point)}>×</Button></div>) : <p className="text-muted small">Add points from the list.</p>}<div className="logic-wizard__help"><strong>TREND PREVIEW</strong><br />{selectedPoints.length} points selected<br /><span>Recording: Not configured yet</span></div></aside></div><div className="logic-wizard__footer"><Button variant="link" onClick={onCancel}>Cancel</Button><Button variant="primary" disabled={!selected.length} onClick={onNext}>Next</Button></div></>;
}

function SaveTab({ name, setName, template, setTemplate, selectedPoints, sampleInterval, setSampleInterval, retentionDays, setRetentionDays, onBack, onSave, onSaveTemplate }) { return <><div className="logic-wizard__step"><div className="logic-wizard__intro"><span className="logic-wizard__kicker">FINAL CONFIGURATION</span><h2>Save trend</h2><p>Save the selected points for this equipment. History appears when historian data is available.</p></div><Form.Group><Form.Label>Trend Name</Form.Label><Form.Control value={name} onChange={(event) => setName(event.target.value)} placeholder="FCU temperature and fan trend" /></Form.Group><div className="trend-save-config"><Form.Group><Form.Label>Sample interval (seconds)</Form.Label><Form.Control type="number" min="1" value={sampleInterval} onChange={(event) => setSampleInterval(event.target.value)} /></Form.Group><Form.Group><Form.Label>Retention (days)</Form.Label><Form.Control type="number" min="1" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} /></Form.Group></div><Form.Check className="mt-3" type="switch" label="Save as site-wide template" checked={template} onChange={(event) => setTemplate(event.target.checked)} /><p className="text-muted small mb-0">Save applies to this equipment only. Save as Template additionally creates a separate, reusable definition — it never overwrites an existing template with the same name.</p><div className="trend-save-points"><strong>Selected Points</strong>{selectedPoints.map((point) => <span key={point.id}>{pointLabel(point)}</span>)}</div></div><div className="logic-wizard__footer"><Button variant="outline-secondary" onClick={onBack}>Back</Button><div><Button variant="outline-secondary" onClick={onSaveTemplate}>Save as Template</Button><Button className="ms-2" variant="primary" onClick={onSave}>Save Trend</Button></div></div></>; }

function TemplatesTab({ templates, assignments, onOpen, onDelete }) { return <div className="trend-library"><div className="logic-library__heading"><h2>Trend Templates</h2></div>{templates.length ? templates.map((definition) => <div className="trend-library__row" key={definition.id}><div><strong>{definition.name}</strong><span>{definition.pointIds.length} points · Assigned to {assignments.filter((item) => item.trendDefinitionId === definition.id).length} equipment</span></div><Button size="sm" variant="link" onClick={() => onOpen(definition)}>Open / Edit</Button><Button size="sm" variant="link" className="text-danger" onClick={() => onDelete(definition)}>Delete</Button></div>) : <p className="text-muted">No trend templates saved.</p>}</div>; }
function AssignmentsTab({ templates, assignments, equipmentList, resolveForEquipment, onAssignMany }) { return <div className="trend-library"><div className="logic-library__heading"><h2>Trend Assignments</h2></div>{templates.length ? templates.map((definition) => <AssignmentRow key={definition.id} definition={definition} assignments={assignments} equipmentList={equipmentList} resolveForEquipment={resolveForEquipment} onAssignMany={onAssignMany} />) : <p className="text-muted">Save a trend template before assigning it.</p>}</div>; }

/**
 * Multi-select assignment for one template: every not-yet-assigned equipment is bucketed into
 * compatible (has every required point) / partial (has some) / incompatible (has none), only
 * compatible targets are selectable, and a preview step shows exactly what will be assigned
 * before the user confirms (per LC-ARCH-001 trend workflow spec).
 */
function AssignmentRow({ definition, assignments, equipmentList, resolveForEquipment, onAssignMany }) {
  const assigned = assignments.filter((item) => item.trendDefinitionId === definition.id);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const candidates = equipmentList.filter((item) => !assigned.some((assignment) => String(assignment.assetId) === String(item.id)));
  const evaluated = candidates.map((item) => {
    const resolved = resolveForEquipment(definition, item.id);
    const total = definition.pointRequirements.length;
    const tier = resolved.missing.length === 0 ? "compatible" : resolved.missing.length < total ? "partial" : "incompatible";
    return { equipment: item, tier, missing: resolved.missing, mappings: resolved.mappings };
  });
  const compatible = evaluated.filter((item) => item.tier === "compatible");
  const partial = evaluated.filter((item) => item.tier === "partial");
  const incompatible = evaluated.filter((item) => item.tier === "incompatible");
  const toggle = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  const selectedTargets = compatible.filter((item) => selectedIds.includes(String(item.equipment.id)));
  const confirm = () => { onAssignMany(definition, selectedTargets.map((item) => String(item.equipment.id))); setSelectedIds([]); setPreviewing(false); };
  return <div className="trend-library__assignment trend-library__assignment--rich">
    <div className="d-flex align-items-center justify-content-between">
      <div><strong>{definition.name}</strong><span> · {definition.pointRequirements.length} points · {assigned.length} assigned</span></div>
      {!previewing ? <Button size="sm" variant="outline-secondary" disabled={!selectedIds.length} onClick={() => setPreviewing(true)}>Preview ({selectedIds.length})</Button> : null}
    </div>
    {previewing ? (
      <div className="trend-assign-preview">
        <strong>Ready to assign to {selectedTargets.length} equipment:</strong>
        <ul>{selectedTargets.map((item) => <li key={item.equipment.id}>{item.equipment.displayLabel || item.equipment.name} — {Object.keys(item.mappings).length} points mapped</li>)}</ul>
        <div className="d-flex gap-2"><Button size="sm" variant="outline-secondary" onClick={() => setPreviewing(false)}>Back</Button><Button size="sm" variant="primary" onClick={confirm}>Confirm Assignment</Button></div>
      </div>
    ) : (
      <div className="trend-assign-targets">
        {compatible.length ? compatible.map((item) => <label key={item.equipment.id} className="trend-assign-target trend-assign-target--compatible">
          <input type="checkbox" checked={selectedIds.includes(String(item.equipment.id))} onChange={() => toggle(String(item.equipment.id))} />
          <span>{item.equipment.displayLabel || item.equipment.name}</span><span className="trend-assign-target__tag">Compatible</span>
        </label>) : null}
        {partial.map((item) => <div key={item.equipment.id} className="trend-assign-target trend-assign-target--partial">
          <span>{item.equipment.displayLabel || item.equipment.name}</span><span className="trend-assign-target__tag">Partially compatible — missing {item.missing.join(", ")}</span>
        </div>)}
        {incompatible.length ? <p className="text-muted small mb-0">{incompatible.length} equipment have none of the required points and are hidden.</p> : null}
        {!compatible.length && !partial.length ? <p className="text-muted small mb-0">No unassigned equipment can currently take this template.</p> : null}
      </div>
    )}
  </div>;
}
