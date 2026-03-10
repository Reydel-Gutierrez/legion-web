import React, { useState, useCallback, useMemo, useEffect } from "react";
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
} from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import {
  getSiteTemplates,
  SOURCE,
} from "../data/mockTemplateLibraryData";
import EmptyTemplateState from "./components/EmptyTemplateState";
import EquipmentTemplatesTable from "./components/EquipmentTemplatesTable";
import GraphicTemplatesTable from "./components/GraphicTemplatesTable";
import ImportFromGlobalModal from "./components/ImportFromGlobalModal";
import CreateTemplateModal from "./components/CreateTemplateModal";
import EquipmentTemplateEditorDrawer from "./components/EquipmentTemplateEditorDrawer";
import CreateGraphicTemplateModal from "./components/CreateGraphicTemplateModal";

// ---------------------------------------------------------------------------
// Helpers: convert global template to site template shape
// ---------------------------------------------------------------------------
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function globalEquipmentToSite(globalRow) {
  return {
    id: generateId("site-eq"),
    name: globalRow.name,
    equipmentType: globalRow.equipmentType,
    pointCount: globalRow.pointCount || 0,
    defaultGraphic: globalRow.defaultGraphicName || null,
    description: "",
    points: [],
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

function globalGraphicToSite(globalRow, equipmentTemplates) {
  const appliesTo = equipmentTemplates.find(
    (e) => e.equipmentType === globalRow.appliesToEquipmentType
  )?.name || globalRow.appliesToEquipmentType;
  return {
    id: generateId("site-gfx"),
    name: globalRow.name,
    appliesTo,
    boundPointCount: globalRow.boundPointCount,
    source: SOURCE.GLOBAL_IMPORTED,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// TemplateLibraryPage
// ---------------------------------------------------------------------------
export default function TemplateLibraryPage() {
  const { site } = useSite();
  const [siteTemplates, setSiteTemplates] = useState({ equipment: [], graphic: [] });
  const [activeTab, setActiveTab] = useState("equipment");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEquipmentEditorDrawer, setShowEquipmentEditorDrawer] = useState(false);
  const [equipmentEditorContext, setEquipmentEditorContext] = useState({ template: null, mode: "create" });
  const [showCreateGraphicModal, setShowCreateGraphicModal] = useState(false);

  const useSampleData = true;
  const initialFromMock = useMemo(
    () => getSiteTemplates(site, useSampleData),
    [site, useSampleData]
  );

  useEffect(() => {
    setSiteTemplates(initialFromMock);
  }, [initialFromMock]);

  const hasEquipment = (siteTemplates.equipment || []).length > 0;
  const hasGraphic = (siteTemplates.graphic || []).length > 0;
  const isEmpty = !hasEquipment && !hasGraphic;

  const existingEquipmentNames = (siteTemplates.equipment || []).map((e) => e.name);
  const existingGraphicNames = (siteTemplates.graphic || []).map((g) => g.name);

  const handleImportFromGlobal = useCallback((payload) => {
    const { equipment: eqList, graphic: gfxList } = payload || {};
    setSiteTemplates((prev) => {
      const nextEq = [...(prev.equipment || [])];
      (eqList || []).forEach((g) => {
        if (!nextEq.some((e) => e.name === g.name)) {
          nextEq.push(globalEquipmentToSite(g));
        }
      });
      const nextGfx = [...(prev.graphic || [])];
      (gfxList || []).forEach((g) => {
        if (!nextGfx.some((x) => x.name === g.name)) {
          nextGfx.push(globalGraphicToSite(g, nextEq));
        }
      });
      return { equipment: nextEq, graphic: nextGfx };
    });
  }, []);

  const handleRemoveEquipment = useCallback((row) => {
    setSiteTemplates((prev) => ({
      ...prev,
      equipment: (prev.equipment || []).filter((e) => e.id !== row.id),
    }));
  }, []);

  const handleRemoveGraphic = useCallback((row) => {
    setSiteTemplates((prev) => ({
      ...prev,
      graphic: (prev.graphic || []).filter((g) => g.id !== row.id),
    }));
  }, []);

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
    if (payload.id) {
      setSiteTemplates((prev) => ({
        ...prev,
        equipment: (prev.equipment || []).map((e) =>
          e.id === payload.id ? { ...e, ...templateData } : e
        ),
      }));
    } else {
      setSiteTemplates((prev) => ({
        ...prev,
        equipment: [
          ...(prev.equipment || []),
          {
            id: generateId("site-eq"),
            ...templateData,
            source: SOURCE.SITE_CUSTOM,
          },
        ],
      }));
    }
    setShowEquipmentEditorDrawer(false);
    setEquipmentEditorContext({ template: null, mode: "create" });
  }, []);
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
      source: SOURCE.SITE_CUSTOM,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    setSiteTemplates((prev) => ({
      ...prev,
      equipment: [...(prev.equipment || []), newTemplate],
    }));
    setShowEquipmentEditorDrawer(false);
    setEquipmentEditorContext({ template: null, mode: "create" });
  }, []);
  const handleDuplicateEquipment = useCallback((row) => {
    const pointCount = (row.points && row.points.length) || row.pointCount || 0;
    setSiteTemplates((prev) => ({
      ...prev,
      equipment: [
        ...(prev.equipment || []),
        {
          ...row,
          id: generateId("site-eq"),
          name: `${row.name} (Copy)`,
          pointCount,
          points: (row.points || []).map((p) => ({
            ...p,
            id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          })),
          source: SOURCE.SITE_CUSTOM,
          lastUpdated: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  }, []);

  const handleViewGraphic = useCallback((row) => {
    console.log("View graphic template", row);
  }, []);
  const handleEditGraphic = useCallback((row) => {
    console.log("Edit graphic template", row);
  }, []);
  const handleDuplicateGraphic = useCallback((row) => {
    setSiteTemplates((prev) => ({
      ...prev,
      graphic: [
        ...(prev.graphic || []),
        {
          ...row,
          id: generateId("site-gfx"),
          name: `${row.name} (Copy)`,
          source: SOURCE.SITE_CUSTOM,
          lastUpdated: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
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
              onClick={() => setShowImportModal(true)}
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
                <Dropdown.Item className="text-white-50" disabled>
                  Save to Global Library (coming soon)
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
          <Nav.Item>
            <Nav.Link disabled className="text-white-50 opacity-50">
              Point Templates
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link disabled className="text-white-50 opacity-50">
              Alarm Profiles
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link disabled className="text-white-50 opacity-50">
              Sequences
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {isEmpty ? (
          <EmptyTemplateState
            onImportFromGlobal={() => setShowImportModal(true)}
            onCreateEquipmentTemplate={() => {
              setEquipmentEditorContext({ template: null, mode: "create" });
              setShowEquipmentEditorDrawer(true);
            }}
            onCreateGraphicTemplate={() => setShowCreateGraphicModal(true)}
            hasEquipmentTemplates={hasEquipment}
          />
        ) : (
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
                  templates={siteTemplates.graphic}
                  onView={handleViewGraphic}
                  onEdit={handleEditGraphic}
                  onDuplicate={handleDuplicateGraphic}
                  onRemoveFromSite={handleRemoveGraphic}
                />
              )}
            </Card.Body>
          </Card>
        )}
      </div>

      <ImportFromGlobalModal
        show={showImportModal}
        onHide={() => setShowImportModal(false)}
        onImport={handleImportFromGlobal}
        existingEquipmentNames={existingEquipmentNames}
        existingGraphicNames={existingGraphicNames}
      />

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
      />
    </Container>
  );
}
