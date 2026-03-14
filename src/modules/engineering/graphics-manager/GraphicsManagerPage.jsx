import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Container, Row, Col, Card, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import {
  useEngineeringDraft,
  useActiveDeployment,
  selectSiteTree,
} from "../../../hooks/useEngineeringDraft";
import { findNodeById } from "../site-builder/utils/siteTreeUtils";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { engineeringRepository } from "../../../lib/data";
import GraphicsContextCard from "./components/GraphicsContextCard";
import GraphicsToolbar from "./components/GraphicsToolbar";
import GraphicsExplorer from "./components/GraphicsExplorer";
import GraphicsCanvas from "./components/GraphicsCanvas";
import GraphicsInspector from "./components/GraphicsInspector";

// ---------------------------------------------------------------------------
// File import helpers
// ---------------------------------------------------------------------------
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function collectIds(node, acc = new Set()) {
  if (!node) return acc;
  if (node.id) acc.add(node.id);
  (node.children || []).forEach((c) => collectIds(c, acc));
  return acc;
}

/** Flatten site tree to list of nodes (site, building, floor) for link targets */
function flattenLayoutNodes(node, acc = []) {
  if (!node) return acc;
  if (node.type === "site" || node.type === "building" || node.type === "floor") {
    acc.push({ id: node.id, name: node.name || node.id, type: node.type });
  }
  (node.children || []).forEach((c) => flattenLayoutNodes(c, acc));
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
  const draftSiteLayoutGraphics = draft?.siteLayoutGraphics ?? {};
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const handleFilterChange = useCallback((v) => setFilterValue(v), []);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const importImageInputRef = useRef(null);
  const importSvgInputRef = useRef(null);

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

  const selectedLayoutNode = useMemo(
    () => (siteTree && selectedLayoutNodeId ? findNodeById(siteTree, selectedLayoutNodeId) : null),
    [siteTree, selectedLayoutNodeId]
  );

  const availablePoints = useMemo(
    () =>
      engineeringRepository.getPointDisplayInfoForEquipment(selectedEquipment, draft?.templates),
    [selectedEquipment, draft?.templates]
  );

  // When a layout node (site/building/floor) is selected, use its layout graphic; otherwise equipment graphic.
  const selectedGraphic = useMemo(() => {
    if (selectedLayoutNodeId) {
      const base = draftSiteLayoutGraphics[selectedLayoutNodeId] ?? null;
      if (base) return { ...base, objects: base.objects ?? [], backgroundImage: base.backgroundImage };
      return {
        id: `layout-${selectedLayoutNodeId}`,
        nodeId: selectedLayoutNodeId,
        name: "Site Layout Graphic",
        status: "DRAFT",
        lastEdited: "Now",
        objects: [],
      };
    }
    const base = draftGraphics[selectedEquipmentId] ?? null;
    if (base) return { ...base, objects: base.objects ?? [], backgroundImage: base.backgroundImage };
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
  }, [selectedEquipmentId, selectedLayoutNodeId, draftGraphics, draftSiteLayoutGraphics]);

  const linkTargets = useMemo(() => {
    const layoutNodes = siteTree ? flattenLayoutNodes(siteTree) : [];
    const equipment = (equipmentList || []).map((e) => ({
      id: e.id,
      name: e.displayLabel || e.name || e.id,
      type: "equipment",
    }));
    return { layoutNodes, equipment };
  }, [siteTree, equipmentList]);

  // Stabilize effect: siteTree is a new object every render, so don't depend on it directly.
  // Only run when site or presence of tree changes (draft?.site?.id).
  const siteTreeKey = draft?.site?.id ?? "";
  useEffect(() => {
    if (hasNoSite) {
      setExpandedIds(new Set());
      setSelectedEquipmentId(null);
      setSelectedLayoutNodeId(null);
      setSelectedObject(null);
      return;
    }
    if (siteTree) {
      const ids = collectIds(siteTree);
      setExpandedIds(ids);
      setSelectedEquipmentId(null);
      setSelectedLayoutNodeId(null);
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
    setSelectedLayoutNodeId(null);
    setSelectedObject(null);
  }, []);

  const handleSelectEquipmentById = useCallback((id) => {
    setSelectedEquipmentId(id || null);
    setSelectedLayoutNodeId(null);
    setSelectedObject(null);
  }, []);

  const handleSelectLayoutNode = useCallback((node) => {
    if (!node || node.type === "site" || node.type === "building" || node.type === "floor") {
      setSelectedLayoutNodeId(node?.id ?? null);
      setSelectedEquipmentId(null);
      setSelectedObject(null);
    }
  }, []);

  const handleSelectObject = useCallback((obj) => {
    setSelectedObject(obj);
  }, []);

  const handleUpdateObject = useCallback(
    (objectId, updates) => {
      if (selectedLayoutNodeId) {
        const current = draftSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = (current.objects || []).map((o) =>
          o.id === objectId ? { ...o, ...updates } : o
        );
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects });
        setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
        return;
      }
      if (!selectedEquipmentId) return;
      const current = draftGraphics[selectedEquipmentId] || { objects: [] };
      const objects = (current.objects || []).map((o) =>
        o.id === objectId ? { ...o, ...updates } : o
      );
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
      setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
    },
    [selectedEquipmentId, selectedLayoutNodeId, draftGraphics, draftSiteLayoutGraphics, actions]
  );

  const generateObjectId = useCallback(() => {
    return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  const handleAddText = useCallback(() => {
    if (selectedLayoutNodeId) {
      const current = draftSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
      actions.setGraphicForSiteLayout(selectedLayoutNodeId, {
        ...current,
        objects: [...existingObjects, newObj],
      });
      setSelectedObject(newObj);
      return;
    }
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
  }, [selectedEquipmentId, selectedLayoutNodeId, draftGraphics, draftSiteLayoutGraphics, actions, generateObjectId]);

  const handleAddValue = useCallback(() => {
    if (selectedLayoutNodeId) {
      const current = draftSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
      actions.setGraphicForSiteLayout(selectedLayoutNodeId, {
        ...current,
        objects: [...existingObjects, newObj],
      });
      setSelectedObject(newObj);
      return;
    }
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
  }, [selectedEquipmentId, selectedLayoutNodeId, draftGraphics, draftSiteLayoutGraphics, actions, generateObjectId]);

  const handleAddLink = useCallback(() => {
    const newObj = {
      id: generateObjectId(),
      type: "link",
      label: "Link",
      x: 100,
      y: 100,
      width: 80,
      height: 28,
      linkTarget: { type: "", id: "" },
    };
    if (selectedLayoutNodeId) {
      const current = draftSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
      const existingObjects = current.objects || [];
      const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
      newObj.y = Math.max(80, maxY + 20);
      actions.setGraphicForSiteLayout(selectedLayoutNodeId, {
        ...current,
        objects: [...existingObjects, newObj],
      });
      setSelectedObject(newObj);
      return;
    }
    if (!selectedEquipmentId) return;
    const current = draftGraphics[selectedEquipmentId] || { objects: [] };
    const existingObjects = current.objects || [];
    const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
    newObj.y = Math.max(80, maxY + 20);
    actions.setGraphicForEquipment(selectedEquipmentId, {
      ...current,
      objects: [...existingObjects, newObj],
    });
    setSelectedObject(newObj);
  }, [selectedEquipmentId, selectedLayoutNodeId, draftGraphics, draftSiteLayoutGraphics, actions, generateObjectId]);

  const handleDeleteObject = useCallback(
    (objectId) => {
      if (selectedLayoutNodeId) {
        const current = draftSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = (current.objects || []).filter((o) => o.id !== objectId);
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects });
        if (selectedObject?.id === objectId) setSelectedObject(null);
        return;
      }
      if (!selectedEquipmentId || !objectId) return;
      const current = draftGraphics[selectedEquipmentId] || { objects: [] };
      const objects = (current.objects || []).filter((o) => o.id !== objectId);
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
      if (selectedObject?.id === objectId) setSelectedObject(null);
    },
    [selectedEquipmentId, selectedLayoutNodeId, selectedObject?.id, draftGraphics, draftSiteLayoutGraphics, actions]
  );

  const handleSaveGraphic = useCallback(() => {
    if (!selectedGraphic) return;
    if (selectedLayoutNodeId) {
      actions.setGraphicForSiteLayout(selectedLayoutNodeId, selectedGraphic);
    } else if (selectedEquipmentId) {
      actions.setGraphicForEquipment(selectedEquipmentId, selectedGraphic);
    } else return;
    setShowSaveToast(true);
    if (typeof window !== "undefined" && window.setTimeout) {
      window.setTimeout(() => setShowSaveToast(false), 4000);
    }
  }, [selectedEquipmentId, selectedLayoutNodeId, selectedGraphic, actions]);

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

  const setGraphicBackgroundImage = useCallback(
    (backgroundImage) => {
      if (!selectedGraphic) return;
      const updated = { ...selectedGraphic, backgroundImage };
      if (selectedLayoutNodeId) {
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, updated);
      } else if (selectedEquipmentId) {
        actions.setGraphicForEquipment(selectedEquipmentId, updated);
      }
    },
    [selectedGraphic, selectedLayoutNodeId, selectedEquipmentId, actions]
  );

  const handleBackgroundPositionChange = useCallback(
    (dx, dy) => {
      const bg = selectedGraphic?.backgroundImage;
      if (!bg?.dataUrl) return;
      const x = (bg.x ?? 0) + dx;
      const y = (bg.y ?? 0) + dy;
      setGraphicBackgroundImage({ ...bg, x, y });
    },
    [selectedGraphic?.backgroundImage, setGraphicBackgroundImage]
  );

  const handleImportSvg = useCallback(() => {
    if (!selectedGraphic) return;
    const el = importSvgInputRef.current;
    if (el) {
      el.accept = ".svg,image/svg+xml";
      el.value = "";
      el.onchange = async (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await readFileAsDataUrl(file);
          setGraphicBackgroundImage({ type: "svg", dataUrl });
        } catch (err) {
          console.error("Failed to read SVG", err);
        }
        el.onchange = null;
      };
      el.click();
    }
  }, [selectedGraphic, setGraphicBackgroundImage]);

  const handleImportImage = useCallback(() => {
    if (!selectedGraphic) return;
    const el = importImageInputRef.current;
    if (el) {
      el.accept = "image/*";
      el.value = "";
      el.onchange = async (e) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await readFileAsDataUrl(file);
          setGraphicBackgroundImage({ type: "image", dataUrl });
        } catch (err) {
          console.error("Failed to read image", err);
        }
        el.onchange = null;
      };
      el.click();
    }
  }, [selectedGraphic, setGraphicBackgroundImage]);

  const handleNewGraphic = useCallback(() => {
    console.log("New Graphic");
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
      <input
        ref={importSvgInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="d-none"
        aria-hidden
      />
      <input
        ref={importImageInputRef}
        type="file"
        accept="image/*"
        className="d-none"
        aria-hidden
      />
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
              {selectedLayoutNodeId
                ? `Site layout graphic saved for ${selectedLayoutNode?.name ?? "this level"}.`
                : `Graphic saved and bound to ${selectedEquipment?.displayLabel || selectedEquipment?.name || "this equipment"}.`}
            </div>
            <div className="text-white-50 small mt-1">
              {selectedLayoutNodeId ? "Deploy to Live to see it in Operator → Site Layout." : "Deploy to Live to see it on the Equipment Detail page."}
            </div>
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
          hasSelection={!!selectedEquipmentId || !!selectedLayoutNodeId}
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
                  selectedId={selectedLayoutNodeId}
                  selectedEquipmentId={selectedEquipmentId}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelectLayoutNode}
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
              onAddLink={handleAddLink}
              onBackgroundPositionChange={handleBackgroundPositionChange}
              onDeleteObject={handleDeleteObject}
              availablePoints={selectedLayoutNodeId ? [] : availablePoints}
              previewMode={false}
              emptyMessage={
                selectedLayoutNodeId
                  ? `Create a site layout graphic for ${selectedLayoutNode?.name ?? "this level"}. Deploy to see it in Operator → Site Layout.`
                  : "Select a site, building, or floor from the tree to create layout graphics, or select equipment to create equipment graphics."
              }
            />
          </Col>

          <Col xs={12} lg={3} xl={3} className="align-self-start site-builder-editor-col">
            <GraphicsInspector
              selectedObject={selectedObject}
              availablePoints={availablePoints}
              equipmentName={selectedEquipment?.name}
              linkTargets={linkTargets}
              onUpdateObject={handleUpdateObject}
              onDeleteObject={handleDeleteObject}
            />
          </Col>
        </Row>
      </div>
    </Container>
  );
}
