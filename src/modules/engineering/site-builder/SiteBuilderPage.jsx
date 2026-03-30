import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Card, Button, Dropdown, Modal } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEllipsisV,
  faFileImport,
  faFileExport,
  faTrashAlt,
  faSitemap,
  faBoxOpen,
  faExpandAlt,
  faCompressAlt,
} from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion } from "../../../hooks/useWorkingVersion";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import SiteTree from "./components/SiteTree";
import NodeEditorPanel from "./components/NodeEditorPanel";
import CreateSiteModal from "./components/CreateSiteModal";
import EmptySiteState from "./components/EmptySiteState";
import AddEquipmentModal from "../equipment-builder/components/AddEquipmentModal";
import { engineeringRepository } from "../../../lib/data";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import * as hierarchyRepository from "../../../lib/data/repositories/hierarchyRepository";
import { selectSiteTree, siteTreeToWorkingSite } from "../../../hooks/useWorkingVersion";
import {
  reorderAfterDrag,
  sortEquipmentOnFloorByField,
  moveEquipmentRelative,
  insertDuplicateAfterSource,
} from "./siteBuilderEquipmentUtils";

// ---------------------------------------------------------------------------
// Data helpers: build nested tree from flat structure
// ---------------------------------------------------------------------------
function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function flattenTree(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flattenTree(c, acc));
  return acc;
}

function getBreadcrumb(node, site) {
  if (!node || !site) return "";
  const path = [];
  const flat = flattenTree(site);
  let current = node;
  while (current) {
    path.unshift(current.name);
    const parentId = current.parentId;
    if (!parentId) break;
    current = flat.find((n) => n.id === parentId);
  }
  return path.join(" / ");
}

function getEquipmentBreadcrumb(equipment, siteTree) {
  if (!equipment || !siteTree) return "";
  const floorId = equipment.floorId;
  if (!floorId) return equipment.name || "";
  let floor = null;
  let building = null;
  for (const b of siteTree.children || []) {
    floor = (b.children || []).find((f) => f.id === floorId);
    if (floor) {
      building = b;
      break;
    }
  }
  if (!floor || !building) return equipment.name || "";
  return `${siteTree.name} / ${building.name} / ${floor.name} / ${equipment.name}`;
}

function findNodeById(tree, id) {
  if (!tree || !id) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function updateNodeInTree(tree, id, updates) {
  if (!tree) return tree;
  if (tree.id === id) return { ...tree, ...updates };
  return {
    ...tree,
    children: (tree.children || []).map((c) => updateNodeInTree(c, id, updates)),
  };
}

function deleteNodeFromTree(tree, id) {
  if (!tree) return tree;
  if (tree.id === id) return null;
  const newChildren = (tree.children || [])
    .map((c) => deleteNodeFromTree(c, id))
    .filter(Boolean);
  return { ...tree, children: newChildren };
}

function treeToFlatData(siteTree) {
  if (!siteTree) return { site: null, buildings: [], floors: [] };
  const site = { id: siteTree.id, name: siteTree.name };
  const buildings = [];
  const floors = [];
  (siteTree.children || []).forEach((b) => {
    buildings.push({ id: b.id, site_id: site.id, name: b.name });
    (b.children || []).forEach((f) => {
      floors.push({ id: f.id, building_id: b.id, name: f.name, sort_order: f.sortOrder ?? 0 });
    });
  });
  return { site, buildings, floors };
}

/** Collect all floor IDs under a tree node (for delete: remove equipment on those floors) */
function collectFloorIdsUnder(node) {
  if (!node) return [];
  if (node.type === "floor") return [node.id];
  const ids = [];
  (node.children || []).forEach((c) => ids.push(...collectFloorIdsUnder(c)));
  return ids;
}

function findBuildingIdForFloor(siteTree, floorId) {
  if (!siteTree || !floorId) return null;
  for (const b of siteTree.children || []) {
    if ((b.children || []).some((f) => f.id === floorId)) return b.id;
  }
  return null;
}

function generateEquipmentId() {
  return `eq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateStructure(siteTree) {
  const errors = [];
  if (!siteTree) {
    errors.push("Site must exist.");
    return errors;
  }
  const buildings = siteTree.children || [];
  if (buildings.length === 0) {
    errors.push("At least one building is required.");
  }
  const names = new Set();
  buildings.forEach((b) => {
    if (names.has((b.name || "").toLowerCase())) {
      errors.push(`Duplicate building name: ${b.name}`);
    }
    names.add((b.name || "").toLowerCase());
  });
  buildings.forEach((b) => {
    const floorNames = new Set();
    (b.children || []).forEach((f) => {
      if (floorNames.has((f.name || "").toLowerCase())) {
        errors.push(`Duplicate floor name within ${b.name}: ${f.name}`);
      }
      floorNames.add((f.name || "").toLowerCase());
    });
  });
  return errors;
}

// ---------------------------------------------------------------------------
// SiteBuilderPage
// ---------------------------------------------------------------------------
export default function SiteBuilderPage() {
  const { site, setSite } = useSite();
  const {
    workingVersion,
    workingState,
    actions,
    backendWorkingVersionLoading,
    backendWorkingVersionError,
  } = useWorkingVersion();
  const siteTree = selectSiteTree(workingVersion);
  const equipmentList = workingState.equipment ?? [];

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [hierarchyMutationError, setHierarchyMutationError] = useState(null);

  // Expand all and set selected when working version has a site
  useEffect(() => {
    if (siteTree) {
      const allIds = new Set();
      const collectIds = (n) => {
        if (n?.id) allIds.add(n.id);
        (n?.children || []).forEach(collectIds);
      };
      collectIds(siteTree);
      setExpandedIds(allIds);
      if (!selectedId) setSelectedId(siteTree?.id ?? null);
    }
  }, [siteTree?.id]);

  const selectedNode = siteTree ? findNodeById(siteTree, selectedId) : null;
  const selectedEquipment = equipmentList.find((e) => e.id === selectedEquipmentId) || null;
  const breadcrumb = selectedEquipment
    ? getEquipmentBreadcrumb(selectedEquipment, siteTree)
    : getBreadcrumb(selectedNode, siteTree);

  // No longer load from mock on site change — working version is synced by EngineeringVersionProvider

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateSite = useCallback(
    async (data) => {
      if (USE_HIERARCHY_API) {
        setHierarchyMutationError(null);
        try {
          const created = await hierarchyRepository.createSite({ name: data.name.trim() });
          await hierarchyRepository.createBuilding(created.id, {
            name: data.defaultBuildingName || "Building 1",
            addressLine1: (data.address && data.address.trim()) || "TBD",
            city: "—",
            state: "—",
            postalCode: "00000",
            country: "US",
          });
          const payload = await engineeringRepository.fetchWorkingVersion(created.id);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          setExpandedIds(new Set());
          setSelectedId(null);
          setShowCreateModal(false);
          setSite(created.id);
          engineeringRepository.notifyEngineeringHierarchyChanged();
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const buildingId = generateId();
      const siteId = generateId();
      const building = {
        id: buildingId,
        type: "building",
        name: data.defaultBuildingName || "Building 1",
        parentId: siteId,
        children: [],
      };
      const tree = {
        id: siteId,
        type: "site",
        name: data.name,
        address: data.address,
        description: data.description,
        timezone: data.timezone,
        parentId: null,
        children: [building],
      };
      const newSite = siteTreeToWorkingSite(tree);
      if (newSite) actions.setSite(newSite);
      actions.setEquipment([]);
      setExpandedIds(new Set([siteId, buildingId]));
      setSelectedId(buildingId);
      setShowCreateModal(false);
      if (data.name && typeof setSite === "function") setSite(data.name.trim() || "New Site");
    },
    [actions, setSite]
  );

  const handleAddBuilding = useCallback(async () => {
    if (!siteTree || !workingState.site) return;
    if (USE_HIERARCHY_API && isBackendSiteId(workingState.site.id)) {
      setHierarchyMutationError(null);
      try {
        await hierarchyRepository.createBuilding(workingState.site.id, {
          name: `Building ${(siteTree.children || []).length + 1}`,
          addressLine1: "TBD",
          city: "—",
          state: "—",
          postalCode: "00000",
          country: "US",
        });
        const payload = await engineeringRepository.fetchWorkingVersion(workingState.site.id);
        if (payload) {
          actions.setSite(payload.site);
          actions.setEquipment(payload.equipment);
        }
        engineeringRepository.notifyEngineeringHierarchyChanged();
      } catch (e) {
        setHierarchyMutationError(e?.message || String(e));
      }
      return;
    }
    const id = generateId();
    const building = {
      id,
      type: "building",
      name: `Building ${(siteTree.children || []).length + 1}`,
      parentId: siteTree.id,
      children: [],
    };
    const newTree = { ...siteTree, children: [...(siteTree.children || []), building] };
    const newSite = siteTreeToWorkingSite(newTree);
    if (newSite) actions.setSite(newSite);
    setExpandedIds((prev) => new Set([...prev, siteTree.id, id]));
    setSelectedId(id);
  }, [siteTree, workingState.site, actions]);

  const handleSaveNode = useCallback(
    async (id, form) => {
      if (!siteTree) return;
      const parseCoord = (v) => {
        if (v === "" || v == null) return null;
        const n = parseFloat(String(v).trim());
        return Number.isFinite(n) ? n : null;
      };
      const node = findNodeById(siteTree, id);
      if (
        USE_HIERARCHY_API &&
        isBackendSiteId(site) &&
        node &&
        (node.type === "site" || node.type === "building" || node.type === "floor")
      ) {
        setHierarchyMutationError(null);
        try {
          if (node.type === "site") {
            await hierarchyRepository.updateSite(site, { name: form.name });
          } else if (node.type === "building") {
            await hierarchyRepository.updateBuilding(id, {
              name: form.name,
              addressLine1: form.address || "TBD",
              city: form.city || "—",
              state: form.state || "—",
              postalCode: "00000",
              country: "US",
              latitude: parseCoord(form.lat),
              longitude: parseCoord(form.lng),
            });
          } else {
            await hierarchyRepository.updateFloor(id, { name: form.name });
          }
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const updated = updateNodeInTree(siteTree, id, {
        name: form.name,
        displayLabel: form.displayLabel,
        description: form.description,
        icon: form.icon,
        sortOrder: form.sortOrder,
        siteType: form.siteType,
        timezone: form.timezone,
        address: form.address,
        status: form.status,
        engineeringNotes: form.engineeringNotes,
        buildingType: form.buildingType,
        buildingCode: form.buildingCode,
        city: form.city,
        state: form.state,
        lat: parseCoord(form.lat),
        lng: parseCoord(form.lng),
        floorType: form.floorType,
        occupancyType: form.occupancyType,
      });
      const newSite = siteTreeToWorkingSite(updated);
      if (newSite) actions.setSite(newSite);
    },
    [siteTree, actions, site]
  );

  const handleDeleteNode = useCallback(
    async (id) => {
      if (!siteTree) return;
      const node = findNodeById(siteTree, id);
      if (USE_HIERARCHY_API && isBackendSiteId(site) && node && node.type !== "site") {
        setHierarchyMutationError(null);
        try {
          if (node.type === "building") {
            await hierarchyRepository.deleteBuilding(id);
          } else if (node.type === "floor") {
            await hierarchyRepository.deleteFloor(id);
          }
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
          if (selectedId === id) setSelectedId(null);
          setDeleteConfirmNode(null);
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const deletedFloorIds = node ? collectFloorIdsUnder(node) : [];
      const newTree = deleteNodeFromTree(siteTree, id);
      const newSite = newTree ? siteTreeToWorkingSite(newTree) : null;
      if (newSite) actions.setSite(newSite);
      if (deletedFloorIds.length > 0) {
        const newEquipment = (workingState.equipment || []).filter((e) => !deletedFloorIds.includes(e.floorId));
        actions.setEquipment(newEquipment);
      }
      if (selectedId === id) setSelectedId(null);
      setDeleteConfirmNode(null);
    },
    [siteTree, workingState.equipment, selectedId, actions, site]
  );

  const handleDeleteConfirm = useCallback((node) => {
    setDeleteConfirmNode(node);
  }, []);

  const handleDeleteFromTree = useCallback(
    (node) => {
      if (node?.children?.length) {
        setDeleteConfirmNode(node);
      } else {
        handleDeleteNode(node?.id);
      }
    },
    [handleDeleteNode]
  );

  const handleSelectNode = useCallback((node) => {
    setSelectedId(node?.id ?? null);
    setSelectedEquipmentId(null);
  }, []);

  const handleSelectEquipment = useCallback((equipment) => {
    setSelectedEquipmentId(equipment?.id ?? null);
    setSelectedId(null);
  }, []);

  const handleReorderEquipment = useCallback(
    (floorId, draggedId, targetId) => {
      const next = reorderAfterDrag(equipmentList, floorId, draggedId, targetId);
      actions.setEquipment(next);
    },
    [equipmentList, actions]
  );

  const handleSortFloorEquipment = useCallback(
    (floorId, spec) => {
      const next =
        typeof spec === "string"
          ? sortEquipmentOnFloorByField(equipmentList, floorId, "name", spec)
          : sortEquipmentOnFloorByField(equipmentList, floorId, spec.field, spec.direction);
      actions.setEquipment(next);
    },
    [equipmentList, actions]
  );

  const handleMoveEquipment = useCallback(
    (equipmentId, direction) => {
      const eq = equipmentList.find((e) => e.id === equipmentId);
      if (!eq?.floorId) return;
      const next = moveEquipmentRelative(equipmentList, eq.floorId, equipmentId, direction);
      actions.setEquipment(next);
    },
    [equipmentList, actions]
  );

  const handleDuplicateEquipment = useCallback(
    async (equipmentId) => {
      const source = equipmentList.find((e) => e.id === equipmentId);
      if (!source) return;

      if (USE_HIERARCHY_API && isBackendSiteId(site)) {
        setHierarchyMutationError(null);
        try {
          const base = String(source.name || "Equipment").replace(/\s*\(copy\)\s*$/i, "").trim();
          const code = `${base}_copy_${Date.now()}`.replace(/\s+/g, "_").slice(0, 64);
          await hierarchyRepository.createEquipment(source.floorId, {
            name: `${base} (copy)`,
            code,
            equipmentType: source.type || source.equipmentType || "CUSTOM",
            ...(source.templateName ? { templateName: source.templateName } : {}),
          });
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }

      const newId = generateEquipmentId();
      const baseName = String(source.name || "Equipment").replace(/\s*\(copy\)\s*$/i, "").trim();
      const newEq = {
        ...source,
        id: newId,
        name: `${baseName} (copy)`,
        displayLabel: `${String(source.displayLabel || source.name || "Equipment")
          .replace(/\s*\(copy\)\s*$/i, "")
          .trim()} (copy)`,
        instanceNumber: null,
        controllerRef: null,
        deviceInstance: null,
        status: "MISSING_CONTROLLER",
        pointsDefined: 0,
        buildingId: source.buildingId ?? findBuildingIdForFloor(siteTree, source.floorId),
        notes: source.notes || "",
      };

      const nextList = insertDuplicateAfterSource(equipmentList, equipmentId, newId, newEq);
      actions.setEquipment(nextList);

      const m = workingState.mappings?.[equipmentId];
      if (m && typeof m === "object" && Object.keys(m).length) {
        actions.setMappingsForEquipment(newId, JSON.parse(JSON.stringify(m)));
      }

      const g = workingState.graphics?.[equipmentId];
      if (g) {
        actions.setGraphicForEquipment(newId, {
          ...g,
          id: g.id ? `g-${newId}-${Date.now()}` : undefined,
          equipmentId: newId,
        });
      }

      setSelectedEquipmentId(newId);
    },
    [equipmentList, actions, site, siteTree, workingState.mappings, workingState.graphics]
  );

  const handleSaveEquipment = useCallback(
    async (id, form) => {
      if (USE_HIERARCHY_API && isBackendSiteId(site)) {
        setHierarchyMutationError(null);
        try {
          const tmpl = form.templateName != null && String(form.templateName).trim() ? String(form.templateName).trim() : null;
          const addr = form.address != null && String(form.address).trim() ? String(form.address).trim() : null;
          await hierarchyRepository.updateEquipment(id, {
            name: form.name,
            code: (form.displayLabel && String(form.displayLabel).trim()) || form.name,
            equipmentType: form.equipmentType,
            templateName: tmpl,
            address: addr,
          });
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const hasController = !!(form.controllerRef && String(form.controllerRef).trim());
      const status = hasController ? "CONTROLLER_ASSIGNED" : "MISSING_CONTROLLER";
      const instanceNum = (form.instanceNumber && String(form.instanceNumber).trim()) || null;
      const prev = (workingState.equipment || []).find((e) => e.id === id);
      const updates = {
        name: form.name,
        displayLabel: form.displayLabel,
        type: form.equipmentType,
        instanceNumber: instanceNum,
        address: (form.address != null && String(form.address).trim()) ? String(form.address).trim() : null,
        locationLabel: form.locationLabel,
        controllerRef: form.controllerRef ?? null,
        templateName: form.templateName ?? null,
        pointsDefined: form.pointsDefined ?? 0,
        status,
        notes: form.notes ?? "",
      };
      if (form.floorId) {
        updates.floorId = form.floorId;
        updates.buildingId = findBuildingIdForFloor(siteTree, form.floorId);
        if (prev && form.floorId !== prev.floorId) {
          const mates = (workingState.equipment || []).filter((e) => e.floorId === form.floorId && e.id !== id);
          const maxSort = mates.reduce(
            (m, e) => Math.max(m, typeof e.sortOrder === "number" ? e.sortOrder : -1),
            -1
          );
          updates.sortOrder = maxSort + 1;
        }
      }
      const next = (workingState.equipment || []).map((e) => (e.id === id ? { ...e, ...updates } : e));
      actions.setEquipment(next);
    },
    [workingState.equipment, actions, site, siteTree]
  );

  const handleGraphicChange = useCallback(
    (equipmentId, value) => {
      const graphics = workingState.graphics || {};
      const equipment = (workingState.equipment || []).map((e) => (e.id === equipmentId ? { ...e } : e));
      const currentEq = equipment.find((e) => e.id === equipmentId);
      if (!currentEq) return;
      if (value === "") {
        currentEq.graphicTemplateId = null;
        actions.setEquipment(equipment);
        actions.setGraphicForEquipment(equipmentId, null);
        return;
      }
      if (value.startsWith("template:")) {
        const templateId = value.slice("template:".length);
        currentEq.graphicTemplateId = templateId || null;
        actions.setEquipment(equipment);
        actions.setGraphicForEquipment(equipmentId, null);
        return;
      }
      if (value.startsWith("graphic:")) {
        const sourceEquipmentId = value.slice("graphic:".length);
        const sourceGraphic = graphics[sourceEquipmentId];
        if (sourceGraphic) {
          const copy = {
            ...sourceGraphic,
            id: sourceGraphic.id ? `g-${equipmentId}-${Date.now()}` : undefined,
            equipmentId,
          };
          currentEq.graphicTemplateId = null;
          actions.setEquipment(equipment);
          actions.setGraphicForEquipment(equipmentId, copy);
        }
      }
    },
    [workingState.equipment, workingState.graphics, actions]
  );

  const handleDeleteEquipment = useCallback(
    async (id) => {
      if (USE_HIERARCHY_API && isBackendSiteId(site)) {
        setHierarchyMutationError(null);
        try {
          await hierarchyRepository.deleteEquipment(id);
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
          setSelectedEquipmentId(null);
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const next = (workingState.equipment || []).filter((e) => e.id !== id);
      actions.setEquipment(next);
      setSelectedEquipmentId(null);
    },
    [workingState.equipment, actions, site]
  );

  const handleAddChild = useCallback(
    async (node) => {
      if (node?.type === "site") handleAddBuilding();
      else if (node?.type === "building") {
        if (USE_HIERARCHY_API && isBackendSiteId(site)) {
          setHierarchyMutationError(null);
          try {
            await hierarchyRepository.createFloor(node.id, {
              name: `Floor ${(node.children || []).length + 1}`,
            });
            const payload = await engineeringRepository.fetchWorkingVersion(site);
            if (payload) {
              actions.setSite(payload.site);
              actions.setEquipment(payload.equipment);
            }
            engineeringRepository.notifyEngineeringHierarchyChanged();
          } catch (e) {
            setHierarchyMutationError(e?.message || String(e));
          }
          return;
        }
        const id = generateId();
        const floor = {
          id,
          type: "floor",
          name: `Floor ${(node.children || []).length + 1}`,
          parentId: node.id,
          sortOrder: (node.children || []).length,
          children: [],
        };
        const newTree = updateNodeInTree(siteTree, node.id, {
          children: [...(node.children || []), floor],
        });
        const newSite = siteTreeToWorkingSite(newTree);
        if (newSite) actions.setSite(newSite);
        setExpandedIds((prev) => new Set([...prev, node.id]));
        setSelectedId(id);
      }
    },
    [handleAddBuilding, siteTree, actions, site]
  );

  const handleValidate = useCallback(() => {
    const errors = validateStructure(siteTree);
    setValidationErrors(errors);
    setShowValidationToast(true);
  }, [siteTree]);

  const handleAddEquipment = useCallback(
    async (data) => {
      if (!selectedNode || selectedNode.type !== "floor") return;
      const floorId = data.floorId || selectedNode.id;
      if (USE_HIERARCHY_API && isBackendSiteId(site)) {
        setHierarchyMutationError(null);
        try {
          const code =
            (data.name && String(data.name).replace(/\s+/g, "_")) || `EQ-${Date.now()}`;
          const addr =
            data.address != null && String(data.address).trim() ? String(data.address).trim() : undefined;
          await hierarchyRepository.createEquipment(floorId, {
            name: data.name,
            code,
            equipmentType: data.equipmentType || "CUSTOM",
            ...(data.templateName ? { templateName: data.templateName } : {}),
            ...(addr ? { address: addr } : {}),
          });
          const payload = await engineeringRepository.fetchWorkingVersion(site);
          if (payload) {
            actions.setSite(payload.site);
            actions.setEquipment(payload.equipment);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged();
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        setShowAddEquipment(false);
        return;
      }
      const hasController = !!(data.controllerRef && String(data.controllerRef).trim());
      const status = hasController ? "CONTROLLER_ASSIGNED" : "MISSING_CONTROLLER";
      const mates = (workingState.equipment || []).filter((e) => e.floorId === floorId);
      const maxSort = mates.reduce(
        (m, e) => Math.max(m, typeof e.sortOrder === "number" ? e.sortOrder : -1),
        -1
      );
      const newEq = {
        id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        siteId: workingState.site?.id,
        buildingId: findBuildingIdForFloor(siteTree, floorId),
        floorId,
        name: data.name,
        displayLabel: data.displayLabel || data.name,
        type: data.equipmentType || "CUSTOM",
        instanceNumber: (data.instanceNumber && String(data.instanceNumber).trim()) || null,
        address: (data.address != null && String(data.address).trim()) ? String(data.address).trim() : null,
        locationLabel: (data.locationLabel != null && String(data.locationLabel).trim()) ? String(data.locationLabel).trim() : "",
        controllerRef: data.controllerRef || null,
        templateName: data.templateName || null,
        pointsDefined: 0,
        status,
        notes: data.notes || "",
        sortOrder: maxSort + 1,
      };
      actions.setEquipment([...(workingState.equipment || []), newEq]);
      setShowAddEquipment(false);
    },
    [selectedNode, workingState.site, workingState.equipment, actions, site, siteTree]
  );

  const handleExpandAll = useCallback(() => {
    if (!siteTree) return;
    const allIds = new Set();
    const collect = (n) => {
      if (n?.id) allIds.add(n.id);
      (n?.children || []).forEach(collect);
    };
    collect(siteTree);
    setExpandedIds(allIds);
  }, [siteTree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isEmpty = !siteTree;
  const openCreateModal = useCallback(() => setShowCreateModal(true), []);

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">Site Builder</h5>
          <div className="text-white-50 small">
            Define the physical structure of the site including buildings and floors.
          </div>
        </div>

        {USE_HIERARCHY_API && isBackendSiteId(site) && backendWorkingVersionLoading && (
          <div className="text-white-50 small mb-2">Loading site structure from server…</div>
        )}
        {(backendWorkingVersionError || hierarchyMutationError) && (
          <div className="alert alert-danger py-2 small mb-3" role="alert">
            {hierarchyMutationError || backendWorkingVersionError}
          </div>
        )}

        {showValidationToast && (
          <div
            className={`mb-3 p-3 rounded border ${
              validationErrors.length === 0
                ? "border-success border-opacity-50 bg-success bg-opacity-10"
                : "border-danger border-opacity-50 bg-danger bg-opacity-10"
            }`}
          >
            {validationErrors.length === 0 ? (
              <div className="text-success small fw-semibold">Structure is valid.</div>
            ) : (
              <div>
                <div className="text-danger small fw-semibold mb-2">Validation failed:</div>
                <ul className="mb-0 ps-3 text-white-50 small">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
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

        {isEmpty ? (
          <EmptySiteState onCreateSite={openCreateModal} />
        ) : (
          <>
            <div className="site-builder-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={handleValidate}
                >
                  Validate Structure
                </Button>
              </div>
              <div className="site-builder-toolbar-divider" />
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={handleAddBuilding}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Building
                </Button>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => selectedNode && handleAddChild(selectedNode)}
                  disabled={!selectedNode || selectedNode.type !== "building"}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Floor
                </Button>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => setShowAddEquipment(true)}
                  disabled={!selectedNode || selectedNode.type !== "floor"}
                >
                  <FontAwesomeIcon icon={faBoxOpen} className="me-1" /> Add Equipment
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
                  <Dropdown.Item className="text-white" onClick={handleExpandAll}>
                    <FontAwesomeIcon icon={faExpandAlt} className="me-2" /> Expand All
                  </Dropdown.Item>
                  <Dropdown.Item className="text-white" onClick={handleCollapseAll}>
                    <FontAwesomeIcon icon={faCompressAlt} className="me-2" /> Collapse All
                  </Dropdown.Item>
                  <Dropdown.Divider className="border-light border-opacity-10" />
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileImport} className="me-2" /> Import Mock Site
                  </Dropdown.Item>
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileExport} className="me-2" /> Export Structure
                  </Dropdown.Item>
                  <Dropdown.Divider className="border-light border-opacity-10" />
                  <Dropdown.Item className="text-danger">
                    <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete Site
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span className="text-white-50 small ms-1">
                {!selectedNode
                  ? "Select a node to edit."
                  : selectedNode?.type === "building"
                    ? "Click Edit or select a node to edit."
                    : selectedNode?.type === "site"
                      ? "Add a building to get started."
                      : ""}
              </span>
            </div>

            <Row className="g-3 align-items-start">
              <Col xs={12} lg={8} xl={9}>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                  <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between">
                    <span className="text-white fw-bold">
                      <FontAwesomeIcon icon={faSitemap} className="me-2" />
                      Site Hierarchy
                    </span>
                  </Card.Header>
                  <Card.Body className="p-0 overflow-auto" style={{ minHeight: 320 }}>
                    <SiteTree
                      site={siteTree}
                      expandedIds={expandedIds}
                      selectedId={selectedId}
                      selectedEquipmentId={selectedEquipmentId}
                      onToggleExpand={toggleExpand}
                      onSelect={handleSelectNode}
                      onSelectEquipment={handleSelectEquipment}
                      onAddChild={handleAddChild}
                      onAddEquipment={(node) => {
                        handleSelectNode(node);
                        setShowAddEquipment(true);
                      }}
                      onEdit={(node) => handleSelectNode(node)}
                      onDelete={handleDeleteFromTree}
                      onReorderEquipment={handleReorderEquipment}
                      onSortFloorEquipment={handleSortFloorEquipment}
                      onDuplicateEquipment={handleDuplicateEquipment}
                    />
                  </Card.Body>
                </Card>
              </Col>

              <Col xs={12} lg={4} xl={3} className="align-self-start site-builder-editor-col">
                <NodeEditorPanel
                  node={selectedEquipment ? null : selectedNode}
                  selectedEquipment={selectedEquipment}
                  breadcrumb={breadcrumb}
                  floors={treeToFlatData(siteTree).floors}
                  onSave={handleSaveNode}
                  onSaveEquipment={handleSaveEquipment}
                  onDelete={handleDeleteNode}
                  onDeleteEquipment={handleDeleteEquipment}
                  onDeleteConfirm={handleDeleteConfirm}
                  equipmentTemplates={workingState.templates?.equipmentTemplates ?? []}
                  existingInstanceNumbers={(workingState.equipment || [])
                    .filter((e) => e.id !== selectedEquipment?.id)
                    .map((e) => e.instanceNumber)
                    .filter(Boolean)}
                  graphics={workingState.graphics ?? {}}
                  graphicTemplates={workingState.templates?.graphicTemplates ?? []}
                  equipmentList={workingState.equipment ?? []}
                  onGraphicChange={handleGraphicChange}
                  discoveredDevices={workingState.discoveredDevices ?? []}
                  onDuplicateEquipment={handleDuplicateEquipment}
                  onMoveEquipment={(delta) =>
                    selectedEquipment ? handleMoveEquipment(selectedEquipment.id, delta) : undefined
                  }
                />
              </Col>
            </Row>
          </>
        )}
      </div>

      <CreateSiteModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onCreate={handleCreateSite}
      />

      <AddEquipmentModal
        show={showAddEquipment}
        onHide={() => setShowAddEquipment(false)}
        onCreate={handleAddEquipment}
        siteStructure={engineeringRepository.getEngineeringSiteStructureFromTree(siteTree)}
        defaultBuildingId={selectedNode?.type === "floor" ? selectedNode?.parentId : siteTree?.children?.[0]?.id}
        defaultFloorId={selectedNode?.type === "floor" ? selectedNode?.id : undefined}
        equipmentTemplates={workingState.templates?.equipmentTemplates ?? []}
      />

      <Modal
        centered
        show={!!deleteConfirmNode}
        onHide={() => setDeleteConfirmNode(null)}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Delete Node</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This node has children. Deleting it will remove all child nodes. Are you sure?
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={() => setDeleteConfirmNode(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmNode && handleDeleteNode(deleteConfirmNode.id)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
