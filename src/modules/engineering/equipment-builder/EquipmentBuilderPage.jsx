import React, { useState, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, Button, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEllipsisV,
  faFileImport,
  faFileExport,
  faTrashAlt,
  faSitemap,
} from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import EquipmentWorkspace from "./components/EquipmentWorkspace";
import EquipmentEditorPanel from "./components/EquipmentEditorPanel";
import AddEquipmentModal from "./components/AddEquipmentModal";
import AddEquipmentGroupModal from "./components/AddEquipmentGroupModal";
import EmptyEquipmentState from "./components/EmptyEquipmentState";

import {
  initialEngineeringMock,
  EQUIPMENT_GROUPS,
} from "../data/mockEngineeringData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId() {
  return `eq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getSiteContext(mock) {
  const site = mock?.sites?.find((s) => s.id === mock.currentSiteId);
  const building = site?.buildings?.[0];
  const floors = building?.floors || [];
  return { site, building, floors };
}

function getBreadcrumb(equipment, mock) {
  if (!equipment || !mock) return "";
  const { building } = getSiteContext(mock);
  const parts = [building?.name, equipment.name].filter(Boolean);
  return parts.join(" / ");
}

// ---------------------------------------------------------------------------
// EquipmentBuilderPage
// ---------------------------------------------------------------------------
export default function EquipmentBuilderPage() {
  const [mock, setMock] = useState(() => ({ ...initialEngineeringMock }));
  const [expandedGroups, setExpandedGroups] = useState(new Set(EQUIPMENT_GROUPS.map((g) => g.id)));
  const [selectedId, setSelectedId] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);

  const { site, building, floors } = useMemo(() => getSiteContext(mock), [mock]);
  const selectedEquipment = mock.equipment.find((e) => e.id === selectedId);
  const breadcrumb = getBreadcrumb(selectedEquipment, mock);

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleSaveEquipment = useCallback((id, form) => {
    setMock((prev) => ({
      ...prev,
      equipment: prev.equipment.map((e) =>
        e.id === id
          ? {
              ...e,
              name: form.name,
              displayLabel: form.displayLabel,
              type: form.equipmentType || e.type,
              controllerRef: form.controllerRef || null,
              templateName: form.templateName || null,
              floorId: form.floorId || e.floorId,
              locationLabel: form.locationLabel || e.locationLabel,
              notes: form.notes || "",
            }
          : e
      ),
    }));
  }, []);

  const handleDeleteEquipment = useCallback((id) => {
    setMock((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((e) => e.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const typeToGroupId = useCallback((type) => {
    const map = { AHU: "ahus", VAV: "vavs", FCU: "fcus", CH: "chiller-plant", CHWP: "pumps", EF: "exhaust-fans" };
    return map[type] || "ahus";
  }, []);

  const buildingId = building?.id;

  const handleAddEquipment = useCallback((data) => {
    const id = generateId();
    const floorId = data.floorId || floors[0]?.id;
    const eqType = data.equipmentType || data.type || "CUSTOM";
    const newEq = {
      id,
      siteId: mock.currentSiteId,
      buildingId: data.buildingId || buildingId,
      floorId,
      name: data.name,
      displayLabel: data.displayLabel || data.name,
      type: eqType,
      controllerRef: data.controllerRef || null,
      protocol: "BACnet/IP",
      deviceInstance: null,
      templateName: data.templateName || null,
      pointsDefined: 0,
      status: "DRAFT",
      locationLabel: floors.find((f) => f.id === floorId)?.name || "",
      notes: data.notes || "",
      equipmentGroup: data.equipmentGroup || typeToGroupId(eqType),
    };
    setMock((prev) => ({
      ...prev,
      equipment: [...prev.equipment, newEq],
    }));
    setSelectedId(id);
    setShowAddEquipment(false);
  }, [mock.currentSiteId, buildingId, floors, typeToGroupId]);

  const handleAddEquipmentGroup = useCallback((data) => {
    // UI-only for now - groups are type-driven from EQUIPMENT_GROUPS
    console.log("Add equipment group:", data);
    setShowAddGroup(false);
  }, []);

  const handleSaveDraft = useCallback(() => {
    console.log("Save draft:", mock);
  }, [mock]);

  const hasEquipment = mock.equipment.length > 0;
  const hasSite = !!site && !!building;

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        {/* Page header */}
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">Equipment Builder</h5>
          <div className="text-white-50 small">
            Define and organize equipment for the selected site before controller and point mapping.
          </div>
        </div>

        {/* Empty state when no site */}
        {!hasSite ? (
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="text-center py-5 text-white-50">
              <div className="small">Create a site in Site Builder first, then add equipment here.</div>
            </Card.Body>
          </Card>
        ) : !hasEquipment ? (
          <EmptyEquipmentState onAddEquipment={() => setShowAddEquipment(true)} />
        ) : (
          <>
            {/* Toolbar - same layout as Site Builder */}
            <div className="site-builder-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--primary"
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>
              </div>
              <div className="site-builder-toolbar-divider" />
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => setShowAddGroup(true)}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Equipment Group
                </Button>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--primary"
                  onClick={() => setShowAddEquipment(true)}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Equipment
                </Button>
              </div>
              <div className="site-builder-toolbar-divider" />
              <Dropdown>
                <Dropdown.Toggle
                  size="sm"
                  variant="dark"
                  className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
                >
                  Actions <FontAwesomeIcon icon={faEllipsisV} className="ms-1" />
                </Dropdown.Toggle>
                <Dropdown.Menu
                  align="end"
                  className="legion-dropdown-menu bg-dark border border-light border-opacity-10"
                >
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileImport} className="me-2" /> Import Equipment
                  </Dropdown.Item>
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileExport} className="me-2" /> Export Equipment
                  </Dropdown.Item>
                  <Dropdown.Divider className="border-light border-opacity-10" />
                  <Dropdown.Item className="text-danger">
                    <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete All Equipment
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span className="text-white-50 small ms-1">Select equipment to edit.</span>
            </div>

            {/* Two-panel layout - same as Site Builder */}
            <Row className="g-3">
              <Col xs={12} lg={5} xl={4}>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                  <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between">
                    <span className="text-white fw-bold">
                      <FontAwesomeIcon icon={faSitemap} className="me-2" />
                      Equipment Workspace
                    </span>
                  </Card.Header>
                  <Card.Body className="p-0 overflow-auto" style={{ minHeight: 320 }}>
                    <EquipmentWorkspace
                      site={site}
                      building={building}
                      equipment={mock.equipment}
                      expandedGroups={expandedGroups}
                      selectedId={selectedId}
                      filterQuery={filterQuery}
                      onFilterChange={setFilterQuery}
                      onToggleGroup={toggleGroup}
                      onSelectEquipment={(eq) => setSelectedId(eq?.id)}
                    />
                  </Card.Body>
                </Card>
              </Col>

              <Col xs={12} lg={7} xl={8}>
                <EquipmentEditorPanel
                  equipment={selectedEquipment}
                  breadcrumb={breadcrumb}
                  floors={floors}
                  onSave={handleSaveEquipment}
                  onDelete={handleDeleteEquipment}
                />
              </Col>
            </Row>
          </>
        )}
      </div>

      <AddEquipmentModal
        show={showAddEquipment}
        onHide={() => setShowAddEquipment(false)}
        onCreate={handleAddEquipment}
        siteStructure={{ buildings: site?.buildings || [] }}
        defaultBuildingId={building?.id}
      />

      <AddEquipmentGroupModal
        show={showAddGroup}
        onHide={() => setShowAddGroup(false)}
        onCreate={handleAddEquipmentGroup}
      />
    </Container>
  );
}
