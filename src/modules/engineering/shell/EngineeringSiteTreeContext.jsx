import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion, selectSiteTree, siteTreeToWorkingSite } from "../../../hooks/useWorkingVersion";
import { engineeringRepository } from "../../../lib/data";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../../lib/data/siteApiResolution";
import { isLocalArchiveSiteKey } from "../../../lib/data/archiveConstants";
import { setSiteLocation } from "../../../lib/data/persistence/siteLocationStore";
import * as hierarchyRepository from "../../../lib/data/repositories/hierarchyRepository";
import { WORKING_VERSION_ACTIONS } from "../working-version/workingVersionReducer";
import { normalizeWorkingVersionNetworkConfig } from "../network/networkConfigModel";
import {
  generateId,
  findNodeById,
  updateNodeInTree,
  deleteNodeFromTree,
  collectFloorIdsUnder,
} from "../site-builder/utils/siteTreeUtils";
import {
  reorderAfterDrag,
  sortEquipmentOnFloorByField,
  moveEquipmentRelative,
  insertDuplicateAfterSource,
  getEquipmentOrderedForSiteWide,
  buildSequentialValueFormatter,
  toApiEquipmentUpdatePayload,
  resolveNetworkProtocolForControllerRef,
} from "../site-builder/siteBuilderEquipmentUtils";
import { appNotify, appLogger, withEngineeringAction } from "../../../lib/app-activity";

const EngineeringSiteTreeContext = createContext(null);

/** Apply full GET/PUT working-version payload so hierarchy fields (e.g. instance #) stay in sync with the API. */
function resetWorkingVersionFromApiPayload(dispatch, siteKey, payload) {
  if (!payload) return;
  dispatch({
    type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
    payload: normalizeWorkingVersionNetworkConfig(payload, siteKey),
  });
}

function flattenTree(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flattenTree(c, acc));
  return acc;
}

function getNodeBreadcrumb(node, site) {
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

function findBuildingIdForFloor(siteTree, floorId) {
  if (!siteTree || !floorId) return null;
  for (const b of siteTree.children || []) {
    if ((b.children || []).some((f) => f.id === floorId)) return b.id;
  }
  return null;
}

/** Reshapes the Engineering site tree + equipment list into Operator's facility-tree node shape (kind/label/children) so the sidebar can reuse FacilityTree/FacilityTreeNode directly. */
function buildEngineeringFacilityTree(siteTree, equipmentList) {
  if (!siteTree) return null;
  const equipmentByFloor = {};
  (equipmentList || []).forEach((eq) => {
    if (!eq.floorId) return;
    const key = String(eq.floorId);
    if (!equipmentByFloor[key]) equipmentByFloor[key] = [];
    equipmentByFloor[key].push(eq);
  });

  // Fixed settings entries under the site — always present once a site exists, not user-creatable
  // via the +/- controls. `type` (not just `kind`) is set so SiteBuilderPage's routing check works
  // even though these ids don't resolve to a real siteTree node (handleSelectFacilityNode falls back
  // to the raw facility node when findNodeById comes up empty).
  const settingsChildren = [
    { id: `${siteTree.id}::settings::general`, kind: "general", type: "general", label: "General", children: [] },
    { id: `${siteTree.id}::settings::network`, kind: "network", type: "network", label: "Network", children: [] },
    { id: `${siteTree.id}::settings::system`, kind: "system", type: "system", label: "System", children: [] },
  ];

  const buildings = (siteTree.children || []).map((b) => ({
    id: String(b.id),
    kind: "building",
    label: b.name || "Building",
    children: (b.children || []).map((f) => ({
      id: String(f.id),
      kind: "floor",
      label: f.displayLabel || f.name || "Floor",
      buildingId: String(b.id),
      children: (equipmentByFloor[String(f.id)] || []).map((eq) => ({
        id: String(eq.id),
        kind: "equipment",
        label: eq.displayLabel || eq.name || String(eq.id),
        type: eq.type || eq.equipmentType || "",
        floorId: String(f.id),
        buildingId: String(b.id),
        children: [],
      })),
    })),
  }));

  return {
    id: String(siteTree.id),
    kind: "site",
    label: siteTree.name || "Site",
    children: [...settingsChildren, ...buildings],
  };
}

function generateEquipmentId() {
  return `eq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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

export function EngineeringSiteTreeProvider({ children }) {
  const { site, setSite, apiSites } = useSite();
  const {
    workingVersion,
    workingState,
    actions,
    dispatch,
    backendWorkingVersionLoading,
    backendWorkingVersionError,
  } = useWorkingVersion();

  /** UUID for hierarchy API — sidebar may hold a display name while working state has the real id. */
  const siteApiId = useMemo(() => {
    if (isBackendSiteId(workingState.site?.id)) return workingState.site.id;
    const coerced = coerceSiteKeyToApiId(site, apiSites);
    if (coerced) return coerced;
    return isBackendSiteId(site) ? site : null;
  }, [site, apiSites, workingState.site?.id]);

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
  const [selectedSettingsSection, setSelectedSettingsSection] = useState(null);
  const [hierarchyMutationError, setHierarchyMutationError] = useState(null);
  const [generateModalField, setGenerateModalField] = useState(null);
  const [generateStartInput, setGenerateStartInput] = useState("");
  const [generateApplying, setGenerateApplying] = useState(false);

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
    : getNodeBreadcrumb(selectedNode, siteTree);

  const facilityTree = useMemo(
    () => buildEngineeringFacilityTree(siteTree, equipmentList),
    [siteTree, equipmentList]
  );
  const selectedFacilityId = selectedEquipmentId || selectedId;

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
      // Local archives (legion_archive_* keys) always persist locally, even with the hierarchy API
      // on — routing them through hierarchyRepository.createSite would abandon the archive entirely
      // by switching `site` to a brand-new backend id.
      if (USE_HIERARCHY_API && !isLocalArchiveSiteKey(site)) {
        setHierarchyMutationError(null);
        try {
          await withEngineeringAction({
            area: "Site Builder",
            action: "Create site",
            infoMessage: "Creating site...",
            successMessage: "Site created successfully",
            errorMessage: "Failed to create site",
            run: async () => {
              const created = await hierarchyRepository.createSite({ name: data.name.trim() });
              if (data.description || data.timezone) {
                await hierarchyRepository.updateSite(created.id, {
                  name: data.name.trim(),
                  timezone: data.timezone || null,
                  description: data.description || null,
                });
              }
              if (data.location) {
                setSiteLocation(created.id, data.location);
              }
              const payload = await engineeringRepository.fetchWorkingVersion(created.id);
              if (payload) {
                resetWorkingVersionFromApiPayload(dispatch, created.id, payload);
              }
              setExpandedIds(new Set());
              setSelectedId(null);
              setShowCreateModal(false);
              setSite(created.id);
              engineeringRepository.notifyEngineeringHierarchyChanged(created.id);
            },
          });
        } catch (e) {
          setHierarchyMutationError(e?.message || String(e));
        }
        return;
      }
      const siteId = generateId();
      const tree = {
        id: siteId,
        type: "site",
        name: data.name,
        description: data.description,
        timezone: data.timezone,
        parentId: null,
        children: [],
      };
      const newSite = siteTreeToWorkingSite(tree);
      if (newSite) actions.setSite(newSite);
      actions.setEquipment([]);
      if (data.location) {
        setSiteLocation(site, data.location);
      }
      setExpandedIds(new Set([siteId]));
      setSelectedId(siteId);
      setShowCreateModal(false);
    },
    [actions, setSite, dispatch, site]
  );

  const handleAddBuilding = useCallback(async () => {
    if (!siteTree || !workingState.site) return;
    if (USE_HIERARCHY_API && siteApiId) {
      setHierarchyMutationError(null);
      try {
        await hierarchyRepository.createBuilding(siteApiId, {
          name: `Building ${(siteTree.children || []).length + 1}`,
          addressLine1: "TBD",
          city: "—",
          state: "—",
          postalCode: "00000",
          country: "US",
        });
        const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
        if (payload) {
          resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
        }
        engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
  }, [siteTree, siteApiId, actions, dispatch]);

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
        siteApiId &&
        node &&
        (node.type === "site" || node.type === "building" || node.type === "floor")
      ) {
        setHierarchyMutationError(null);
        const nodeLabel = node.type === "site" ? "Site" : node.type === "building" ? "Building" : "Floor";
        try {
          await withEngineeringAction({
            area: "Site Builder",
            action: `Save ${nodeLabel}`,
            infoMessage: `Saving ${nodeLabel.toLowerCase()}...`,
            successMessage: `${nodeLabel} saved successfully`,
            errorMessage: `Failed to save ${nodeLabel.toLowerCase()}`,
            run: async () => {
              if (node.type === "site") {
                await hierarchyRepository.updateSite(siteApiId, {
                  name: form.name.trim(),
                  timezone: form.timezone != null && String(form.timezone).trim() ? String(form.timezone).trim() : null,
                  siteType: form.siteType != null && String(form.siteType).trim() ? String(form.siteType).trim() : null,
                  description: form.description != null && String(form.description).trim() ? String(form.description).trim() : null,
                  displayLabel: form.displayLabel != null && String(form.displayLabel).trim() ? String(form.displayLabel).trim() : null,
                  engineeringNotes:
                    form.engineeringNotes != null && String(form.engineeringNotes).trim()
                      ? String(form.engineeringNotes).trim()
                      : null,
                  icon: form.icon != null && String(form.icon).trim() ? String(form.icon).trim() : null,
                });
              } else if (node.type === "building") {
                await hierarchyRepository.updateBuilding(id, {
                  name: form.name.trim(),
                  addressLine1:
                    form.address != null && String(form.address).trim() ? String(form.address).trim() : "TBD",
                  city: form.city != null && String(form.city).trim() ? String(form.city).trim() : "—",
                  state: form.state != null && String(form.state).trim() ? String(form.state).trim() : "—",
                  postalCode: "00000",
                  country: "US",
                  latitude: parseCoord(form.lat),
                  longitude: parseCoord(form.lng),
                  buildingType: form.buildingType != null && String(form.buildingType).trim() ? String(form.buildingType).trim() : null,
                  buildingCode: form.buildingCode != null && String(form.buildingCode).trim() ? String(form.buildingCode).trim() : null,
                  sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 0,
                });
              } else {
                await hierarchyRepository.updateFloor(id, {
                  name: form.name.trim(),
                  displayLabel:
                    form.displayLabel != null && String(form.displayLabel).trim()
                      ? String(form.displayLabel).trim()
                      : null,
                  floorType: form.floorType != null && String(form.floorType).trim() ? String(form.floorType).trim() : null,
                  occupancyType:
                    form.occupancyType != null && String(form.occupancyType).trim() ? String(form.occupancyType).trim() : null,
                  sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 0,
                });
              }
              const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
              if (payload) {
                resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
              }
              engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
            },
          });
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
        ...(node.type === "site"
          ? { address: null }
          : { address: form.address }),
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
      const nodeLabel = node.type === "site" ? "Site" : node.type === "building" ? "Building" : "Floor";
      appNotify.success(`${nodeLabel} saved successfully`);
      appLogger.success(`${nodeLabel} saved successfully`, { area: "Site Builder", action: `Save ${nodeLabel}` });
    },
    [siteTree, actions, siteApiId, dispatch]
  );

  const handleDeleteNode = useCallback(
    async (id) => {
      if (!siteTree) return;
      const node = findNodeById(siteTree, id);
      if (USE_HIERARCHY_API && siteApiId && node && node.type !== "site") {
        setHierarchyMutationError(null);
        try {
          if (node.type === "building") {
            await hierarchyRepository.deleteBuilding(id);
          } else if (node.type === "floor") {
            await hierarchyRepository.deleteFloor(id);
          }
          const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
          if (payload) {
            resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
    [siteTree, workingState.equipment, selectedId, actions, siteApiId, dispatch]
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
    setSelectedSettingsSection(null);
  }, []);

  const handleSelectEquipment = useCallback((equipment) => {
    setSelectedEquipmentId(equipment?.id ?? null);
    setSelectedId(null);
    setSelectedSettingsSection(null);
  }, []);

  /** General/Network/System are fixed facility-tree leaves with no backing siteTree node — keep the
   * sidebar highlight (selectedId) working while routing the workspace off this dedicated field
   * instead of the (necessarily null) selectedNode. */
  const handleSelectSettingsSection = useCallback((section, id) => {
    setSelectedEquipmentId(null);
    setSelectedId(id ?? null);
    setSelectedSettingsSection(section);
  }, []);

  /** FacilityTree hands back its own {kind, id} node shape; resolve it to the real Engineering tree node or equipment record before selecting. */
  const handleSelectFacilityNode = useCallback(
    (node) => {
      if (!node) {
        handleSelectNode(null);
        return;
      }
      if (node.kind === "equipment") {
        const eq = equipmentList.find((e) => String(e.id) === String(node.id));
        handleSelectEquipment(eq || { id: node.id });
        return;
      }
      if (node.kind === "general" || node.kind === "network" || node.kind === "system") {
        handleSelectSettingsSection(node.kind, node.id);
        return;
      }
      const treeNode = siteTree ? findNodeById(siteTree, node.id) : null;
      handleSelectNode(treeNode || node);
    },
    [siteTree, equipmentList, handleSelectNode, handleSelectEquipment, handleSelectSettingsSection]
  );

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

      if (USE_HIERARCHY_API && siteApiId) {
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
          const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
          if (payload) {
            resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
    [equipmentList, actions, siteApiId, siteTree, workingState.mappings, workingState.graphics, dispatch]
  );

  const handleSaveEquipment = useCallback(
    async (id, form) => {
      if (USE_HIERARCHY_API && siteApiId) {
        setHierarchyMutationError(null);
        try {
          await withEngineeringAction({
            area: "Site Builder",
            action: "Save equipment",
            infoMessage: "Saving equipment...",
            successMessage: "Equipment saved successfully",
            errorMessage: "Failed to save equipment",
            run: async () => {
              const tmpl = form.templateName != null && String(form.templateName).trim() ? String(form.templateName).trim() : null;
              const addr = form.address != null && String(form.address).trim() ? String(form.address).trim() : null;
              const instanceNum =
                form.instanceNumber != null && String(form.instanceNumber).trim()
                  ? String(form.instanceNumber).trim()
                  : null;
              await hierarchyRepository.updateEquipment(id, {
                name: form.name,
                code: (form.displayLabel && String(form.displayLabel).trim()) || form.name,
                equipmentType: form.equipmentType,
                templateName: tmpl,
                address: addr,
                instanceNumber: instanceNum,
              });
              const protocol = resolveNetworkProtocolForControllerRef(
                workingState.discoveredDevices ?? [],
                form.controllerRef
              );
              await hierarchyRepository.syncEquipmentControllerAssignment(id, {
                controllerRef: form.controllerRef,
                protocol,
              });
              const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
              if (payload) {
                resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
              }
              engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
            },
          });
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
      appNotify.success("Equipment saved successfully");
      appLogger.success("Equipment saved successfully", { area: "Site Builder", action: "Save equipment" });
    },
    [workingState.equipment, workingState.discoveredDevices, actions, siteApiId, siteTree, dispatch]
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
      if (USE_HIERARCHY_API && siteApiId) {
        setHierarchyMutationError(null);
        try {
          await hierarchyRepository.deleteEquipment(id);
          const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
          if (payload) {
            resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
    [workingState.equipment, actions, siteApiId, dispatch]
  );

  const handleAddChild = useCallback(
    async (node) => {
      if (node?.type === "site") handleAddBuilding();
      else if (node?.type === "building") {
        if (USE_HIERARCHY_API && siteApiId) {
          setHierarchyMutationError(null);
          try {
            const nextSortOrder =
              (node.children || []).reduce(
                (max, f) => Math.max(max, typeof f.sortOrder === "number" ? f.sortOrder : -1),
                -1
              ) + 1;
            await hierarchyRepository.createFloor(node.id, {
              name: `Floor ${(node.children || []).length + 1}`,
              sortOrder: nextSortOrder,
            });
            const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
            if (payload) {
              resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
            }
            engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
    [handleAddBuilding, siteTree, actions, siteApiId, dispatch]
  );

  const handleValidate = useCallback(() => {
    const errors = validateStructure(siteTree);
    setValidationErrors(errors);
    setShowValidationToast(true);
  }, [siteTree]);

  const handleAddEquipment = useCallback(
    async (data) => {
      const floorId = data.floorId || (selectedNode?.type === "floor" ? selectedNode.id : null);
      if (!floorId) return;
      if (USE_HIERARCHY_API && siteApiId) {
        setHierarchyMutationError(null);
        try {
          const code =
            (data.name && String(data.name).replace(/\s+/g, "_")) || `EQ-${Date.now()}`;
          const addr =
            data.address != null && String(data.address).trim() ? String(data.address).trim() : undefined;
          const inst =
            data.instanceNumber != null && String(data.instanceNumber).trim()
              ? String(data.instanceNumber).trim()
              : undefined;
          const created = await hierarchyRepository.createEquipment(floorId, {
            name: data.name,
            code,
            equipmentType: data.equipmentType || "CUSTOM",
            ...(data.templateName ? { templateName: data.templateName } : {}),
            ...(addr ? { address: addr } : {}),
            ...(inst ? { instanceNumber: inst } : {}),
          });
          if (created?.id && data.controllerRef && String(data.controllerRef).trim()) {
            const protocol = resolveNetworkProtocolForControllerRef(
              workingState.discoveredDevices ?? [],
              data.controllerRef
            );
            await hierarchyRepository.syncEquipmentControllerAssignment(created.id, {
              controllerRef: data.controllerRef,
              protocol,
            });
          }
          const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
          if (payload) {
            resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
          }
          engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
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
    [
      selectedNode,
      workingState.site,
      workingState.equipment,
      workingState.discoveredDevices,
      actions,
      site,
      siteTree,
      dispatch,
    ]
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

  const closeGenerateModal = useCallback(() => {
    setGenerateModalField(null);
    setGenerateStartInput("");
  }, []);

  const handleApplyBulkGenerate = useCallback(async () => {
    if (!generateModalField || !siteTree) return;
    const list = workingState.equipment || [];
    if (!list.length) {
      closeGenerateModal();
      return;
    }
    const parsed = buildSequentialValueFormatter(generateStartInput);
    if (!parsed.ok) {
      window.alert(parsed.message);
      return;
    }
    const confirmMsg =
      generateModalField === "instanceNumber"
        ? "This will replace every instance number on this site with new sequential values. All current instance numbers will be overwritten. Continue?"
        : "This will replace every address # on this site with new sequential values. All current address values will be overwritten. Continue?";
    if (!window.confirm(confirmMsg)) return;

    const ordered = getEquipmentOrderedForSiteWide(siteTree, list);

    if (USE_HIERARCHY_API && siteApiId) {
      setHierarchyMutationError(null);
      setGenerateApplying(true);
      try {
        if (generateModalField === "instanceNumber") {
          for (const eqRow of ordered) {
            await hierarchyRepository.updateEquipment(
              eqRow.id,
              toApiEquipmentUpdatePayload(eqRow, { instanceNumber: null })
            );
          }
          for (let i = 0; i < ordered.length; i++) {
            const val = parsed.format(i);
            const eqRow = ordered[i];
            await hierarchyRepository.updateEquipment(
              eqRow.id,
              toApiEquipmentUpdatePayload(eqRow, { instanceNumber: val })
            );
          }
        } else {
          for (let i = 0; i < ordered.length; i++) {
            const val = parsed.format(i);
            const eqRow = ordered[i];
            await hierarchyRepository.updateEquipment(
              eqRow.id,
              toApiEquipmentUpdatePayload(eqRow, { address: val })
            );
          }
        }
        const payload = await engineeringRepository.fetchWorkingVersion(siteApiId);
        if (payload) {
          resetWorkingVersionFromApiPayload(dispatch, siteApiId, payload);
        }
        engineeringRepository.notifyEngineeringHierarchyChanged(siteApiId);
        closeGenerateModal();
      } catch (e) {
        setHierarchyMutationError(e?.message || String(e));
      } finally {
        setGenerateApplying(false);
      }
      return;
    }

    const orderIndexById = new Map(ordered.map((e, i) => [e.id, i]));
    const next = list.map((e) => {
      const idx = orderIndexById.get(e.id);
      if (idx === undefined) return e;
      const val = parsed.format(idx);
      if (generateModalField === "instanceNumber") return { ...e, instanceNumber: val };
      return { ...e, address: val };
    });
    actions.setEquipment(next);
    closeGenerateModal();
  }, [
    generateModalField,
    generateStartInput,
    siteTree,
    workingState.equipment,
    site,
    actions,
    dispatch,
    closeGenerateModal,
  ]);

  const isEmpty = !siteTree;
  const openCreateModal = useCallback(() => setShowCreateModal(true), []);

  const openAddEquipment = useCallback(
    (node) => {
      if (node) handleSelectNode(node);
      setShowAddEquipment(true);
    },
    [handleSelectNode]
  );

  /** Delete whatever is currently selected — equipment deletes immediately, nodes go through the confirm-if-has-children flow. */
  const handleDeleteSelected = useCallback(() => {
    if (selectedEquipment) {
      handleDeleteEquipment(selectedEquipment.id);
    } else if (selectedNode && selectedNode.type !== "site") {
      handleDeleteFromTree(selectedNode);
    }
  }, [selectedEquipment, selectedNode, handleDeleteEquipment, handleDeleteFromTree]);

  const value = useMemo(
    () => ({
      siteTree,
      equipmentList,
      workingState,
      siteApiId,
      backendWorkingVersionLoading,
      backendWorkingVersionError,
      hierarchyMutationError,
      isEmpty,

      expandedIds,
      selectedId,
      selectedNode,
      selectedEquipmentId,
      selectedEquipment,
      selectedSettingsSection,
      breadcrumb,
      floors: treeToFlatData(siteTree).floors,
      facilityTree,
      selectedFacilityId,

      toggleExpand,
      handleSelectNode,
      handleSelectEquipment,
      handleSelectSettingsSection,
      handleSelectFacilityNode,
      handleAddChild,
      openAddEquipment,
      handleDeleteFromTree,
      handleDeleteSelected,
      handleReorderEquipment,
      handleSortFloorEquipment,
      handleDuplicateEquipment,
      handleExpandAll,
      handleCollapseAll,

      handleSaveNode,
      handleDeleteNode,
      handleDeleteConfirm,
      handleSaveEquipment,
      handleDeleteEquipment,
      handleGraphicChange,
      handleMoveEquipment,

      handleValidate,
      validationErrors,
      showValidationToast,
      setShowValidationToast,

      showCreateModal,
      openCreateModal,
      setShowCreateModal,
      handleCreateSite,

      showAddEquipment,
      setShowAddEquipment,
      handleAddEquipment,

      deleteConfirmNode,
      setDeleteConfirmNode,

      generateModalField,
      setGenerateModalField,
      generateStartInput,
      setGenerateStartInput,
      generateApplying,
      closeGenerateModal,
      handleApplyBulkGenerate,
    }),
    [
      siteTree,
      equipmentList,
      workingState,
      siteApiId,
      backendWorkingVersionLoading,
      backendWorkingVersionError,
      hierarchyMutationError,
      isEmpty,
      expandedIds,
      selectedId,
      selectedNode,
      selectedEquipmentId,
      selectedEquipment,
      selectedSettingsSection,
      breadcrumb,
      facilityTree,
      selectedFacilityId,
      toggleExpand,
      handleSelectNode,
      handleSelectEquipment,
      handleSelectSettingsSection,
      handleSelectFacilityNode,
      handleAddChild,
      openAddEquipment,
      handleDeleteFromTree,
      handleDeleteSelected,
      handleReorderEquipment,
      handleSortFloorEquipment,
      handleDuplicateEquipment,
      handleExpandAll,
      handleCollapseAll,
      handleSaveNode,
      handleDeleteNode,
      handleDeleteConfirm,
      handleSaveEquipment,
      handleDeleteEquipment,
      handleGraphicChange,
      handleMoveEquipment,
      handleValidate,
      validationErrors,
      showValidationToast,
      showCreateModal,
      openCreateModal,
      handleCreateSite,
      showAddEquipment,
      handleAddEquipment,
      deleteConfirmNode,
      generateModalField,
      generateStartInput,
      generateApplying,
      closeGenerateModal,
      handleApplyBulkGenerate,
    ]
  );

  return (
    <EngineeringSiteTreeContext.Provider value={value}>{children}</EngineeringSiteTreeContext.Provider>
  );
}

export function useEngineeringSiteTree() {
  const ctx = useContext(EngineeringSiteTreeContext);
  if (!ctx) {
    throw new Error("useEngineeringSiteTree must be used within an EngineeringSiteTreeProvider");
  }
  return ctx;
}
