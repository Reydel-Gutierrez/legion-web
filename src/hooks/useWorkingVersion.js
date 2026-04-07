/**
 * Hooks for the engineering working version and operator active release.
 */

import { useMemo, useState, useEffect } from "react";
import { useEngineeringVersionContext } from "../app/providers/EngineeringVersionProvider";
import { useSite } from "../app/providers/SiteProvider";
import { WORKING_VERSION_ACTIONS } from "../modules/engineering/working-version/workingVersionReducer";
import { getMappingsForEquipment } from "../modules/engineering/working-version/workingVersionModel";
import { ensureNetworkConfig } from "../modules/engineering/network/networkConfigModel";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { sortEquipmentForDisplay } from "../modules/engineering/site-builder/siteBuilderEquipmentUtils";
import { isBackendSiteId } from "../lib/data/siteIdUtils";
import * as operatorRepository from "../lib/data/repositories/operatorRepository";
import { toActiveRelease } from "../modules/engineering/working-version/workingVersionTransforms";

function workingDataFromVersion(workingVersion) {
  return workingVersion?.data ?? {};
}

export function useWorkingVersion() {
  const {
    workingVersion,
    workingState,
    dispatch,
    deployWorkingVersion,
    backendWorkingVersionLoading,
    backendWorkingVersionError,
    backendWorkingVersionSynced,
  } = useEngineeringVersionContext();

  const actions = useMemo(
    () => ({
      setSite: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_SITE, payload }),
      setTemplates: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_TEMPLATES, payload }),
      setEquipment: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_EQUIPMENT, payload }),
      setDiscoveredDevices: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_DISCOVERED_DEVICES, payload }),
      patchDiscoveredDevice: (deviceId, patch) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.PATCH_DISCOVERED_DEVICE, payload: { deviceId, patch } }),
      setDiscoveredObjects: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_DISCOVERED_OBJECTS, payload }),
      setDiscoveredObjectsForDevice: (deviceId, objects) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.SET_DISCOVERED_OBJECTS_FOR_DEVICE, payload: { deviceId, objects } }),
      setMappings: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_MAPPINGS, payload }),
      setMappingsForEquipment: (equipmentId, mappings) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.SET_MAPPINGS_FOR_EQUIPMENT, payload: { equipmentId, mappings } }),
      setGraphics: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_GRAPHICS, payload }),
      setGraphicForEquipment: (equipmentId, graphic) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.SET_GRAPHIC_FOR_EQUIPMENT, payload: { equipmentId, graphic } }),
      setGraphicForSiteLayout: (nodeId, graphic) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.SET_GRAPHIC_FOR_SITE_LAYOUT, payload: { nodeId, graphic } }),
      setValidation: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_VALIDATION, payload }),
      setReleaseHistory: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_RELEASE_HISTORY, payload }),
      setActiveReleaseMetadata: (payload) =>
        dispatch({ type: WORKING_VERSION_ACTIONS.SET_ACTIVE_RELEASE_METADATA, payload }),
      setNetworkConfig: (payload) => dispatch({ type: WORKING_VERSION_ACTIONS.SET_NETWORK_CONFIG, payload }),
      deployWorkingVersion: (options) => deployWorkingVersion(options),
    }),
    [dispatch, deployWorkingVersion]
  );

  return {
    workingVersion,
    workingState,
    actions,
    dispatch,
    backendWorkingVersionLoading,
    backendWorkingVersionError,
    backendWorkingVersionSynced,
  };
}

export function selectSite(workingVersion) {
  return workingDataFromVersion(workingVersion).site ?? null;
}

export function selectEquipmentTemplates(workingVersion) {
  return workingDataFromVersion(workingVersion).templates?.equipmentTemplates ?? [];
}

export function selectGraphicTemplates(workingVersion) {
  return workingDataFromVersion(workingVersion).templates?.graphicTemplates ?? [];
}

export function selectEquipment(workingVersion) {
  return workingDataFromVersion(workingVersion).equipment ?? [];
}

export function selectDiscoveredDevices(workingVersion) {
  return workingDataFromVersion(workingVersion).discoveredDevices ?? [];
}

export function selectDiscoveredObjects(workingVersion, deviceId) {
  const d = workingDataFromVersion(workingVersion);
  if (!d.discoveredObjects || deviceId == null) return [];
  return d.discoveredObjects[String(deviceId)] ?? [];
}

export function selectMappingsForEquipment(workingVersion, equipmentId) {
  return getMappingsForEquipment(workingDataFromVersion(workingVersion).mappings ?? {}, equipmentId);
}

export function selectGraphics(workingVersion) {
  return workingDataFromVersion(workingVersion).graphics ?? {};
}

export function selectGraphicForEquipment(workingVersion, equipmentId) {
  return (workingDataFromVersion(workingVersion).graphics ?? {})[equipmentId] ?? null;
}

export function selectSiteLayoutGraphics(workingVersion) {
  return workingDataFromVersion(workingVersion).siteLayoutGraphics ?? {};
}

export function selectSiteLayoutGraphic(workingVersion, nodeId) {
  return (workingDataFromVersion(workingVersion).siteLayoutGraphics ?? {})[nodeId] ?? null;
}

export function selectValidation(workingVersion) {
  return workingDataFromVersion(workingVersion).validation ?? null;
}

export function selectReleaseHistory(workingVersion) {
  return workingDataFromVersion(workingVersion).deploymentHistory ?? [];
}

export function selectActiveReleaseMetadata(workingVersion) {
  return workingDataFromVersion(workingVersion).activeDeploymentSnapshot ?? null;
}

export function selectNetworkConfig(workingVersion) {
  return ensureNetworkConfig(workingDataFromVersion(workingVersion) || {});
}

export function selectSiteTree(workingVersion) {
  const site = selectSite(workingVersion);
  if (!site) return null;
  const equipment = selectEquipment(workingVersion);
  const siteId = site.id;
  const siteNode = {
    id: siteId,
    type: "site",
    name: site.name,
    siteType: site.siteType,
    timezone: site.timezone,
    description: site.description,
    displayLabel: site.displayLabel || site.name,
    engineeringNotes: site.engineeringNotes,
    icon: site.icon,
    status: site.nodeStatus || "Active",
    parentId: null,
    children: (site.buildings || []).map((b) => {
      const bldgNode = {
        id: b.id,
        type: "building",
        name: b.name,
        buildingType: b.buildingType,
        buildingCode: b.buildingCode,
        address: b.address,
        city: b.city,
        state: b.state,
        lat: b.lat,
        lng: b.lng,
        status: b.status,
        sortOrder: b.sortOrder ?? 0,
        parentId: siteId,
        children: (b.floors || []).map((f) => {
          const floorEq = sortEquipmentForDisplay(equipment.filter((e) => e.floorId === f.id));
          return {
            id: f.id,
            type: "floor",
            name: f.name,
            floorType: f.floorType,
            occupancyType: f.occupancyType,
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

export function siteTreeToWorkingSite(siteTree) {
  if (!siteTree || siteTree.type !== "site") return null;
  return {
    id: siteTree.id,
    name: siteTree.name,
    mode: "working",
    status: "editing",
    nodeStatus: siteTree.status || "Active",
    siteType: siteTree.siteType,
    timezone: siteTree.timezone,
    displayLabel: siteTree.displayLabel || siteTree.name,
    description: siteTree.description,
    engineeringNotes: siteTree.engineeringNotes,
    icon: siteTree.icon,
    buildings: (siteTree.children || []).map((b) => ({
      id: b.id,
      name: b.name,
      buildingType: b.buildingType,
      buildingCode: b.buildingCode,
      address: b.address,
      city: b.city,
      state: b.state,
      lat: b.lat,
      lng: b.lng,
      status: b.status,
      sortOrder: b.sortOrder ?? 0,
      floors: (b.children || []).map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder ?? 0,
        floorType: f.floorType,
        occupancyType: f.occupancyType,
      })),
    })),
  };
}

export function selectEquipmentByFloor(workingVersion, floorId) {
  return selectEquipment(workingVersion).filter((e) => e.floorId === floorId);
}

export function useWorkingVersionSelectors() {
  const { workingVersion } = useEngineeringVersionContext();
  return useMemo(
    () => ({
      site: selectSite(workingVersion),
      equipmentTemplates: selectEquipmentTemplates(workingVersion),
      graphicTemplates: selectGraphicTemplates(workingVersion),
      equipment: selectEquipment(workingVersion),
      discoveredDevices: selectDiscoveredDevices(workingVersion),
      discoveredObjectsForDevice: (deviceId) => selectDiscoveredObjects(workingVersion, deviceId),
      mappingsForEquipment: (equipmentId) => selectMappingsForEquipment(workingVersion, equipmentId),
      graphics: selectGraphics(workingVersion),
      graphicForEquipment: (equipmentId) => selectGraphicForEquipment(workingVersion, equipmentId),
      validation: selectValidation(workingVersion),
      releaseHistory: selectReleaseHistory(workingVersion),
      activeReleaseMetadata: selectActiveReleaseMetadata(workingVersion),
      networkConfig: selectNetworkConfig(workingVersion),
      siteTree: selectSiteTree(workingVersion),
    }),
    [workingVersion]
  );
}

/**
 * Active release for the current site (Operator Mode). `activeRelease.data` matches the former deployment snapshot shape.
 */
export function useActiveRelease() {
  const { site } = useSite();
  const { activeReleaseBySite } = useEngineeringVersionContext();
  const [apiSnapshot, setApiSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const fromStore = activeReleaseBySite?.[site] ?? null;
  const useApi = USE_HIERARCHY_API && isBackendSiteId(site);

  useEffect(() => {
    if (!useApi) {
      setApiSnapshot(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    operatorRepository
      .fetchActiveRelease(site)
      .then((snap) => {
        if (!cancelled) {
          setApiSnapshot(snap);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setApiSnapshot(null);
          setLoading(false);
          setError(e?.message || String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [site, useApi, refreshTick]);

  useEffect(() => {
    if (!USE_HIERARCHY_API) return undefined;
    const onRefresh = (ev) => {
      const changedSite = ev?.detail?.siteId;
      if (changedSite != null && changedSite !== site) return;
      setRefreshTick((t) => t + 1);
    };
    window.addEventListener("legion-api-hierarchy-changed", onRefresh);
    return () => window.removeEventListener("legion-api-hierarchy-changed", onRefresh);
  }, [site]);

  return useMemo(() => {
    if (useApi) {
      return {
        activeRelease: apiSnapshot ? toActiveRelease(site, apiSnapshot) : null,
        loading,
        error,
      };
    }
    return {
      activeRelease: fromStore ? toActiveRelease(site, fromStore) : null,
      loading: false,
      error: null,
    };
  }, [useApi, apiSnapshot, fromStore, site, loading, error]);
}

/**
 * Operator active deployment from backend active release (or mock store when API is off).
 * @returns {{ deployment: object | null, version: string | null, loading: boolean, error: string | null }}
 */
export function useActiveDeployment() {
  const { activeRelease, loading, error } = useActiveRelease();
  return useMemo(
    () => ({
      deployment: activeRelease?.data ?? null,
      version: activeRelease?.versionNumber ?? null,
      loading,
      error,
    }),
    [activeRelease, loading, error]
  );
}
