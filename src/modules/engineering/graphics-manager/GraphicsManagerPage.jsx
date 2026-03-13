import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Container, Row, Col, Card, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useEngineeringDraft, useActiveDeployment, selectSiteTree } from "../../../hooks/useEngineeringDraft";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { engineeringRepository } from "../../../lib/data";
import GraphicsContextCard from "./components/GraphicsContextCard";
import GraphicsToolbar from "./components/GraphicsToolbar";
import GraphicsExplorer from "./components/GraphicsExplorer";
import GraphicsCanvas from "./components/GraphicsCanvas";
import GraphicsInspector from "./components/GraphicsInspector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function collectIds(node, acc = new Set()) {
  if (!node) return acc;
  if (node.id) acc.add(node.id);
  (node.children || []).forEach((c) => collectIds(c, acc));
  return acc;
}

// ---------------------------------------------------------------------------
// GraphicsManagerPage
// ---------------------------------------------------------------------------
export default function GraphicsManagerPage() {
  const { site } = useSite();
  const { draft, actions } = useEngineeringDraft();
  const activeDeployment = useActiveDeployment();
  const siteTree = selectSiteTree(draft);
  const draftEquipment = draft?.equipment ?? [];
  const draftGraphics = draft?.graphics ?? {};
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const handleFilterChange = useCallback((v) => setFilterValue(v), []);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const isNewBuilding = engineeringRepository.isNewEngineeringBuildingFlow(site);
  const hasNoSite = isNewBuilding && !draft?.site;

  const equipmentList = useMemo(() => {
    return engineeringRepository.enrichEquipmentForEngineeringPointMapping(
      draftEquipment,
      siteTree,
      site
    );
  }, [draftEquipment, siteTree, site]);

  const selectedEquipment = useMemo(
    () => equipmentList.find((e) => e.id === selectedEquipmentId) || null,
    [equipmentList, selectedEquipmentId]
  );

  const availablePoints = useMemo(
    () =>
      engineeringRepository.getPointDisplayInfoForEquipment(selectedEquipment, draft?.templates),
    [selectedEquipment, draft?.templates]
  );

  // When equipment is selected but no graphic exists yet, use an empty graphic so the canvas is editable (Add Text, Add Value).
  const selectedGraphic = useMemo(() => {
    const base = draftGraphics[selectedEquipmentId] ?? null;
    if (base) return { ...base, objects: base.objects ?? [] };
    if (selectedEquipmentId)
      return {
        id: `g-new-${selectedEquipmentId}`,
        equipmentId: selectedEquipmentId,
        name: "New Graphic",
        status: "DRAFT",
        lastEdited: "Now",
        objects: [],
      };
    return null;
  }, [selectedEquipmentId, draftGraphics]);

  // Stabilize effect: siteTree is a new object every render, so don't depend on it directly.
  // Only run when site or presence of tree changes (draft?.site?.id).
  const siteTreeKey = draft?.site?.id ?? "";
  useEffect(() => {
    if (hasNoSite) {
      setExpandedIds(new Set());
      setSelectedEquipmentId(null);
      setSelectedObject(null);
      return;
    }
    if (siteTree) {
      const ids = collectIds(siteTree);
      setExpandedIds(ids);
      setSelectedEquipmentId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, hasNoSite, siteTreeKey]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectEquipment = useCallback((equipment) => {
    setSelectedEquipmentId(equipment?.id ?? null);
    setSelectedObject(null);
  }, []);

  const handleSelectEquipmentById = useCallback((id) => {
    setSelectedEquipmentId(id || null);
    setSelectedObject(null);
  }, []);

  const handleSelectObject = useCallback((obj) => {
    setSelectedObject(obj);
  }, []);

  const handleUpdateObject = useCallback(
    (objectId, updates) => {
      if (!selectedEquipmentId) return;
      const current = draftGraphics[selectedEquipmentId] || { objects: [] };
      const objects = (current.objects || []).map((o) =>
        o.id === objectId ? { ...o, ...updates } : o
      );
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
      setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
    },
    [selectedEquipmentId, draftGraphics, actions]
  );

  const generateObjectId = useCallback(() => {
    return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  const handleAddText = useCallback(() => {
    if (!selectedEquipmentId) return;
    const current = draftGraphics[selectedEquipmentId] || { objects: [] };
    const existingObjects = current.objects || [];
    const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
    const newObj = {
      id: generateObjectId(),
      type: "text",
      label: "Text",
      x: 100,
      y: Math.max(80, maxY + 20),
      width: 60,
      height: 24,
    };
    actions.setGraphicForEquipment(selectedEquipmentId, {
      ...current,
      objects: [...existingObjects, newObj],
    });
    setSelectedObject(newObj);
  }, [selectedEquipmentId, draftGraphics, actions, generateObjectId]);

  const handleAddValue = useCallback(() => {
    if (!selectedEquipmentId) return;
    const current = draftGraphics[selectedEquipmentId] || { objects: [] };
    const existingObjects = current.objects || [];
    const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
    const newObj = {
      id: generateObjectId(),
      type: "value",
      label: "Point",
      x: 100,
      y: Math.max(80, maxY + 20),
      width: 80,
      height: 24,
      bindings: [],
    };
    actions.setGraphicForEquipment(selectedEquipmentId, {
      ...current,
      objects: [...existingObjects, newObj],
    });
    setSelectedObject(newObj);
  }, [selectedEquipmentId, draftGraphics, actions, generateObjectId]);

  const handleDeleteObject = useCallback(
    (objectId) => {
      if (!selectedEquipmentId || !objectId) return;
      const current = draftGraphics[selectedEquipmentId] || { objects: [] };
      const objects = (current.objects || []).filter((o) => o.id !== objectId);
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
      if (selectedObject?.id === objectId) {
        setSelectedObject(null);
      }
    },
    [selectedEquipmentId, selectedObject?.id, draftGraphics, actions]
  );

  const handleSaveGraphic = useCallback(() => {
    if (!selectedEquipmentId || !selectedGraphic) return;
    actions.setGraphicForEquipment(selectedEquipmentId, selectedGraphic);
    setShowSaveToast(true);
    if (typeof window !== "undefined" && window.setTimeout) {
      window.setTimeout(() => setShowSaveToast(false), 4000);
    }
  }, [selectedEquipmentId, selectedGraphic, actions]);

  const handleValidate = useCallback(() => {
    const graphic = selectedGraphic;
    const issues = [];
    (graphic?.objects || []).forEach((obj) => {
      const bindings = obj.bindings || [];
      bindings.forEach((b) => {
        if (!b.pointId) issues.push(`${obj.label || "Object"}: missing template point reference`);
      });
    });
    setValidationResult({
      valid: issues.length === 0,
      issues,
      note: "Graphics authoring is allowed with equipment + template only. Deployment may warn if required template points are still unmapped.",
    });
    setShowValidationToast(true);
  }, [selectedGraphic]);

  const handleNewGraphic = useCallback(() => {
    console.log("New Graphic");
  }, []);
  const handleImportSvg = useCallback(() => {
    console.log("Import SVG");
  }, []);
  const handleImportImage = useCallback(() => {
    console.log("Import Image");
  }, []);
  const handleDuplicate = useCallback(() => {
    console.log("Duplicate");
  }, []);
  const handleDelete = useCallback(() => {
    console.log("Delete");
  }, []);
  const handlePreview = useCallback(() => {
    console.log("Preview");
  }, []);

  if (hasNoSite) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faObjectGroup} className="me-2" />
              Graphics Manager
            </h5>
            <div className="text-white-50 small">
              Create and manage graphical floorplans, equipment diagrams, and system visualizations.
            </div>
          </div>
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="py-5 text-center text-white-50">
              Select a site to get started.
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faObjectGroup} className="me-2" />
              Graphics Manager
            </h5>
            <div className="text-white-50 small">
              Create and manage graphical floorplans, equipment diagrams, and system visualizations.
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-white-50 small">Site:</span>
            <span className="text-white fw-semibold">{draft?.site?.name || site || "—"}</span>
            {activeDeployment ? (
              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">
                Deployed {activeDeployment.version}
              </span>
            ) : (
              <span className="badge bg-secondary bg-opacity-50 text-white-50 border border-secondary">
                Draft
              </span>
            )}
          </div>
        </div>

        <GraphicsContextCard
          equipment={selectedEquipment}
          equipmentList={equipmentList}
          onSelectEquipment={handleSelectEquipmentById}
        />

        {showValidationToast && validationResult && (
          <div
            className={`mb-3 p-3 rounded border ${
              validationResult.valid
                ? "border-success border-opacity-50 bg-success bg-opacity-10"
                : "border-warning border-opacity-50 bg-warning bg-opacity-10"
            }`}
          >
            {validationResult.valid ? (
              <div className="text-success small fw-semibold">Graphics validation passed.</div>
            ) : (
              <div>
                <div className="text-warning small fw-semibold mb-2">Validation issues:</div>
                <ul className="mb-0 ps-3 text-white-50 small">
                  {validationResult.issues.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
            {validationResult.note && (
              <div className="text-white-50 small mt-2">{validationResult.note}</div>
            )}
            <Button
              size="sm"
              variant="link"
              className="text-white-50 p-0 mt-2"
              onClick={() => setShowValidationToast(false)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {showSaveToast && (
          <div className="mb-3 p-3 rounded border border-success border-opacity-50 bg-success bg-opacity-10">
            <div className="text-success small fw-semibold">
              Graphic saved and bound to {selectedEquipment?.displayLabel || selectedEquipment?.name || "this equipment"}.
            </div>
            <div className="text-white-50 small mt-1">Deploy to Live to see it on the Equipment Detail page.</div>
            <Button size="sm" variant="link" className="text-white-50 p-0 mt-2" onClick={() => setShowSaveToast(false)}>Dismiss</Button>
          </div>
        )}

        <GraphicsToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filterValue={filterValue}
          onFilterChange={handleFilterChange}
          onSaveGraphic={handleSaveGraphic}
          onNewGraphic={handleNewGraphic}
          onImportSvg={handleImportSvg}
          onImportImage={handleImportImage}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onPreview={handlePreview}
          onValidate={handleValidate}
          hasSelection={!!selectedEquipmentId}
        />

        <Row className="g-3 align-items-start">
          <Col xs={12} lg={3} xl={2}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between">
                <span className="text-white fw-bold">
                  <FontAwesomeIcon icon={faObjectGroup} className="me-2" />
                  Site & Equipment
                </span>
              </Card.Header>
              <Card.Body className="p-0 overflow-auto" style={{ minHeight: 320 }}>
                <GraphicsExplorer
                  siteTree={siteTree}
                  expandedIds={expandedIds}
                  selectedId={null}
                  selectedEquipmentId={selectedEquipmentId}
                  onToggleExpand={toggleExpand}
                  onSelect={() => {}}
                  onSelectEquipment={handleSelectEquipment}
                />
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={6} xl={7}>
            <GraphicsCanvas
              graphic={selectedGraphic}
              selectedObjectId={selectedObject?.id}
              onSelectObject={handleSelectObject}
              onUpdateObject={handleUpdateObject}
              onAddText={handleAddText}
              onAddValue={handleAddValue}
              onDeleteObject={handleDeleteObject}
              availablePoints={availablePoints}
              previewMode={false}
              emptyMessage="Select equipment from the tree or dropdown to create or edit graphics."
            />
          </Col>

          <Col xs={12} lg={3} xl={3} className="align-self-start site-builder-editor-col">
            <GraphicsInspector
              selectedObject={selectedObject}
              availablePoints={availablePoints}
              equipmentName={selectedEquipment?.name}
              onUpdateObject={handleUpdateObject}
              onDeleteObject={handleDeleteObject}
            />
          </Col>
        </Row>
      </div>
    </Container>
  );
}
