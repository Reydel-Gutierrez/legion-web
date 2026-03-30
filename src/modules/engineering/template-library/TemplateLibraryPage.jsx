import React, { useState, useCallback, useMemo } from "react";
import {
  Container,
  Nav,
  Card,
  Button,
  Dropdown,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faFileImport,
  faPlus,
  faEllipsisV,
  faBoxOpen,
  faObjectGroup,
  faCloudUploadAlt,
} from "@fortawesome/free-solid-svg-icons";

import { useHistory } from "react-router-dom";
import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion } from "../../../hooks/useWorkingVersion";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { engineeringRepository } from "../../../lib/data";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { saveWorkingVersion } from "../../../lib/data/repositories/engineeringRepository";
import { Routes } from "../../../routes";
import EquipmentTemplatesTable from "./components/EquipmentTemplatesTable";
import GraphicTemplatesTable from "./components/GraphicTemplatesTable";
import ImportFromGlobalModal from "./components/ImportFromGlobalModal";
import SaveToGlobalModal from "./components/SaveToGlobalModal";
import CreateTemplateModal from "./components/CreateTemplateModal";
import EquipmentTemplateEditorDrawer from "./components/EquipmentTemplateEditorDrawer";
import CreateGraphicTemplateModal from "./components/CreateGraphicTemplateModal";
import BindGraphicTemplateModal from "./components/BindGraphicTemplateModal";
import { countBoundTemplatePointBindings } from "../graphics-manager/graphicTemplateUtils";

// ---------------------------------------------------------------------------
// Helpers: convert global template to site template shape
// ---------------------------------------------------------------------------
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function globalEquipmentToSite(globalRow) {
  const points = (globalRow.points || []).map((p, i) => ({
    ...p,
    id: `pt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
  }));
  return {
    id: generateId("site-eq"),
    name: globalRow.name,
    equipmentType: globalRow.equipmentType,
    pointCount: points.length || globalRow.pointCount || 0,
    defaultGraphic: globalRow.defaultGraphicName || globalRow.defaultGraphic || null,
    description: globalRow.description || "",
    points,
    source: engineeringRepository.SOURCE.GLOBAL_IMPORTED,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

function globalGraphicToSite(globalRow, equipmentTemplates, importedGlobalEquipmentIdToSiteId) {
  let siteEqId =
    globalRow.globalEquipmentTemplateId &&
    importedGlobalEquipmentIdToSiteId &&
    importedGlobalEquipmentIdToSiteId.get(globalRow.globalEquipmentTemplateId);
  if (!siteEqId) {
    siteEqId =
      equipmentTemplates.find((e) => e.equipmentType === globalRow.appliesToEquipmentType)?.id ?? null;
  }
  const eq = siteEqId ? equipmentTemplates.find((e) => e.id === siteEqId) : null;
  let graphicEditorState = globalRow.graphicEditorState;
  if (graphicEditorState && typeof graphicEditorState === "object") {
    graphicEditorState = JSON.parse(JSON.stringify(graphicEditorState));
  }
  const boundPointCount =
    graphicEditorState?.objects != null
      ? countBoundTemplatePointBindings(graphicEditorState.objects)
      : globalRow.boundPointCount ?? 0;

  return {
    id: generateId("site-gfx"),
    name: globalRow.name,
    appliesTo: eq?.name || globalRow.equipmentTemplateName || globalRow.appliesToEquipmentType,
    equipmentTemplateId: eq?.id ?? siteEqId,
    boundPointCount,
    graphicEditorState: graphicEditorState || null,
    source: engineeringRepository.SOURCE.GLOBAL_IMPORTED,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// TemplateLibraryPage
// ---------------------------------------------------------------------------
export default function TemplateLibraryPage() {
  const history = useHistory();
  const { site } = useSite();
  const { workingState, actions, backendWorkingVersionSynced } = useWorkingVersion();
  const [activeTab, setActiveTab] = useState("equipment");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEquipmentEditorDrawer, setShowEquipmentEditorDrawer] = useState(false);
  const [equipmentEditorContext, setEquipmentEditorContext] = useState({ template: null, mode: "create" });
  const [showCreateGraphicModal, setShowCreateGraphicModal] = useState(false);
  const [showSaveToGlobalModal, setShowSaveToGlobalModal] = useState(false);
  const [saveToGlobalToast, setSaveToGlobalToast] = useState(null);
  const [showBindGraphicTemplateModal, setShowBindGraphicTemplateModal] = useState(false);
  const [bindGraphicTemplateRow, setBindGraphicTemplateRow] = useState(null);
  const [importModalInitialTab, setImportModalInitialTab] = useState("equipment");

  const siteTemplates = {
    equipment: workingState.templates?.equipmentTemplates ?? [],
    graphic: workingState.templates?.graphicTemplates ?? [],
  };

  // Combined graphic list: template library + user-created equipment graphics (from Graphics Manager)
  const siteGraphicTemplatesWithEquipmentGraphics = useMemo(() => {
    const fromTemplates = (siteTemplates.graphic || []).map((g) => ({
      ...g,
      _origin: "template",
      boundPointCount:
        g.graphicEditorState?.objects != null
          ? countBoundTemplatePointBindings(g.graphicEditorState.objects)
          : g.boundPointCount ?? 0,
    }));
    const equipmentList = workingState?.equipment ?? [];
    const graphics = workingState?.graphics ?? {};
    const fromEquipment = Object.entries(graphics)
      .filter(([, g]) => g && (g.name || "").trim())
      .map(([equipmentId, g]) => {
        const equipment = equipmentList.find((e) => e.id === equipmentId);
        const appliesTo = equipment ? (equipment.displayLabel || equipment.name || equipmentId) : equipmentId;
        return {
          id: `equipment-graphic-${equipmentId}`,
          name: (g.name || "").trim(),
          appliesTo,
          boundPointCount: Array.isArray(g.objects) ? g.objects.length : 0,
          source: engineeringRepository.SOURCE.SITE_CREATED,
          lastUpdated: g.lastEdited || "—",
          _origin: "equipment",
          equipmentId,
        };
      });
    return [...fromTemplates, ...fromEquipment];
  }, [siteTemplates.graphic, workingState?.equipment, workingState?.graphics]);

  const hasEquipment = (siteTemplates.equipment || []).length > 0;

  const existingEquipmentNames = (siteTemplates.equipment || []).map((e) => e.name);
  const existingGraphicNames = (siteTemplates.graphic || []).map((g) => g.name);

  const handleImportFromGlobal = useCallback((payload) => {
    const { equipment: eqList, graphic: gfxList } = payload || {};
    const prevEq = workingState.templates?.equipmentTemplates ?? [];
    const prevGfx = workingState.templates?.graphicTemplates ?? [];
    const nextEq = [...prevEq];
    const importedGlobalEquipmentIdToSiteId = new Map();

    (eqList || []).forEach((g) => {
      if (nextEq.some((e) => e.name === g.name)) return;
      const siteRow = globalEquipmentToSite(g);
      if (g.id) importedGlobalEquipmentIdToSiteId.set(g.id, siteRow.id);
      nextEq.push(siteRow);
    });

    const nextGfx = [...prevGfx];
    (gfxList || []).forEach((g) => {
      if (nextGfx.some((x) => x.name === g.name)) return;
      nextGfx.push(globalGraphicToSite(g, nextEq, importedGlobalEquipmentIdToSiteId));
    });

    const nextTemplates = { equipmentTemplates: nextEq, graphicTemplates: nextGfx };
    actions.setTemplates(nextTemplates);
    if (USE_HIERARCHY_API && isBackendSiteId(site) && backendWorkingVersionSynced) {
      saveWorkingVersion(site, { ...workingState, templates: nextTemplates }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to persist imported templates", err);
      });
    }
  }, [workingState, site, actions, backendWorkingVersionSynced]);

  const handleRemoveEquipment = useCallback((row) => {
    const nextEq = (workingState.templates?.equipmentTemplates ?? []).filter((e) => e.id !== row.id);
    actions.setTemplates({ equipmentTemplates: nextEq, graphicTemplates: workingState.templates?.graphicTemplates ?? [] });
  }, [workingState.templates, actions]);

  const handleRemoveGraphic = useCallback(
    (row) => {
      if (row._origin === "equipment" && row.equipmentId) {
        actions.setGraphicForEquipment(row.equipmentId, null);
        return;
      }
      const nextGfx = (workingState.templates?.graphicTemplates ?? []).filter((g) => g.id !== row.id);
      actions.setTemplates({ equipmentTemplates: workingState.templates?.equipmentTemplates ?? [], graphicTemplates: nextGfx });
    },
    [workingState.templates, actions]
  );

  const handleViewEquipment = useCallback((row) => {
    setEquipmentEditorContext({ template: row, mode: "view" });
    setShowEquipmentEditorDrawer(true);
  }, []);
  const handleEditEquipment = useCallback((row) => {
    setEquipmentEditorContext({ template: row, mode: "edit" });
    setShowEquipmentEditorDrawer(true);
  }, []);
  const handleSwitchToEditEquipment = useCallback((template) => {
    setEquipmentEditorContext({ template, mode: "edit" });
  }, []);
  const handleSaveEquipmentTemplate = useCallback((payload) => {
    const pointCount = (payload.points && payload.points.length) || payload.pointCount || 0;
    const templateData = {
      name: payload.name,
      equipmentType: payload.equipmentType,
      description: payload.description,
      defaultGraphic: payload.defaultGraphic,
      pointCount,
      points: payload.points || [],
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    const prevEq = workingState.templates?.equipmentTemplates ?? [];
    const prevGfx = workingState.templates?.graphicTemplates ?? [];
    let nextTemplates;
    if (payload.id) {
      const nextEq = prevEq.map((e) =>
        e.id === payload.id ? { ...e, ...templateData } : e
      );
      nextTemplates = { equipmentTemplates: nextEq, graphicTemplates: prevGfx };
    } else {
      const newTemplate = {
        id: generateId("site-eq"),
        ...templateData,
        source: engineeringRepository.SOURCE.SITE_CUSTOM,
      };
      nextTemplates = { equipmentTemplates: [...prevEq, newTemplate], graphicTemplates: prevGfx };
    }
    actions.setTemplates(nextTemplates);
    if (USE_HIERARCHY_API && isBackendSiteId(site) && backendWorkingVersionSynced) {
      saveWorkingVersion(site, { ...workingState, templates: nextTemplates }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to persist equipment template", err);
      });
    }
    setShowEquipmentEditorDrawer(false);
    setEquipmentEditorContext({ template: null, mode: "create" });
  }, [workingState, site, actions, backendWorkingVersionSynced]);
  const handleCloseEquipmentEditor = useCallback(() => {
    setShowEquipmentEditorDrawer(false);
    setEquipmentEditorContext({ template: null, mode: "create" });
  }, []);
  const handleDuplicateFromEditor = useCallback((duplicatePayload) => {
    const pointCount = (duplicatePayload.points && duplicatePayload.points.length) || 0;
    const newTemplate = {
      id: generateId("site-eq"),
      name: duplicatePayload.name || "New Template (Copy)",
      equipmentType: duplicatePayload.equipmentType || "VAV",
      description: duplicatePayload.description || "",
      defaultGraphic: duplicatePayload.defaultGraphic || null,
      pointCount,
      points: (duplicatePayload.points || []).map((p) => ({
        ...p,
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      })),
      source: engineeringRepository.SOURCE.SITE_CUSTOM,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    const prevEq = workingState.templates?.equipmentTemplates ?? [];
    actions.setTemplates({ equipmentTemplates: [...prevEq, newTemplate], graphicTemplates: workingState.templates?.graphicTemplates ?? [] });
    setShowEquipmentEditorDrawer(false);
    setEquipmentEditorContext({ template: null, mode: "create" });
  }, [workingState.templates, actions]);
  const handleDuplicateEquipment = useCallback((row) => {
    const pointCount = (row.points && row.points.length) || row.pointCount || 0;
    const newTemplate = {
      ...row,
      id: generateId("site-eq"),
      name: `${row.name} (Copy)`,
      pointCount,
      points: (row.points || []).map((p) => ({
        ...p,
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      })),
      source: engineeringRepository.SOURCE.SITE_CUSTOM,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    const prevEq = workingState.templates?.equipmentTemplates ?? [];
    actions.setTemplates({ equipmentTemplates: [...prevEq, newTemplate], graphicTemplates: workingState.templates?.graphicTemplates ?? [] });
  }, [workingState.templates, actions]);

  const handleViewGraphic = useCallback(
    (row) => {
      if (row._origin === "template") {
        history.push(
          `${Routes.EngineeringGraphicsManager.path}?graphicTemplateId=${encodeURIComponent(row.id)}`
        );
        return;
      }
      const equipmentId =
        row._origin === "equipment"
          ? row.equipmentId
          : (workingState?.equipment ?? []).find(
              (e) => e.graphicTemplateId === row.id || (workingState?.graphics?.[e.id]?.graphicTemplateId === row.id)
            )?.id;
      if (equipmentId) {
        history.push(`${Routes.EngineeringGraphicsManager.path}?equipmentId=${encodeURIComponent(equipmentId)}`);
      } else if (row._origin === "equipment") {
        history.push(`${Routes.EngineeringGraphicsManager.path}?equipmentId=${encodeURIComponent(row.equipmentId)}`);
      } else {
        history.push(Routes.EngineeringGraphicsManager.path);
      }
    },
    [workingState?.equipment, workingState?.graphics, history]
  );

  const handleEditGraphic = useCallback(
    (row) => {
      if (row._origin === "template") {
        history.push(
          `${Routes.EngineeringGraphicsManager.path}?graphicTemplateId=${encodeURIComponent(row.id)}`
        );
        return;
      }
      const equipmentId =
        row._origin === "equipment"
          ? row.equipmentId
          : (workingState?.equipment ?? []).find(
              (e) => e.graphicTemplateId === row.id || (workingState?.graphics?.[e.id]?.graphicTemplateId === row.id)
            )?.id;
      if (equipmentId) {
        history.push(`${Routes.EngineeringGraphicsManager.path}?equipmentId=${encodeURIComponent(equipmentId)}`);
      } else if (row._origin === "equipment") {
        history.push(`${Routes.EngineeringGraphicsManager.path}?equipmentId=${encodeURIComponent(row.equipmentId)}`);
      } else {
        history.push(Routes.EngineeringGraphicsManager.path);
      }
    },
    [workingState?.equipment, workingState?.graphics, history]
  );

  const handleDuplicateGraphic = useCallback((row) => {
    if (row._origin === "equipment") return;
    const { _origin, equipmentId: _eqId, ...rest } = row;
    const newGfx = {
      ...rest,
      id: generateId("site-gfx"),
      name: `${row.name} (Copy)`,
      source: engineeringRepository.SOURCE.SITE_CUSTOM,
      lastUpdated: new Date().toISOString().slice(0, 10),
      graphicEditorState: row.graphicEditorState
        ? JSON.parse(JSON.stringify(row.graphicEditorState))
        : row.graphicEditorState,
    };
    const prevGfx = workingState.templates?.graphicTemplates ?? [];
    actions.setTemplates({ equipmentTemplates: workingState.templates?.equipmentTemplates ?? [], graphicTemplates: [...prevGfx, newGfx] });
  }, [workingState.templates, actions]);

  const handleOpenBindGraphicTemplate = useCallback((row) => {
    if (row._origin !== "template") return;
    setBindGraphicTemplateRow(row);
    setShowBindGraphicTemplateModal(true);
  }, []);

  const handleBindGraphicTemplateConfirm = useCallback(
    ({ equipmentTemplateId }) => {
      const row = bindGraphicTemplateRow;
      if (!row || row._origin !== "template" || !equipmentTemplateId) return;
      const eq = (workingState.templates?.equipmentTemplates || []).find((e) => e.id === equipmentTemplateId);
      if (!eq) return;
      const prevGfx = workingState.templates?.graphicTemplates || [];
      const prevEq = workingState.templates?.equipmentTemplates || [];
      const now = new Date().toISOString().slice(0, 10);
      const nextGfx = prevGfx.map((g) =>
        g.id === row.id
          ? {
              ...g,
              equipmentTemplateId: eq.id,
              appliesTo: eq.name || "",
              lastUpdated: now,
            }
          : g
      );
      actions.setTemplates({ equipmentTemplates: prevEq, graphicTemplates: nextGfx });
      setShowBindGraphicTemplateModal(false);
      setBindGraphicTemplateRow(null);
    },
    [bindGraphicTemplateRow, workingState.templates?.equipmentTemplates, workingState.templates?.graphicTemplates, actions]
  );

  const handleCloseBindGraphicTemplateModal = useCallback(() => {
    setShowBindGraphicTemplateModal(false);
    setBindGraphicTemplateRow(null);
  }, []);

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faBook} className="me-2" />
              Template Library
            </h5>
            <div className="text-white-50 small">
              Manage equipment and graphic templates available for this site.
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={() => {
                setImportModalInitialTab(activeTab === "graphic" ? "graphic" : "equipment");
                setShowImportModal(true);
              }}
            >
              <FontAwesomeIcon icon={faFileImport} className="me-1" /> Import from Global Library
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <FontAwesomeIcon icon={faPlus} className="me-1" /> Create Template
            </Button>
            <Dropdown>
              <Dropdown.Toggle
                size="sm"
                variant="dark"
                className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
              >
                Actions <FontAwesomeIcon icon={faEllipsisV} className="ms-1" />
              </Dropdown.Toggle>
              <Dropdown.Menu align="end" className="legion-dropdown-menu">
                <Dropdown.Item
                  className="text-white"
                  onClick={() => setShowSaveToGlobalModal(true)}
                >
                  <FontAwesomeIcon icon={faCloudUploadAlt} className="me-2" />
                  Save to Global Library
                </Dropdown.Item>
                <Dropdown.Item className="text-white-50" disabled>
                  Export templates (coming soon)
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        <p className="text-white-50 small mb-3">
          Templates in this library are available for use in this job. Import standards from the Legion Global Template Library or create site-specific templates.
        </p>

        <Nav variant="tabs" className="mb-3 template-library-tabs">
          <Nav.Item>
            <Nav.Link
              active={activeTab === "equipment"}
              onClick={() => setActiveTab("equipment")}
              className="text-white-50"
            >
              <FontAwesomeIcon icon={faBoxOpen} className="me-1" /> Equipment Templates
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === "graphic"}
              onClick={() => setActiveTab("graphic")}
              className="text-white-50"
            >
              <FontAwesomeIcon icon={faObjectGroup} className="me-1" /> Graphic Templates
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Body className="p-0">
            {activeTab === "equipment" && (
              <EquipmentTemplatesTable
                templates={siteTemplates.equipment}
                onView={handleViewEquipment}
                onEdit={handleEditEquipment}
                onDuplicate={handleDuplicateEquipment}
                onRemoveFromSite={handleRemoveEquipment}
              />
            )}
            {activeTab === "graphic" && (
              <GraphicTemplatesTable
                templates={siteGraphicTemplatesWithEquipmentGraphics}
                onView={handleViewGraphic}
                onEdit={handleEditGraphic}
                onDuplicate={handleDuplicateGraphic}
                onBindEquipmentTemplate={handleOpenBindGraphicTemplate}
                onRemoveFromSite={handleRemoveGraphic}
              />
            )}
          </Card.Body>
        </Card>
      </div>

      <ImportFromGlobalModal
        show={showImportModal}
        onHide={() => setShowImportModal(false)}
        onImport={handleImportFromGlobal}
        existingEquipmentNames={existingEquipmentNames}
        existingGraphicNames={existingGraphicNames}
        initialTab={importModalInitialTab}
      />

      <SaveToGlobalModal
        show={showSaveToGlobalModal}
        onHide={() => setShowSaveToGlobalModal(false)}
        equipmentTemplates={siteTemplates.equipment}
        graphicTemplates={siteTemplates.graphic}
        onSaved={(counts) => {
          setSaveToGlobalToast(counts);
          setTimeout(() => setSaveToGlobalToast(null), 4000);
        }}
      />

      {saveToGlobalToast && (
        <div className="position-fixed bottom-0 end-0 m-3 p-3 rounded border border-success border-opacity-50 bg-success bg-opacity-10 shadow">
          <div className="text-success small fw-semibold">
            {saveToGlobalToast.total} template(s) saved to Global Library.
            {saveToGlobalToast.equipment > 0 && ` ${saveToGlobalToast.equipment} equipment.`}
            {saveToGlobalToast.graphic > 0 && ` ${saveToGlobalToast.graphic} graphic.`}
          </div>
          <Button
            size="sm"
            variant="link"
            className="text-success p-0 mt-1"
            onClick={() => setSaveToGlobalToast(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      <CreateTemplateModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onCreateEquipmentTemplate={() => {
          setShowCreateModal(false);
          setEquipmentEditorContext({ template: null, mode: "create" });
          setShowEquipmentEditorDrawer(true);
        }}
        onCreateGraphicTemplate={() => {
          setShowCreateModal(false);
          setShowCreateGraphicModal(true);
        }}
        hasEquipmentTemplates={hasEquipment}
      />

      <EquipmentTemplateEditorDrawer
        open={showEquipmentEditorDrawer}
        onClose={handleCloseEquipmentEditor}
        template={equipmentEditorContext.template}
        mode={equipmentEditorContext.mode}
        graphicOptions={(siteTemplates.graphic || []).map((g) => g.name)}
        onSave={handleSaveEquipmentTemplate}
        onDuplicate={handleDuplicateFromEditor}
        onSwitchToEdit={handleSwitchToEditEquipment}
      />

      <CreateGraphicTemplateModal
        show={showCreateGraphicModal}
        onHide={() => setShowCreateGraphicModal(false)}
        equipmentTemplates={siteTemplates.equipment}
      />

      <BindGraphicTemplateModal
        show={showBindGraphicTemplateModal}
        onHide={handleCloseBindGraphicTemplateModal}
        graphicTemplateName={bindGraphicTemplateRow?.name}
        equipmentTemplates={siteTemplates.equipment}
        initialEquipmentTemplateId={bindGraphicTemplateRow?.equipmentTemplateId || ""}
        onConfirm={handleBindGraphicTemplateConfirm}
      />
    </Container>
  );
}
