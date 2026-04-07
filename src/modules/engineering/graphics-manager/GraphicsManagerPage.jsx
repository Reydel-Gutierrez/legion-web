import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { Container, Card, Button, Modal } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup } from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../../routes";
import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion, useActiveDeployment, selectSiteTree } from "../../../hooks/useWorkingVersion";
import { findNodeById } from "../site-builder/utils/siteTreeUtils";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { engineeringRepository, USE_HIERARCHY_API } from "../../../lib/data";
import { createGraphicTemplate } from "../working-version/workingVersionModel";
import {
  cloneGraphicEditorState,
  countBoundTemplatePointBindings,
  generateGraphicTemplateId,
} from "./graphicTemplateUtils";
import GraphicsToolbar from "./components/GraphicsToolbar";
import SaveGraphicTemplateModal from "./components/SaveGraphicTemplateModal";
import GraphicsExplorer from "./components/GraphicsExplorer";
import GraphicsCanvas from "./components/GraphicsCanvas";
import GraphicsInspector from "./components/GraphicsInspector";
import {
  EQUIPMENT_GRAPHIC_CANVAS_DEFAULT,
  LAYOUT_GRAPHIC_CANVAS_DEFAULT,
  LAYOUT_BACKGROUND_IMPORT_MAX,
} from "../../../lib/graphics/graphicsConstants";
import ZoneConfigurationModal from "./components/ZoneConfigurationModal";
import {
  createDefaultZoneConfig,
  mergeZoneConfig,
  createDefaultStateColors,
  applyTemperatureSimpleVisualPreset,
  isZoneShape,
} from "./floorZoneModel";

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

/**
 * Downscale large raster images before converting to base64.
 * @param {{ preferJpegForLocalStorage?: boolean, jpegQuality?: number }} [encodeOpts]
 *        For site/building/floor layout backgrounds, prefer JPEG so localStorage stays under quota.
 */
function downscaleImageFileToDataUrl(file, maxCanvasW, maxCanvasH, encodeOpts = {}) {
  const { preferJpegForLocalStorage = false, jpegQuality = 0.82 } = encodeOpts;
  return new Promise((resolve, reject) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const iw = img.naturalWidth || img.width || 1;
          const ih = img.naturalHeight || img.height || 1;
          const scale = Math.min(maxCanvasW / iw, maxCanvasH / ih, 1);
          const w = Math.max(1, Math.round(iw * scale));
          const h = Math.max(1, Math.round(ih * scale));

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("2D canvas context unavailable");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const isJpeg =
            (file.type || "").toLowerCase().includes("jpeg") || (file.type || "").toLowerCase().includes("jpg");
          const useJpeg = preferJpegForLocalStorage || isJpeg;
          const dataUrl = canvas.toDataURL(useJpeg ? "image/jpeg" : "image/png", useJpeg ? jpegQuality : undefined);

          URL.revokeObjectURL(objectUrl);
          resolve({ dataUrl, width: w, height: h });
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e instanceof Error ? e : new Error("Image load failed"));
      };
      img.src = objectUrl;
    } catch (err) {
      reject(err);
    }
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
  const location = useLocation();
  const history = useHistory();
  const { site } = useSite();
  const { workingVersion, workingState, actions } = useWorkingVersion();
  const { deployment } = useActiveDeployment();
  const activeReleaseData = deployment;
  const siteTree = selectSiteTree(workingVersion);
  const workingEquipment = workingState?.equipment ?? [];
  const workingGraphics = workingState?.graphics ?? {};
  const workingSiteLayoutGraphics = workingState?.siteLayoutGraphics ?? {};
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [selectedLayoutNodeId, setSelectedLayoutNodeId] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [filterValue, setFilterValue] = useState("all");
  const [workingGraphic, setWorkingGraphic] = useState(() => ({
    id: "working-graphic",
    name: "Unassigned Graphic",
    status: "WORKING",
    lastEdited: "Now",
    objects: [],
    canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
  }));
  const [isFullscreen] = useState(true); // fullscreen is now the only mode
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPendingLayoutNodeId, setAssignPendingLayoutNodeId] = useState(null);
  const [assignPendingEquipmentId, setAssignPendingEquipmentId] = useState(null);
  const handleFilterChange = useCallback((v) => setFilterValue(v), []);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [editingGraphicTemplateId, setEditingGraphicTemplateId] = useState(null);
  /** Authoring a new library graphic from Template Library (URL: newGraphicTemplate=1 & equipmentTemplateId=). */
  const [graphicAuthoringEquipmentTemplateId, setGraphicAuthoringEquipmentTemplateId] = useState(null);
  const [globalLibraryToast, setGlobalLibraryToast] = useState(null);
  const [publishingGraphicToGlobal, setPublishingGraphicToGlobal] = useState(false);
  const [liveZonePreview, setLiveZonePreview] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneModalInitialTab, setZoneModalInitialTab] = useState("general");
  const importImageInputRef = useRef(null);
  const importSvgInputRef = useRef(null);

  const isNewBuilding = engineeringRepository.isNewEngineeringBuildingFlow(site);
  const hasNoSite = isNewBuilding && !workingState?.site;

  const equipmentList = useMemo(() => {
    return engineeringRepository.enrichEquipmentForEngineeringPointMapping(
      workingEquipment,
      siteTree,
      site
    );
  }, [workingEquipment, siteTree, site]);

  const selectedEquipment = useMemo(
    () => equipmentList.find((e) => e.id === selectedEquipmentId) || null,
    [equipmentList, selectedEquipmentId]
  );

  const selectedLayoutNode = useMemo(
    () => (siteTree && selectedLayoutNodeId ? findNodeById(siteTree, selectedLayoutNodeId) : null),
    [siteTree, selectedLayoutNodeId]
  );

  const equipmentTemplateForGraphicAuthoring = useMemo(() => {
    const eqTemplates = workingState.templates?.equipmentTemplates || [];
    if (editingGraphicTemplateId) {
      const gt = (workingState.templates?.graphicTemplates || []).find((g) => g.id === editingGraphicTemplateId);
      if (gt?.equipmentTemplateId) {
        return eqTemplates.find((e) => e.id === gt.equipmentTemplateId) || null;
      }
    }
    if (graphicAuthoringEquipmentTemplateId) {
      return eqTemplates.find((e) => e.id === graphicAuthoringEquipmentTemplateId) || null;
    }
    return null;
  }, [
    workingState.templates?.graphicTemplates,
    workingState.templates?.equipmentTemplates,
    editingGraphicTemplateId,
    graphicAuthoringEquipmentTemplateId,
  ]);

  const availablePoints = useMemo(() => {
    if (selectedEquipment) {
      return engineeringRepository.getPointDisplayInfoForEquipment(selectedEquipment, workingState?.templates);
    }
    if (equipmentTemplateForGraphicAuthoring) {
      return engineeringRepository.getPointDisplayInfoForEquipmentTemplate(equipmentTemplateForGraphicAuthoring);
    }
    return [];
  }, [selectedEquipment, workingState?.templates, equipmentTemplateForGraphicAuthoring]);

  const equipmentTemplateMatchingSelection = useMemo(() => {
    if (!selectedEquipment?.templateName) return null;
    return (workingState.templates?.equipmentTemplates || []).find(
      (t) => (t.name || "").toLowerCase() === (selectedEquipment.templateName || "").toLowerCase()
    );
  }, [selectedEquipment, workingState.templates?.equipmentTemplates]);

  const templateBeingEdited = useMemo(() => {
    if (!editingGraphicTemplateId) return null;
    return (workingState.templates?.graphicTemplates || []).find((g) => g.id === editingGraphicTemplateId) ?? null;
  }, [workingState.templates?.graphicTemplates, editingGraphicTemplateId]);

  // When a layout node (site/building/floor) is selected, use its layout graphic; otherwise equipment graphic.
  const selectedGraphic = useMemo(() => {
    if (selectedLayoutNodeId) {
      const base = workingSiteLayoutGraphics[selectedLayoutNodeId] ?? null;
      if (base)
        return {
          ...base,
          objects: base.objects ?? [],
          backgroundImage: base.backgroundImage,
          canvasSize: base.canvasSize || LAYOUT_GRAPHIC_CANVAS_DEFAULT,
        };
      return {
        id: `layout-${selectedLayoutNodeId}`,
        nodeId: selectedLayoutNodeId,
        name: "Site Layout Graphic",
        status: "WORKING",
        lastEdited: "Now",
        objects: [],
        canvasSize: { ...LAYOUT_GRAPHIC_CANVAS_DEFAULT },
      };
    }
    const base = workingGraphics[selectedEquipmentId] ?? null;
    if (base)
      return {
        ...base,
        objects: base.objects ?? [],
        backgroundImage: base.backgroundImage,
        canvasSize: base.canvasSize || EQUIPMENT_GRAPHIC_CANVAS_DEFAULT,
      };
    if (selectedEquipmentId)
      return {
        id: `g-new-${selectedEquipmentId}`,
        equipmentId: selectedEquipmentId,
        name: "New Graphic",
        status: "WORKING",
        lastEdited: "Now",
        objects: [],
        canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
      };
    return workingGraphic;
  }, [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, workingGraphic]);

  const canvasWidth =
    selectedGraphic?.canvasSize?.width ??
    (selectedLayoutNodeId ? LAYOUT_GRAPHIC_CANVAS_DEFAULT.width : EQUIPMENT_GRAPHIC_CANVAS_DEFAULT.width);
  const canvasHeight =
    selectedGraphic?.canvasSize?.height ??
    (selectedLayoutNodeId ? LAYOUT_GRAPHIC_CANVAS_DEFAULT.height : EQUIPMENT_GRAPHIC_CANVAS_DEFAULT.height);

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
  // Only run when site or presence of tree changes (workingState?.site?.id).
  const siteTreeKey = workingState?.site?.id ?? "";
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

  // Deep-link: ?graphicTemplateId= | ?equipmentId= | ?newGraphicTemplate=1&equipmentTemplateId=
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const graphicTemplateIdFromUrl = params.get("graphicTemplateId");
    const equipmentIdFromUrl = params.get("equipmentId");
    const newGraphicTemplate = params.get("newGraphicTemplate");
    const equipmentTemplateIdFromUrl = params.get("equipmentTemplateId");

    if (graphicTemplateIdFromUrl) {
      setGraphicAuthoringEquipmentTemplateId(null);
      const gt = (workingState.templates?.graphicTemplates || []).find((g) => g.id === graphicTemplateIdFromUrl);
      if (gt) {
        setEditingGraphicTemplateId(gt.id);
        setSelectedEquipmentId(null);
        setSelectedLayoutNodeId(null);
        setSelectedObject(null);
        const editor = gt.graphicEditorState || {};
        setWorkingGraphic({
          id: `template-edit-${gt.id}`,
          name: gt.name || "Graphic Template",
          status: "WORKING",
          lastEdited: new Date().toISOString().slice(0, 10),
          objects: editor.objects ?? [],
          canvasSize: editor.canvasSize || { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
          backgroundImage: editor.backgroundImage,
        });
      } else {
        setEditingGraphicTemplateId(null);
      }
      return;
    }

    if (newGraphicTemplate === "1" && equipmentTemplateIdFromUrl) {
      const eqList = workingState.templates?.equipmentTemplates || [];
      const eq = eqList.find((e) => e.id === equipmentTemplateIdFromUrl);
      if (eq) {
        setEditingGraphicTemplateId(null);
        setGraphicAuthoringEquipmentTemplateId(equipmentTemplateIdFromUrl);
        setSelectedEquipmentId(null);
        setSelectedLayoutNodeId(null);
        setSelectedObject(null);
        setWorkingGraphic({
          id: "working-graphic",
          name: "New Graphic Template",
          status: "WORKING",
          lastEdited: new Date().toISOString().slice(0, 10),
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        });
        history.replace({ pathname: location.pathname, search: "" });
      }
      return;
    }

    setEditingGraphicTemplateId(null);

    if (equipmentIdFromUrl && workingEquipment.some((e) => e.id === equipmentIdFromUrl)) {
      setGraphicAuthoringEquipmentTemplateId(null);
      setSelectedEquipmentId(equipmentIdFromUrl);
      setSelectedLayoutNodeId(null);
      setSelectedObject(null);
    }
  }, [
    location.search,
    workingEquipment,
    workingState.templates?.graphicTemplates,
    workingState.templates?.equipmentTemplates,
    history,
    location.pathname,
  ]);

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
    setAssignPendingEquipmentId(id || null);
    setAssignPendingLayoutNodeId(null);
    setSelectedObject(null);
    setShowAssignModal(true);
  }, []);

  const handleSelectLayoutNode = useCallback((node) => {
    if (!node || node.type === "site" || node.type === "building" || node.type === "floor") {
      setSelectedLayoutNodeId(node?.id ?? null);
      setSelectedEquipmentId(null);
      setSelectedObject(null);
    }
  }, []);

  const handleSelectLayoutNodeById = useCallback(
    (id) => {
      if (!id || !siteTree) return;
      setAssignPendingLayoutNodeId(id);
      setAssignPendingEquipmentId(null);
      setSelectedObject(null);
      setShowAssignModal(true);
    },
    [siteTree]
  );

  const handleSelectObject = useCallback((obj) => {
    setSelectedObject(obj);
  }, []);

  const handleUpdateObject = useCallback(
    (objectId, updates) => {
      if (selectedLayoutNodeId) {
        const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = (current.objects || []).map((o) =>
          o.id === objectId ? { ...o, ...updates } : o
        );
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects });
        setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
        return;
      }
      if (!selectedEquipmentId) {
        // Unassigned working graphic (pre-bind)
        setWorkingGraphic((current) => {
          const base =
            current || {
              id: "working-graphic",
              name: "Unassigned Graphic",
              status: "WORKING",
              lastEdited: "Now",
              objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
            };
          const objects = (base.objects || []).map((o) => (o.id === objectId ? { ...o, ...updates } : o));
          return { ...base, objects };
        });
        setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
        return;
      }
      const current = workingGraphics[selectedEquipmentId] || { objects: [] };
      const objects = (current.objects || []).map((o) =>
        o.id === objectId ? { ...o, ...updates } : o
      );
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
      setSelectedObject((prev) => (prev?.id === objectId ? { ...prev, ...updates } : prev));
    },
    [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions]
  );

  const generateObjectId = useCallback(() => {
    return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  const handleAddText = useCallback(() => {
    if (selectedLayoutNodeId) {
      const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
    if (!selectedEquipmentId) {
      setWorkingGraphic((current) => {
        const base = current || {
          id: "working-graphic",
          name: "Unassigned Graphic",
          status: "WORKING",
          lastEdited: "Now",
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        };
        const existingObjects = base.objects || [];
        const maxY = existingObjects.reduce(
          (m, o) => Math.max(m, (o.y || 0) + (o.height || 24)),
          0
        );
        const newObj = {
          id: generateObjectId(),
          type: "text",
          label: "Text",
          x: 100,
          y: Math.max(80, maxY + 20),
          width: 60,
          height: 24,
        };
        setSelectedObject(newObj);
        return { ...base, objects: [...existingObjects, newObj] };
      });
      return;
    }
    const current = workingGraphics[selectedEquipmentId] || { objects: [] };
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
  }, [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions, generateObjectId]);

  const handleAddValue = useCallback(() => {
    if (selectedLayoutNodeId) {
      const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
    if (!selectedEquipmentId) {
      setWorkingGraphic((current) => {
        const base = current || {
          id: "working-graphic",
          name: "Unassigned Graphic",
          status: "WORKING",
          lastEdited: "Now",
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        };
        const existingObjects = base.objects || [];
        const maxY = existingObjects.reduce(
          (m, o) => Math.max(m, (o.y || 0) + (o.height || 24)),
          0
        );
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
        setSelectedObject(newObj);
        return { ...base, objects: [...existingObjects, newObj] };
      });
      return;
    }
    const current = workingGraphics[selectedEquipmentId] || { objects: [] };
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
  }, [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions, generateObjectId]);

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
      const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
    if (!selectedEquipmentId) {
      setWorkingGraphic((current) => {
        const base = current || {
          id: "working-graphic",
          name: "Unassigned Graphic",
          status: "WORKING",
          lastEdited: "Now",
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        };
        const existingObjects = base.objects || [];
        const maxY = existingObjects.reduce(
          (m, o) => Math.max(m, (o.y || 0) + (o.height || 24)),
          0
        );
        const updatedObj = {
          ...newObj,
          y: Math.max(80, maxY + 20),
        };
        setSelectedObject(updatedObj);
        return { ...base, objects: [...existingObjects, updatedObj] };
      });
      return;
    }
    const current = workingGraphics[selectedEquipmentId] || { objects: [] };
    const existingObjects = current.objects || [];
    const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
    newObj.y = Math.max(80, maxY + 20);
    actions.setGraphicForEquipment(selectedEquipmentId, {
      ...current,
      objects: [...existingObjects, newObj],
    });
    setSelectedObject(newObj);
  }, [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions, generateObjectId]);

  const handleAddShape = useCallback(() => {
    const newObj = {
      id: generateObjectId(),
      type: "shape",
      label: "Shape",
      x: 100,
      y: 100,
      width: 80,
      height: 80,
      shapeColor: "default_grey",
      fill: "rgba(130, 135, 145, 0.38)",
      stroke: "rgba(165, 170, 180, 0.7)",
      opacity: 1,
    };
    if (selectedLayoutNodeId) {
      const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
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
    if (!selectedEquipmentId) {
      setWorkingGraphic((current) => {
        const base = current || {
          id: "working-graphic",
          name: "Unassigned Graphic",
          status: "WORKING",
          lastEdited: "Now",
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        };
        const existingObjects = base.objects || [];
        const maxY = existingObjects.reduce(
          (m, o) => Math.max(m, (o.y || 0) + (o.height || 24)),
          0
        );
        const updatedObj = {
          ...newObj,
          y: Math.max(80, maxY + 20),
        };
        setSelectedObject(updatedObj);
        return { ...base, objects: [...existingObjects, updatedObj] };
      });
      return;
    }
    const current = workingGraphics[selectedEquipmentId] || { objects: [] };
    const existingObjects = current.objects || [];
    const maxY = existingObjects.reduce((m, o) => Math.max(m, (o.y || 0) + (o.height || 24)), 0);
    newObj.y = Math.max(80, maxY + 20);
    actions.setGraphicForEquipment(selectedEquipmentId, {
      ...current,
      objects: [...existingObjects, newObj],
    });
    setSelectedObject(newObj);
  }, [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions, generateObjectId]);

  const handleDeleteObject = useCallback(
    (objectId) => {
      if (selectedLayoutNodeId) {
        const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = (current.objects || []).filter((o) => o.id !== objectId);
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects });
        if (selectedObject?.id === objectId) setSelectedObject(null);
        return;
      }
      if (selectedEquipmentId && objectId) {
        const current = workingGraphics[selectedEquipmentId] || { objects: [] };
        const objects = (current.objects || []).filter((o) => o.id !== objectId);
        actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects });
        if (selectedObject?.id === objectId) setSelectedObject(null);
        return;
      }
      // Unassigned working graphic
      if (!objectId) return;
      setWorkingGraphic((current) => {
        if (!current) return current;
        const objects = (current.objects || []).filter((o) => o.id !== objectId);
        if (selectedObject?.id === objectId) setSelectedObject(null);
        return { ...current, objects };
      });
    },
    [selectedEquipmentId, selectedLayoutNodeId, selectedObject?.id, workingGraphics, workingSiteLayoutGraphics, actions]
  );

  const handleDuplicateObject = useCallback(
    (objectId) => {
      if (!objectId) return;

      const cloneOffset = 12;

      if (selectedLayoutNodeId) {
        const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = current.objects || [];
        const idx = objects.findIndex((o) => o.id === objectId);
        if (idx < 0) return;

        const original = objects[idx];
        if (!original) return;

        const clone = { ...original, id: generateObjectId(), x: (original.x ?? 0) + cloneOffset, y: (original.y ?? 0) + cloneOffset };
        const nextObjects = [...objects.slice(0, idx + 1), clone, ...objects.slice(idx + 1)];
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects: nextObjects });
        setSelectedObject(clone);
        return;
      }

      if (!selectedEquipmentId) {
        setWorkingGraphic((current) => {
          const base =
            current || {
              id: "working-graphic",
              name: "Unassigned Graphic",
              status: "WORKING",
              lastEdited: "Now",
              objects: [],
              canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
            };
          const objects = base.objects || [];
          const idx = objects.findIndex((o) => o.id === objectId);
          if (idx < 0) return base;

          const original = objects[idx];
          if (!original) return base;

          const clone = { ...original, id: generateObjectId(), x: (original.x ?? 0) + cloneOffset, y: (original.y ?? 0) + cloneOffset };
          const nextObjects = [...objects.slice(0, idx + 1), clone, ...objects.slice(idx + 1)];
          setSelectedObject(clone);
          return { ...base, objects: nextObjects };
        });
        return;
      }

      const current = workingGraphics[selectedEquipmentId] || { objects: [] };
      const objects = current.objects || [];
      const idx = objects.findIndex((o) => o.id === objectId);
      if (idx < 0) return;

      const original = objects[idx];
      if (!original) return;

      const clone = { ...original, id: generateObjectId(), x: (original.x ?? 0) + cloneOffset, y: (original.y ?? 0) + cloneOffset };
      const nextObjects = [...objects.slice(0, idx + 1), clone, ...objects.slice(idx + 1)];
      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects: nextObjects });
      setSelectedObject(clone);
    },
    [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions, generateObjectId]
  );

  const handleReorderObject = useCallback(
    (objectId, direction) => {
      if (!objectId) return;
      const step = direction === "forward" ? 1 : -1;

      if (selectedLayoutNodeId) {
        const current = workingSiteLayoutGraphics[selectedLayoutNodeId] || { objects: [] };
        const objects = current.objects || [];
        const idx = objects.findIndex((o) => o.id === objectId);
        if (idx < 0) return;

        const nextIdx = idx + step;
        if (nextIdx < 0 || nextIdx >= objects.length) return;

        const nextObjects = [...objects];
        const tmp = nextObjects[idx];
        nextObjects[idx] = nextObjects[nextIdx];
        nextObjects[nextIdx] = tmp;

        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...current, objects: nextObjects });
        return;
      }

      if (!selectedEquipmentId) {
        setWorkingGraphic((current) => {
          if (!current) return current;
          const objects = current.objects || [];
          const idx = objects.findIndex((o) => o.id === objectId);
          if (idx < 0) return current;

          const nextIdx = idx + step;
          if (nextIdx < 0 || nextIdx >= objects.length) return current;

          const nextObjects = [...objects];
          const tmp = nextObjects[idx];
          nextObjects[idx] = nextObjects[nextIdx];
          nextObjects[nextIdx] = tmp;

          return { ...current, objects: nextObjects };
        });
        return;
      }

      const current = workingGraphics[selectedEquipmentId] || { objects: [] };
      const objects = current.objects || [];
      const idx = objects.findIndex((o) => o.id === objectId);
      if (idx < 0) return;

      const nextIdx = idx + step;
      if (nextIdx < 0 || nextIdx >= objects.length) return;

      const nextObjects = [...objects];
      const tmp = nextObjects[idx];
      nextObjects[idx] = nextObjects[nextIdx];
      nextObjects[nextIdx] = tmp;

      actions.setGraphicForEquipment(selectedEquipmentId, { ...current, objects: nextObjects });
    },
    [selectedEquipmentId, selectedLayoutNodeId, workingGraphics, workingSiteLayoutGraphics, actions]
  );

  const handleBringForwardObject = useCallback(
    (objectId) => handleReorderObject(objectId, "forward"),
    [handleReorderObject]
  );

  const handleSendBackwardObject = useCallback(
    (objectId) => handleReorderObject(objectId, "backward"),
    [handleReorderObject]
  );

  const handleOpenLink = useCallback(
    (linkTarget) => {
      if (!linkTarget?.type) return;
      if (linkTarget.type === "equipment" && linkTarget.id) {
        history.push(Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(linkTarget.id)));
      } else if (linkTarget.type === "layout" && linkTarget.id) {
        history.push(Routes.LegionSite.path, { selectLayoutLevelId: linkTarget.id });
      } else if (linkTarget.type === "url" && linkTarget.url) {
        window.open(linkTarget.url, "_blank", "noopener,noreferrer");
      } else if (linkTarget.type === "route" && linkTarget.path) {
        history.push(linkTarget.path);
      }
    },
    [history]
  );

  const patchGraphicMeta = useCallback(
    (patch) => {
      if (editingGraphicTemplateId || graphicAuthoringEquipmentTemplateId) {
        setWorkingGraphic((w) => ({ ...(w || {}), ...patch }));
        return;
      }
      if (selectedLayoutNodeId) {
        const cur = workingSiteLayoutGraphics[selectedLayoutNodeId] || {};
        actions.setGraphicForSiteLayout(selectedLayoutNodeId, { ...cur, ...patch });
      } else if (selectedEquipmentId) {
        const cur = workingGraphics[selectedEquipmentId] || {};
        actions.setGraphicForEquipment(selectedEquipmentId, { ...cur, ...patch });
      } else {
        setWorkingGraphic((w) => ({ ...(w || {}), ...patch }));
      }
    },
    [
      editingGraphicTemplateId,
      graphicAuthoringEquipmentTemplateId,
      selectedLayoutNodeId,
      selectedEquipmentId,
      workingGraphics,
      workingSiteLayoutGraphics,
      actions,
    ]
  );

  const handleAddZone = useCallback(() => {
    if (!selectedObject || selectedObject.type !== "shape") return;
    const zc = createDefaultZoneConfig();
    handleUpdateObject(selectedObject.id, {
      ...selectedObject,
      graphicElementType: "zone",
      zoneConfig: zc,
    });
    setZoneModalInitialTab("general");
    setZoneModalOpen(true);
  }, [selectedObject, handleUpdateObject]);

  const handleOpenZoneSettings = useCallback(
    (tab) => {
      if (!selectedObject || !isZoneShape(selectedObject)) return;
      setZoneModalInitialTab(tab || "general");
      setZoneModalOpen(true);
    },
    [selectedObject]
  );

  const handleOpenBindingMap = useCallback(() => {
    if (!selectedObject || !isZoneShape(selectedObject)) return;
    setZoneModalInitialTab("bindings");
    setZoneModalOpen(true);
  }, [selectedObject]);

  const handleResetZoneStyle = useCallback(() => {
    if (!selectedObject || !isZoneShape(selectedObject)) return;
    handleUpdateObject(selectedObject.id, {
      ...selectedObject,
      zoneConfig: mergeZoneConfig(selectedObject.zoneConfig, {
        stateColors: { ...createDefaultStateColors(), ...applyTemperatureSimpleVisualPreset() },
      }),
    });
  }, [selectedObject, handleUpdateObject]);

  const handleDuplicateZoneConfig = useCallback(() => {
    if (!selectedObject || !isZoneShape(selectedObject)) return;
    handleDuplicateObject(selectedObject.id);
  }, [selectedObject, handleDuplicateObject]);

  const resolveEquipmentLabelForCanvas = useCallback(
    (equipmentId) => {
      if (!equipmentId) return "";
      const row = equipmentList.find((e) => e.id === equipmentId);
      return row?.displayLabel || row?.name || equipmentId;
    },
    [equipmentList]
  );

  const handleOpenEquipmentDetailFromZone = useCallback(
    (equipmentId) => {
      if (!equipmentId) return;
      history.push(Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(equipmentId)));
    },
    [history]
  );

  const hasSelection = !!selectedEquipmentId || !!selectedLayoutNodeId;

  const handleSaveAsTemplateClick = useCallback(() => {
    setShowSaveTemplateModal(true);
  }, []);

  const handleConfirmSaveGraphicTemplate = useCallback(
    ({ name, equipmentTemplateId }) => {
      if (!selectedGraphic) return;
      setGraphicAuthoringEquipmentTemplateId(null);
      const eqTemplate = equipmentTemplateId
        ? (workingState.templates?.equipmentTemplates || []).find((e) => e.id === equipmentTemplateId)
        : null;
      const appliesTo = eqTemplate?.name || "—";
      const resolvedEquipmentTemplateId = eqTemplate?.id ?? null;
      const editorState = cloneGraphicEditorState(selectedGraphic);
      const boundPointCount = countBoundTemplatePointBindings(editorState.objects);
      const prevEq = workingState.templates?.equipmentTemplates || [];
      const prevGfx = workingState.templates?.graphicTemplates || [];
      const now = new Date().toISOString().slice(0, 10);

      if (editingGraphicTemplateId) {
        const nextGfx = prevGfx.map((g) =>
          g.id === editingGraphicTemplateId
            ? {
                ...g,
                name,
                equipmentTemplateId: resolvedEquipmentTemplateId,
                appliesTo,
                boundPointCount,
                graphicEditorState: editorState,
                lastUpdated: now,
              }
            : g
        );
        actions.setTemplates({ equipmentTemplates: prevEq, graphicTemplates: nextGfx });
        setWorkingGraphic((w) => ({
          ...(w || {
            id: "working-graphic",
            name: "",
            status: "WORKING",
            lastEdited: now,
            objects: [],
            canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
          }),
          name,
          objects: editorState.objects,
          canvasSize: editorState.canvasSize,
          backgroundImage: editorState.backgroundImage,
        }));
      } else {
        const id = generateGraphicTemplateId();
        const newT = createGraphicTemplate({
          id,
          name,
          equipmentTemplateId: resolvedEquipmentTemplateId,
          appliesTo,
          boundPointCount,
          graphicEditorState: editorState,
          lastUpdated: now,
          source: engineeringRepository.SOURCE.SITE_CUSTOM,
        });
        actions.setTemplates({ equipmentTemplates: prevEq, graphicTemplates: [...prevGfx, newT] });
        setEditingGraphicTemplateId(id);
      }

      setShowSaveTemplateModal(false);
      setShowSaveToast(true);
      if (typeof window !== "undefined" && window.setTimeout) {
        window.setTimeout(() => setShowSaveToast(false), 4000);
      }
    },
    [
      workingState.templates?.equipmentTemplates,
      workingState.templates?.graphicTemplates,
      selectedGraphic,
      editingGraphicTemplateId,
      actions,
    ]
  );

  const handlePublishGraphicTemplateToGlobal = useCallback(async () => {
    if (!editingGraphicTemplateId || !templateBeingEdited || !selectedGraphic) return;
    if (!USE_HIERARCHY_API) {
      setGlobalLibraryToast({
        variant: "warning",
        message: "Configure REACT_APP_API_BASE_URL to publish to the Global Template Library.",
      });
      return;
    }
    setPublishingGraphicToGlobal(true);
    setGlobalLibraryToast(null);
    try {
      const editorState = cloneGraphicEditorState(selectedGraphic);
      const boundPointCount = countBoundTemplatePointBindings(editorState.objects);
      const payload = {
        ...templateBeingEdited,
        name: (selectedGraphic.name || templateBeingEdited.name || "").trim() || templateBeingEdited.name,
        graphicEditorState: editorState,
        boundPointCount,
      };
      const eqSummary = (workingState.templates?.equipmentTemplates || []).map((e) => ({
        id: e.id,
        name: e.name,
        equipmentType: e.equipmentType,
      }));
      await engineeringRepository.pushGraphicTemplateToGlobal(payload, eqSummary);
      setGlobalLibraryToast({
        variant: "success",
        message: "Graphic template saved to Global Template Library. Other projects can import it from Template Library.",
      });
      if (typeof window !== "undefined" && window.setTimeout) {
        window.setTimeout(() => setGlobalLibraryToast(null), 5000);
      }
    } catch (err) {
      setGlobalLibraryToast({
        variant: "danger",
        message: err?.message || "Failed to publish graphic template to global library.",
      });
    } finally {
      setPublishingGraphicToGlobal(false);
    }
  }, [
    editingGraphicTemplateId,
    templateBeingEdited,
    selectedGraphic,
    workingState.templates?.equipmentTemplates,
  ]);

  const handleGraphicNameChange = useCallback(
    (name) => {
      if (editingGraphicTemplateId) {
        setWorkingGraphic((current) => ({
          ...(current || {
            id: "working-graphic",
            name: "",
            status: "WORKING",
            lastEdited: "Now",
            objects: [],
            canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
          }),
          name: name || "",
        }));
        return;
      }
      if (!selectedEquipmentId || !selectedGraphic) return;
      const updated = { ...selectedGraphic, name: name || "" };
      actions.setGraphicForEquipment(selectedEquipmentId, updated);
    },
    [editingGraphicTemplateId, selectedEquipmentId, selectedGraphic, actions]
  );

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
      if (selectedLayoutNodeId || selectedEquipmentId) {
        if (!selectedGraphic) return;
        const updated = { ...selectedGraphic, backgroundImage };
        if (selectedLayoutNodeId) {
          actions.setGraphicForSiteLayout(selectedLayoutNodeId, updated);
        } else if (selectedEquipmentId) {
          actions.setGraphicForEquipment(selectedEquipmentId, updated);
        }
        return;
      }
      // Unassigned working graphic
      setWorkingGraphic((current) => ({
        ...(current || {
          id: "working-graphic",
          name: "Unassigned Graphic",
          status: "WORKING",
          lastEdited: "Now",
          objects: [],
          canvasSize: { ...EQUIPMENT_GRAPHIC_CANVAS_DEFAULT },
        }),
        backgroundImage,
      }));
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

  const handleBackgroundSizeChange = useCallback(
    (updates) => {
      const bg = selectedGraphic?.backgroundImage;
      if (!bg?.dataUrl) return;
      setGraphicBackgroundImage({ ...bg, ...updates });
    },
    [selectedGraphic?.backgroundImage, setGraphicBackgroundImage]
  );

  const handleBackgroundCropChange = useCallback(
    (crop) => {
      const bg = selectedGraphic?.backgroundImage;
      if (!bg?.dataUrl) return;
      setGraphicBackgroundImage({ ...bg, crop });
    },
    [selectedGraphic?.backgroundImage, setGraphicBackgroundImage]
  );

  const handleBackgroundStyleChange = useCallback(
    (updates) => {
      const bg = selectedGraphic?.backgroundImage;
      if (!bg?.dataUrl) return;
      setGraphicBackgroundImage({ ...bg, ...updates });
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
  }, [setGraphicBackgroundImage]);

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
          // Downscale before base64 to avoid freezing on huge images.
          // Layout graphics allow larger imports (floorplans); equipment stays canvas-sized.
          const maxW = selectedLayoutNodeId
            ? LAYOUT_BACKGROUND_IMPORT_MAX.width
            : Math.max(1, canvasWidth);
          const maxH = selectedLayoutNodeId
            ? LAYOUT_BACKGROUND_IMPORT_MAX.height
            : Math.max(1, canvasHeight);
          const { dataUrl, width: w, height: h } = await downscaleImageFileToDataUrl(file, maxW, maxH, {
            preferJpegForLocalStorage: !!selectedLayoutNodeId,
            jpegQuality: 0.82,
          });

          const x = Math.round((canvasWidth - w) / 2);
          const y = Math.round((canvasHeight - h) / 2);

          setGraphicBackgroundImage({
            type: "image",
            dataUrl,
            x,
            y,
            width: w,
            height: h,
            fit: "contain",
            crop: null,
            objectPositionX: 50,
            objectPositionY: 50,
          });
        } catch (err) {
          console.error("Failed to import image (downscale)", err);
          // Do not embed full-file base64 for layout graphics — it exceeds localStorage and freezes the app.
          if (selectedLayoutNodeId) return;
          try {
            const dataUrl = await readFileAsDataUrl(file);
            const x = 0;
            const y = 0;
            setGraphicBackgroundImage({
              type: "image",
              dataUrl,
              x,
              y,
              width: canvasWidth,
              height: canvasHeight,
              fit: "contain",
              crop: null,
              objectPositionX: 50,
              objectPositionY: 50,
            });
          } catch (err2) {
            console.error("Failed to import image", err2);
          }
        }
        el.onchange = null;
      };
      el.click();
    }
  }, [setGraphicBackgroundImage, selectedGraphic, canvasWidth, canvasHeight, selectedLayoutNodeId]);

  const handleOpenAssignModal = useCallback(() => {
    setAssignPendingLayoutNodeId(selectedLayoutNodeId);
    setAssignPendingEquipmentId(selectedEquipmentId);
    setShowAssignModal(true);
  }, [selectedLayoutNodeId, selectedEquipmentId]);

  const handleCloseAssignModal = useCallback(() => {
    setShowAssignModal(false);
  }, []);

  const handleAssignConfirm = useCallback(() => {
    setSelectedLayoutNodeId(assignPendingLayoutNodeId);
    setSelectedEquipmentId(assignPendingEquipmentId);
    setSelectedObject(null);
    setShowAssignModal(false);
  }, [assignPendingLayoutNodeId, assignPendingEquipmentId]);

  const handleNewGraphic = useCallback(() => {
    console.log("New Graphic");
  }, []);
  const handleDuplicate = useCallback(() => {
    if (!hasSelection) {
      setAssignPendingLayoutNodeId(selectedLayoutNodeId);
      setAssignPendingEquipmentId(selectedEquipmentId);
      setShowAssignModal(true);
      return;
    }
    console.log("Duplicate");
  }, [hasSelection, selectedLayoutNodeId, selectedEquipmentId]);
  const handleDelete = useCallback(() => {
    if (!hasSelection) {
      setAssignPendingLayoutNodeId(selectedLayoutNodeId);
      setAssignPendingEquipmentId(selectedEquipmentId);
      setShowAssignModal(true);
      return;
    }
    if (selectedLayoutNodeId) {
      actions.setGraphicForSiteLayout(selectedLayoutNodeId, null);
      setSelectedObject(null);
    } else if (selectedEquipmentId) {
      actions.setGraphicForEquipment(selectedEquipmentId, null);
      setSelectedObject(null);
    }
  }, [hasSelection, selectedLayoutNodeId, selectedEquipmentId, actions]);
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
            <span className="text-white fw-semibold">{workingState?.site?.name || site || "—"}</span>
            {activeReleaseData ? (
              <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">
                Active release {activeReleaseData.version}
              </span>
            ) : (
              <span className="badge bg-secondary bg-opacity-50 text-white-50 border border-secondary">
                Working version
              </span>
            )}
          </div>
        </div>

        {(selectedEquipmentId || editingGraphicTemplateId || graphicAuthoringEquipmentTemplateId) && (
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm mt-2">
            <Card.Body className="py-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="text-white-50 small">Graphic name:</span>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  style={{ maxWidth: 280 }}
                  value={selectedGraphic?.name ?? ""}
                  onChange={(e) => handleGraphicNameChange(e.target.value)}
                  placeholder={
                    editingGraphicTemplateId || graphicAuthoringEquipmentTemplateId
                      ? "Template name (also set in Save As Template)"
                      : "Name this graphic (shown in Site Builder)"
                  }
                />
                <span className="text-white-50 small">
                  {editingGraphicTemplateId
                    ? "Editing a Template Library graphic template."
                    : graphicAuthoringEquipmentTemplateId
                      ? "New graphic template — bind objects to template points, then Save As Template."
                      : "Shown in Site Builder → Edit Equipment → Graphic."}
                </span>
              </div>
            </Card.Body>
          </Card>
        )}

        {globalLibraryToast && (
          <div
            className={`mb-3 p-3 rounded border small ${
              globalLibraryToast.variant === "success"
                ? "border-success border-opacity-50 bg-success bg-opacity-10 text-success"
                : globalLibraryToast.variant === "warning"
                  ? "border-warning border-opacity-50 bg-warning bg-opacity-10 text-warning"
                  : "border-danger border-opacity-50 bg-danger bg-opacity-10 text-danger"
            }`}
          >
            <div className="fw-semibold">{globalLibraryToast.message}</div>
            <Button
              size="sm"
              variant="link"
              className="text-white-50 p-0 mt-2"
              onClick={() => setGlobalLibraryToast(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

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
              Graphic template saved in Template Library.
            </div>
            <div className="text-white-50 small mt-1">
              Open Template Library → Graphics to view, or continue editing here.
            </div>
            <Button size="sm" variant="link" className="text-white-50 p-0 mt-2" onClick={() => setShowSaveToast(false)}>Dismiss</Button>
          </div>
        )}

        <GraphicsToolbar
          layoutNodes={linkTargets.layoutNodes}
          equipmentList={equipmentList}
          selectedLayoutNodeId={selectedLayoutNodeId}
          selectedEquipmentId={selectedEquipmentId}
          selectedLayoutNode={selectedLayoutNode}
          selectedEquipment={selectedEquipment}
          onSelectLayoutNode={handleSelectLayoutNodeById}
          onSelectEquipment={handleSelectEquipmentById}
          onOpenTreeModal={handleOpenAssignModal}
          selectDisabled={hasNoSite}
          filterValue={filterValue}
          onFilterChange={handleFilterChange}
          onSaveAsTemplate={handleSaveAsTemplateClick}
          onAssignGraphic={handleOpenAssignModal}
          onNewGraphic={handleNewGraphic}
          onImportSvg={handleImportSvg}
          onImportImage={handleImportImage}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onPreview={handlePreview}
          onValidate={handleValidate}
          hasSelection={!!selectedEquipmentId || !!selectedLayoutNodeId}
          canPublishGraphicToGlobal={!!editingGraphicTemplateId && USE_HIERARCHY_API}
          publishingGraphicToGlobal={publishingGraphicToGlobal}
          onPublishGraphicToGlobal={handlePublishGraphicTemplateToGlobal}
          selectedObjectIsShape={selectedObject?.type === "shape"}
          selectedZoneEnabled={isZoneShape(selectedObject)}
          onAddZone={handleAddZone}
          onOpenZoneSettings={handleOpenZoneSettings}
          liveZonePreview={liveZonePreview}
          onToggleLiveZonePreview={() => setLiveZonePreview((v) => !v)}
          onResetZoneStyle={handleResetZoneStyle}
          onDuplicateZoneConfig={handleDuplicateZoneConfig}
          onOpenBindingMap={handleOpenBindingMap}
          onArchiveGraphic={() => patchGraphicMeta({ lifecycleStatus: "archived" })}
          onRestoreGraphic={() => patchGraphicMeta({ lifecycleStatus: "active" })}
          lifecycleStatus={selectedGraphic?.lifecycleStatus ?? "draft"}
          graphicsCategory={
            selectedGraphic?.graphicsCategory ?? (selectedLayoutNodeId ? "floor" : "equipment")
          }
          onGraphicsCategoryChange={(v) => patchGraphicMeta({ graphicsCategory: v })}
        />

        <div className="graphics-manager-editor-surface">
          <div
            className={`graphics-manager-workspace-stack${
              selectedObject?.type === "shape" ? " graphics-manager-workspace-stack--shape-no-inspector" : ""
            }`}
          >
            <GraphicsCanvas
              graphic={selectedGraphic}
              selectedObjectId={selectedObject?.id}
              onSelectObject={handleSelectObject}
              onUpdateObject={handleUpdateObject}
              onAddText={handleAddText}
              onAddValue={handleAddValue}
              onAddLink={handleAddLink}
              onAddShape={handleAddShape}
              onBackgroundPositionChange={handleBackgroundPositionChange}
              onBackgroundSizeChange={handleBackgroundSizeChange}
              onBackgroundCropChange={handleBackgroundCropChange}
              onUpdateBackgroundImage={handleBackgroundStyleChange}
              onDeleteObject={handleDeleteObject}
              availablePoints={selectedLayoutNodeId ? [] : availablePoints}
              equipmentList={equipmentList}
              templates={workingState?.templates}
              previewMode={false}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              emptyMessage="Start building your graphic by adding shapes, text, values, and a background image. You can assign it to a site, floor, building, or equipment later."
              liveZonePreview={liveZonePreview}
              onOpenEquipmentDetail={handleOpenEquipmentDetailFromZone}
              resolveEquipmentLabel={resolveEquipmentLabelForCanvas}
            />
            {selectedObject?.type !== "shape" && (
              <GraphicsInspector
                selectedObject={selectedObject}
                availablePoints={availablePoints}
                equipmentName={selectedEquipment?.name}
                linkTargets={linkTargets}
                backgroundImage={selectedGraphic?.backgroundImage}
                onUpdateObject={handleUpdateObject}
                onDeleteObject={handleDeleteObject}
                onOpenLink={handleOpenLink}
                onDuplicateObject={handleDuplicateObject}
                onBringForwardObject={handleBringForwardObject}
                onSendBackwardObject={handleSendBackwardObject}
              />
            )}
          </div>
        </div>
      </div>
      <Modal
        show={showAssignModal}
        onHide={handleCloseAssignModal}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Select a site, floor, building, or equipment to work on</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-primary">
          <p className="text-white-50 small mb-2">
            Select a site, building, floor, or equipment in the tree. Click <strong>Select</strong> to load the matching graphic workspace.
          </p>
          {siteTree ? (
            <GraphicsExplorer
              siteTree={siteTree}
              expandedIds={expandedIds}
              selectedId={assignPendingLayoutNodeId}
              selectedEquipmentId={assignPendingEquipmentId}
              onToggleExpand={toggleExpand}
              onSelect={(node) => {
                setAssignPendingLayoutNodeId(node?.id ?? null);
                setAssignPendingEquipmentId(null);
              }}
              onSelectEquipment={(equipment) => {
                setAssignPendingEquipmentId(equipment?.id ?? null);
                setAssignPendingLayoutNodeId(null);
              }}
            />
          ) : (
            <div className="text-white-50 small">
              No site tree available. Configure a site in Site Builder first.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-primary border-light border-opacity-10">
          <Button variant="outline-light" size="sm" onClick={handleCloseAssignModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="legion-hero-btn legion-hero-btn--primary"
            onClick={handleAssignConfirm}
            disabled={!assignPendingLayoutNodeId && !assignPendingEquipmentId}
          >
            Select
          </Button>
        </Modal.Footer>
      </Modal>

      <ZoneConfigurationModal
        show={zoneModalOpen}
        onHide={() => setZoneModalOpen(false)}
        zoneConfig={selectedObject?.zoneConfig || createDefaultZoneConfig()}
        onSave={(cfg) => {
          if (!selectedObject) return;
          handleUpdateObject(selectedObject.id, {
            ...selectedObject,
            zoneConfig: cfg,
            graphicElementType: "zone",
          });
        }}
        equipmentList={equipmentList}
        templates={workingState?.templates}
        initialTab={zoneModalInitialTab}
      />

      <SaveGraphicTemplateModal
        show={showSaveTemplateModal}
        onHide={() => setShowSaveTemplateModal(false)}
        equipmentTemplates={workingState.templates?.equipmentTemplates ?? []}
        initialName={
          (editingGraphicTemplateId && (selectedGraphic?.name || templateBeingEdited?.name || "")) ||
          templateBeingEdited?.name ||
          (selectedGraphic?.name &&
          selectedGraphic.name !== "Unassigned Graphic" &&
          selectedGraphic.name !== "Site Layout Graphic" &&
          selectedGraphic.name !== "New Graphic"
            ? selectedGraphic.name
            : "") ||
          ""
        }
        initialEquipmentTemplateId={
          templateBeingEdited?.equipmentTemplateId ||
          graphicAuthoringEquipmentTemplateId ||
          equipmentTemplateMatchingSelection?.id ||
          ""
        }
        isUpdate={!!editingGraphicTemplateId}
        onSave={handleConfirmSaveGraphicTemplate}
      />
    </Container>
  );
}
