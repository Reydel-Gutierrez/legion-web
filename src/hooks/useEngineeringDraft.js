/**
 * Hook and helpers for reading/updating the central engineering draft.
 * Pages consume shared state via this hook; no isolated duplicate mock state.
 */

import { useMemo } from "react";
import { useDraftContext } from "../app/providers/EngineeringDraftProvider";
import { useSite } from "../app/providers/SiteProvider";
import { DRAFT_ACTIONS } from "../modules/engineering/draft/draftReducer";
import { getMappingsForEquipment } from "../modules/engineering/draft/draftModel";

// ---------------------------------------------------------------------------
// useEngineeringDraft — main hook
// ---------------------------------------------------------------------------

export function useEngineeringDraft() {
  const { draft, dispatch, deployDraftConfiguration } = useDraftContext();

  const actions = useMemo(
    () => ({
      setSite: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_SITE, payload }),
      setTemplates: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_TEMPLATES, payload }),
      setEquipment: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_EQUIPMENT, payload }),
      setDiscoveredDevices: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_DISCOVERED_DEVICES, payload }),
      setDiscoveredObjects: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_DISCOVERED_OBJECTS, payload }),
      setDiscoveredObjectsForDevice: (deviceId, objects) =>
        dispatch({ type: DRAFT_ACTIONS.SET_DISCOVERED_OBJECTS_FOR_DEVICE, payload: { deviceId, objects } }),
      setMappings: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_MAPPINGS, payload }),
      setMappingsForEquipment: (equipmentId, mappings) =>
        dispatch({ type: DRAFT_ACTIONS.SET_MAPPINGS_FOR_EQUIPMENT, payload: { equipmentId, mappings } }),
      setGraphics: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_GRAPHICS, payload }),
      setGraphicForEquipment: (equipmentId, graphic) =>
        dispatch({ type: DRAFT_ACTIONS.SET_GRAPHIC_FOR_EQUIPMENT, payload: { equipmentId, graphic } }),
      setValidation: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_VALIDATION, payload }),
      setDeploymentHistory: (payload) => dispatch({ type: DRAFT_ACTIONS.SET_DEPLOYMENT_HISTORY, payload }),
      setActiveDeploymentSnapshot: (payload) =>
        dispatch({ type: DRAFT_ACTIONS.SET_ACTIVE_DEPLOYMENT_SNAPSHOT, payload }),
      deployDraftConfiguration: (options) => deployDraftConfiguration(options),
    }),
    [dispatch, deployDraftConfiguration]
  );

  return { draft, dispatch, actions };
}

// ---------------------------------------------------------------------------
// Selectors (pure helpers; can take draft as argument for use outside hook)
// ---------------------------------------------------------------------------

export function selectSite(draft) {
  return draft?.site ?? null;
}

export function selectEquipmentTemplates(draft) {
  return draft?.templates?.equipmentTemplates ?? [];
}

export function selectGraphicTemplates(draft) {
  return draft?.templates?.graphicTemplates ?? [];
}

export function selectEquipment(draft) {
  return draft?.equipment ?? [];
}

export function selectDiscoveredDevices(draft) {
  return draft?.discoveredDevices ?? [];
}

export function selectDiscoveredObjects(draft, deviceId) {
  if (!draft?.discoveredObjects || deviceId == null) return [];
  return draft.discoveredObjects[String(deviceId)] ?? [];
}

export function selectMappingsForEquipment(draft, equipmentId) {
  return getMappingsForEquipment(draft?.mappings ?? {}, equipmentId);
}

export function selectGraphics(draft) {
  return draft?.graphics ?? {};
}

export function selectGraphicForEquipment(draft, equipmentId) {
  return (draft?.graphics ?? {})[equipmentId] ?? null;
}

export function selectValidation(draft) {
  return draft?.validation ?? null;
}

export function selectDeploymentHistory(draft) {
  return draft?.deploymentHistory ?? [];
}

export function selectActiveDeploymentSnapshot(draft) {
  return draft?.activeDeploymentSnapshot ?? null;
}

/** Site tree for Site Builder: build from draft.site (buildings/floors) with equipment preview on floors */
export function selectSiteTree(draft) {
  const site = selectSite(draft);
  if (!site) return null;
  const equipment = selectEquipment(draft);
  const siteId = site.id;
  const siteNode = {
    id: siteId,
    type: "site",
    name: site.name,
    siteType: site.siteType,
    address: site.address,
    timezone: site.timezone,
    parentId: null,
    children: (site.buildings || []).map((b) => {
      const bldgNode = {
        id: b.id,
        type: "building",
        name: b.name,
        buildingType: b.buildingType,
        buildingCode: b.buildingCode,
        parentId: siteId,
        children: (b.floors || []).map((f) => {
          const floorEq = equipment.filter((e) => e.floorId === f.id);
          return {
            id: f.id,
            type: "floor",
            name: f.name,
            floorType: f.floorType,
            sortOrder: f.sortOrder ?? 0,
            parentId: b.id,
            equipmentCount: floorEq.length,
            equipmentPreview: floorEq,
            children: [],
          };
        }),
      };
      return bldgNode;
    }),
  };
  return siteNode;
}

/** Convert site tree (from Site Builder UI) back to draft site shape for setSite */
export function siteTreeToDraftSite(siteTree) {
  if (!siteTree || siteTree.type !== "site") return null;
  return {
    id: siteTree.id,
    name: siteTree.name,
    mode: "draft",
    status: "editing",
    siteType: siteTree.siteType,
    address: siteTree.address,
    timezone: siteTree.timezone,
    buildings: (siteTree.children || []).map((b) => ({
      id: b.id,
      name: b.name,
      buildingType: b.buildingType,
      buildingCode: b.buildingCode,
      floors: (b.children || []).map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder ?? 0,
        floorType: f.floorType,
      })),
    })),
  };
}

/** Equipment for a given floor */
export function selectEquipmentByFloor(draft, floorId) {
  return selectEquipment(draft).filter((e) => e.floorId === floorId);
}

// ---------------------------------------------------------------------------
// useDraftSelectors — optional hook that returns selectors bound to current draft
// ---------------------------------------------------------------------------

export function useDraftSelectors() {
  const { draft } = useDraftContext();
  return useMemo(
    () => ({
      site: selectSite(draft),
      equipmentTemplates: selectEquipmentTemplates(draft),
      graphicTemplates: selectGraphicTemplates(draft),
      equipment: selectEquipment(draft),
      discoveredDevices: selectDiscoveredDevices(draft),
      discoveredObjectsForDevice: (deviceId) => selectDiscoveredObjects(draft, deviceId),
      mappingsForEquipment: (equipmentId) => selectMappingsForEquipment(draft, equipmentId),
      graphics: selectGraphics(draft),
      graphicForEquipment: (equipmentId) => selectGraphicForEquipment(draft, equipmentId),
      validation: selectValidation(draft),
      deploymentHistory: selectDeploymentHistory(draft),
      activeDeploymentSnapshot: selectActiveDeploymentSnapshot(draft),
      siteTree: selectSiteTree(draft),
    }),
    [draft]
  );
}

/**
 * Returns the active deployed configuration for the current site.
 * Operator pages must use this instead of mock data.
 * Returns null if site has no deployment yet (e.g. New Site).
 */
export function useActiveDeployment() {
  const { site } = useSite();
  const { activeDeploymentBySite } = useDraftContext();
  return activeDeploymentBySite?.[site] ?? null;
}
