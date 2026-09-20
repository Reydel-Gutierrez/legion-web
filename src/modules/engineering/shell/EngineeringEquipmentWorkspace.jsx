import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import EquipmentWorkspaceTabs from "../../operator/workspace/EquipmentWorkspaceTabs";
import EquipmentPlaceholderCard from "../../operator/workspace/EquipmentPlaceholderCard";
import DeployedGraphicPreview from "../../operator/equipment/DeployedGraphicPreview";
import { getEquipmentTypeLabel } from "../equipment-builder/equipmentTypes";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { scheduleMatchesEquipment } from "../../../lib/operator/equipmentOccupancy";
import { Routes } from "../../../routes";
import EquipmentEditorPanel from "../equipment-builder/components/EquipmentEditorPanel";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";

function findBuildingAndFloor(siteTree, floorId) {
  for (const b of siteTree?.children || []) {
    const floor = (b.children || []).find((f) => f.id === floorId);
    if (floor) return { building: b, floor };
  }
  return { building: null, floor: null };
}

/** Mirrors OperatorBreadcrumbs' markup/classes so the equipment header matches pixel-for-pixel; links select the Engineering tree node instead of routing. */
function EngineeringEquipmentBreadcrumbs({ siteTree, building, floor, equipmentLabel, onSelectNode }) {
  const crumbs = [
    siteTree ? { id: siteTree.id, label: siteTree.name, node: siteTree } : null,
    building ? { id: building.id, label: building.name, node: building } : null,
    floor ? { id: floor.id, label: floor.displayLabel || floor.name, node: floor } : null,
    equipmentLabel ? { id: "equipment", label: equipmentLabel, node: null } : null,
  ].filter(Boolean);
  if (!crumbs.length) return null;

  return (
    <nav className="operator-breadcrumb" aria-label="Hierarchy">
      {crumbs.map((c, i) => (
        <span key={c.id} className="operator-breadcrumb__item">
          {i > 0 ? <span className="operator-breadcrumb__sep">›</span> : null}
          {i === crumbs.length - 1 || !c.node ? (
            <span className="operator-breadcrumb__current">{c.label}</span>
          ) : (
            <button type="button" className="operator-breadcrumb__link" onClick={() => onSelectNode(c.node)}>
              {c.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function EquipmentGraphicOverviewCard({ graphic, expandedId, onToggleExpand }) {
  const hasGraphic = graphic && (graphic.objects?.length > 0 || graphic.backgroundImage?.dataUrl);
  return (
    <ExpandableWorkspaceCard title="Equipment Graphic" cardId="graphic" expandedId={expandedId} onToggleExpand={onToggleExpand} className="equipment-graphic-panel" clipOverflow>
      <div className="equipment-graphic-card">
        {hasGraphic ? (
          <DeployedGraphicPreview graphic={graphic} points={[]} fit="contain" zoomFactor={1} />
        ) : (
          <div className="operator-empty-graphic">No graphic assigned for this equipment.</div>
        )}
      </div>
    </ExpandableWorkspaceCard>
  );
}

function EquipmentPointsOverviewCard({ points, expandedId, onToggleExpand, onViewAll }) {
  const expanded = expandedId === "points";
  const rows = expanded ? points : points.slice(0, 8);
  return (
    <ExpandableWorkspaceCard
      title={`Points Overview (${points.length})`}
      cardId="points"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      clipOverflow={!expanded}
      footer={expanded ? null : <button type="button" className="operator-text-link" onClick={onViewAll}>View All Points →</button>}
    >
      <div className="points-table-wrap">
        <table className="points-table">
          <thead>
            <tr>
              <th>Point Name</th>
              <th>Type</th>
              <th>Mapped</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="points-table__empty">No points defined for this equipment yet. Assign a template in the equipment details.</td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.pointLabel || p.pointKey}</td>
                  <td>{p.expectedType || "—"}</td>
                  <td>{p.mapped ? "Yes" : "No"}</td>
                  <td>{p.notes || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ExpandableWorkspaceCard>
  );
}

function EquipmentDetailsOverviewCard({ primaryRows, technicalRows, expandedId, onToggleExpand, editing, onToggleEdit, editorProps }) {
  const expanded = expandedId === "details";
  const rows = expanded ? [...primaryRows, ...technicalRows] : primaryRows;
  return (
    <ExpandableWorkspaceCard
      title="Equipment Details"
      cardId="details"
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      clipOverflow={!expanded && !editing}
      headerExtra={
        <button type="button" className="operator-text-link" onClick={onToggleEdit}>
          {editing ? "Done" : "Edit"}
        </button>
      }
      footer={
        !editing && !expanded ? (
          <button type="button" className="operator-text-link" onClick={() => onToggleExpand("details")}>
            View All Details →
          </button>
        ) : null
      }
    >
      {editing ? (
        <div className="engineering-light-form">
          <EquipmentEditorPanel {...editorProps} />
        </div>
      ) : (
        <dl className="details-grid">
          {rows.map((row) => (
            <div key={row.key} className="details-grid__row">
              <dt>{row.key}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </ExpandableWorkspaceCard>
  );
}

function EquipmentTrendsOverviewCard({ assignments, expandedId, onToggleExpand, onConfigure }) {
  return (
    <ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId={expandedId} onToggleExpand={onToggleExpand} clipOverflow>
      {assignments.length === 0 ? (
        <div className="operator-empty-graphic">No trend logging configured for this equipment.</div>
      ) : (
        <ul className="engineering-simple-list">
          {assignments.map((a) => (
            <li key={a.id}>{a.name}</li>
          ))}
        </ul>
      )}
      <button type="button" className="operator-text-link" onClick={onConfigure}>Configure Trends →</button>
    </ExpandableWorkspaceCard>
  );
}

export default function EngineeringEquipmentWorkspace() {
  const navigate = useNavigate();
  const { siteTree, selectedEquipment: equipment, workingState, breadcrumb, floors, handleSaveEquipment, handleDeleteEquipment, equipmentList, handleGraphicChange, handleDuplicateEquipment, handleMoveEquipment, handleSelectNode } = useEngineeringSiteTree();
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedId, setExpandedId] = useState(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [alarmDefs, setAlarmDefs] = useState([]);
  const [trendStore, setTrendStore] = useState({ definitions: [], assignments: [] });
  const [schedules, setSchedules] = useState([]);

  const siteApiId = workingState?.site?.id;

  useEffect(() => {
    setActiveTab("overview");
    setEditingDetails(false);
  }, [equipment?.id]);

  useEffect(() => {
    let active = true;
    if (!equipment?.id || !isBackendSiteId(siteApiId)) {
      setAlarmDefs([]);
      return undefined;
    }
    operatorRepository.listOperatorAlarmDefinitions(siteApiId, { equipmentId: equipment.id }).then((rows) => {
      if (active) setAlarmDefs(Array.isArray(rows) ? rows : []);
    }).catch(() => { if (active) setAlarmDefs([]); });
    return () => { active = false; };
  }, [siteApiId, equipment?.id]);

  useEffect(() => {
    let active = true;
    if (!siteApiId) return undefined;
    operatorDefinitionsRepository.fetchTrendStore(siteApiId).then((store) => {
      if (active) setTrendStore(store);
    }).catch(() => { if (active) setTrendStore({ definitions: [], assignments: [] }); });
    operatorDefinitionsRepository.fetchSchedules(siteApiId).then((rows) => {
      if (active) setSchedules(Array.isArray(rows) ? rows : []);
    }).catch(() => { if (active) setSchedules([]); });
    return () => { active = false; };
  }, [siteApiId]);

  const graphic = useMemo(() => (equipment ? workingState.graphics?.[equipment.id] || null : null), [workingState.graphics, equipment]);

  const { building, floor } = useMemo(() => findBuildingAndFloor(siteTree, equipment?.floorId), [siteTree, equipment?.floorId]);

  const templatePoints = useMemo(() => {
    if (!equipment) return [];
    const tmpl = (workingState.templates?.equipmentTemplates || []).find((t) => t.name === equipment.templateName);
    const mapped = workingState.mappings?.[equipment.id] || {};
    return (tmpl?.points || []).map((p) => ({ ...p, mapped: Boolean(mapped[p.pointKey]) }));
  }, [equipment, workingState.templates, workingState.mappings]);

  const trendAssignments = useMemo(() => {
    if (!equipment) return [];
    return trendStore.assignments
      .filter((a) => String(a.assetId) === String(equipment.id) && a.loggingEnabled)
      .map((a) => {
        const def = trendStore.definitions.find((d) => d.id === a.trendDefinitionId);
        return { id: a.id, name: def?.name || "Trend" };
      });
  }, [trendStore, equipment]);

  const equipmentSchedules = useMemo(() => {
    if (!equipment) return [];
    return schedules.filter((s) => scheduleMatchesEquipment(s, equipment));
  }, [schedules, equipment]);

  if (!equipment) return null;

  const typeCode = equipment.type || equipment.equipmentType || "";
  const typeLabel = equipment.description || getEquipmentTypeLabel(typeCode) || typeCode;
  const floorLabel = floor?.displayLabel || floor?.name || "";
  const buildingLabel = building?.name || "";
  const headerMeta = [typeLabel, floorLabel, buildingLabel !== floorLabel ? buildingLabel : null, typeCode !== typeLabel ? typeCode : null].filter(
    Boolean
  );

  const primaryDetailRows = [
    { key: "Name", value: equipment.displayLabel || equipment.name || "—" },
    { key: "Description", value: equipment.notes || typeLabel || "—" },
    { key: "Location", value: floorLabel || equipment.locationLabel || "—" },
    { key: "Building", value: buildingLabel || "—" },
  ];
  const technicalDetailRows = [
    { key: "System", value: typeCode || "—" },
    { key: "Controller", value: equipment.controllerRef || "Unassigned" },
    { key: "Template", value: equipment.templateName || "—" },
    { key: "Point Count", value: templatePoints.length || equipment.pointsDefined || 0 },
  ];

  const editorProps = {
    equipment,
    breadcrumb,
    floors,
    onSave: (id, form) => { handleSaveEquipment(id, form); setEditingDetails(false); },
    onDelete: handleDeleteEquipment,
    equipmentTemplates: workingState.templates?.equipmentTemplates ?? [],
    existingInstanceNumbers: (workingState.equipment || []).filter((e) => e.id !== equipment.id).map((e) => e.instanceNumber).filter(Boolean),
    graphics: workingState.graphics ?? {},
    graphicTemplates: workingState.templates?.graphicTemplates ?? [],
    equipmentList: workingState.equipment ?? [],
    onGraphicChange: handleGraphicChange,
    discoveredDevices: workingState.discoveredDevices ?? [],
    onDuplicateEquipment: handleDuplicateEquipment,
    onMoveEquipment: (delta) => handleMoveEquipment(equipment.id, delta),
  };

  const goToPointMapping = () => navigate(`${Routes.EngineeringPointMapping.path}?equipmentId=${equipment.id}`);
  const goToGraphicsManager = () => navigate(`${Routes.EngineeringGraphicsManager.path}?equipmentId=${equipment.id}`);

  return (
    <div className={`equipment-workspace${expandedId ? ` is-expanded-${expandedId}` : ""}`}>
      <header className="equipment-header">
        <EngineeringEquipmentBreadcrumbs
          siteTree={siteTree}
          building={building}
          floor={floor}
          equipmentLabel={equipment.displayLabel || equipment.name}
          onSelectNode={handleSelectNode}
        />
        <div className="equipment-header__top">
          <div className="equipment-header__row">
            <span className="equipment-header__icon" aria-hidden="true">
              <FacilityKindIcon kind="equipment" />
            </span>
            <div>
              <div className="equipment-header__title-row">
                <h1 className="workspace-header__title">{equipment.displayLabel || equipment.name}</h1>
              </div>
              <p className="workspace-header__meta">
                {headerMeta.map((item, i) => (
                  <React.Fragment key={`${item}-${i}`}>
                    {i > 0 ? <span className="workspace-header__dot" aria-hidden="true">|</span> : null}
                    <span>{item}</span>
                  </React.Fragment>
                ))}
              </p>
            </div>
          </div>
        </div>
      </header>

      <EquipmentWorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="equipment-workspace__grid">
          <EquipmentGraphicOverviewCard graphic={graphic} expandedId={expandedId} onToggleExpand={setExpandedId} />
          <EquipmentTrendsOverviewCard assignments={trendAssignments} expandedId={expandedId} onToggleExpand={setExpandedId} onConfigure={() => setActiveTab("trends")} />
          <EquipmentPointsOverviewCard points={templatePoints} expandedId={expandedId} onToggleExpand={setExpandedId} onViewAll={() => setActiveTab("points")} />
          <EquipmentDetailsOverviewCard
            primaryRows={primaryDetailRows}
            technicalRows={technicalDetailRows}
            expandedId={expandedId}
            onToggleExpand={setExpandedId}
            editing={editingDetails}
            onToggleEdit={() => setEditingDetails((v) => !v)}
            editorProps={editorProps}
          />
        </div>
      )}

      {activeTab === "points" && (
        <div className="equipment-workspace__single">
          <EquipmentPointsOverviewCard points={templatePoints} expandedId="points" onToggleExpand={() => setActiveTab("overview")} onViewAll={goToPointMapping} />
        </div>
      )}

      {activeTab === "graphics" && (
        <div className="equipment-workspace__single">
          <ExpandableWorkspaceCard title="Equipment Graphic" cardId="graphic" expandedId="graphic" onToggleExpand={() => setActiveTab("overview")} className="equipment-graphic-panel" clipOverflow footer={<button type="button" className="operator-text-link" onClick={goToGraphicsManager}>Edit in Graphics Manager →</button>}>
            <div className="equipment-graphic-card">
              {graphic && (graphic.objects?.length > 0 || graphic.backgroundImage?.dataUrl) ? (
                <DeployedGraphicPreview graphic={graphic} points={[]} fit="contain" zoomFactor={1} />
              ) : (
                <div className="operator-empty-graphic">No graphic assigned for this equipment.</div>
              )}
            </div>
          </ExpandableWorkspaceCard>
        </div>
      )}

      {activeTab === "network" && (
        <div className="equipment-workspace__single">
          <ExpandableWorkspaceCard title="Network Details" cardId="network" expandedId="network" onToggleExpand={() => setActiveTab("overview")}>
            <dl className="details-grid">
              <div className="details-grid__row"><dt>Controller</dt><dd>{equipment.controllerRef || "Unassigned"}</dd></div>
              <div className="details-grid__row"><dt>Address</dt><dd>{equipment.address || "—"}</dd></div>
              <div className="details-grid__row"><dt>Instance Number</dt><dd>{equipment.instanceNumber || "—"}</dd></div>
              <div className="details-grid__row"><dt>Location Label</dt><dd>{equipment.locationLabel || "—"}</dd></div>
            </dl>
          </ExpandableWorkspaceCard>
        </div>
      )}

      {activeTab === "alarms" && (
        <div className="equipment-workspace__single">
          <ExpandableWorkspaceCard title="Alarm Rules" cardId="alarms" expandedId="alarms" onToggleExpand={() => setActiveTab("overview")}>
            {alarmDefs.length === 0 ? (
              <div className="operator-empty-graphic">No alarm rules configured for this equipment.</div>
            ) : (
              <ul className="engineering-simple-list">
                {alarmDefs.map((def) => (
                  <li key={def.id}>{def.name} — {def.category} {def.operator} {def.targetValue ?? ""} ({def.severity})</li>
                ))}
              </ul>
            )}
          </ExpandableWorkspaceCard>
        </div>
      )}

      {activeTab === "trends" && (
        <div className="equipment-workspace__single">
          <EquipmentTrendsOverviewCard assignments={trendAssignments} expandedId="trends" onToggleExpand={() => setActiveTab("overview")} onConfigure={() => {}} />
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="equipment-workspace__single">
          <ExpandableWorkspaceCard title="Schedule" cardId="schedule" expandedId="schedule" onToggleExpand={() => setActiveTab("overview")}>
            {equipmentSchedules.length === 0 ? (
              <div className="operator-empty-graphic">No weekly schedule configured for this equipment.</div>
            ) : (
              <ul className="engineering-simple-list">
                {equipmentSchedules.map((s) => (
                  <li key={s.id}>{s.name} — {s.day} {s.startTime}–{s.endTime} ({s.action})</li>
                ))}
              </ul>
            )}
          </ExpandableWorkspaceCard>
        </div>
      )}

      {activeTab === "logic" && (
        <div className="equipment-workspace__single">
          <EquipmentPlaceholderCard title="Logic" message="Logic configuration is not available yet." onToggleExpand={() => setActiveTab("overview")} />
        </div>
      )}

      {activeTab === "files" && (
        <div className="equipment-workspace__single">
          <EquipmentPlaceholderCard title="Files" message="File attachments are not available yet." onToggleExpand={() => setActiveTab("overview")} />
        </div>
      )}
    </div>
  );
}
