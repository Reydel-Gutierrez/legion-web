/**
 * Engineering working version + active release per site.
 * Operator Mode reads activeRelease; Engineering Mode edits workingVersion.
 * Version history / selectors are deferred to a later phase (release list UI not implemented yet).
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import { useSite } from "./SiteProvider";
import workingVersionReducer, {
  getInitialWorkingVersionState,
  WORKING_VERSION_ACTIONS,
} from "../../modules/engineering/working-version/workingVersionReducer";
import { createSeedWorkingVersion } from "../../modules/engineering/working-version/workingVersionSeed";
import {
  createEmptyNetworkConfig,
  normalizeWorkingVersionNetworkConfig,
} from "../../modules/engineering/network/networkConfigModel";
import { buildFullDeploymentSnapshot } from "../../modules/engineering/working-version/deploymentSnapshot";
import { toWorkingVersion } from "../../modules/engineering/working-version/workingVersionTransforms";
import { SITE_IDS } from "../../lib/sites";
import { isBackendSiteId } from "../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../lib/data/siteApiResolution";
import {
  loadAllActiveReleases,
  saveWorkingVersionForSite,
  saveActiveReleaseForSite,
  loadWorkingVersionForSite,
} from "../../lib/data/persistence/engineeringVersionPersistence";
import {
  notifyEngineeringHierarchyChanged,
  fetchWorkingVersion,
  saveWorkingVersion,
  fetchSiteVersionSummary,
} from "../../lib/data/repositories/engineeringRepository";
import { USE_HIERARCHY_API } from "../../lib/data/config";

const EngineeringVersionContext = createContext(null);

function getInitialActiveReleasesMap() {
  if (USE_HIERARCHY_API) {
    return {};
  }
  const miamiSeed = createSeedWorkingVersion("Miami HQ");
  const snapshot = buildFullDeploymentSnapshot(miamiSeed, {
    version: miamiSeed.activeDeploymentSnapshot?.version ?? "v12",
    lastDeployedAt: miamiSeed.activeDeploymentSnapshot?.lastDeployedAt ?? "2026-03-09T21:45:00.000Z",
    deployedBy: miamiSeed.activeDeploymentSnapshot?.deployedBy ?? "Reydel Gutierrez",
    systemStatus: miamiSeed.activeDeploymentSnapshot?.systemStatus ?? "Running",
  });
  const brightlineSeed = createSeedWorkingVersion(SITE_IDS.BRIGHTLINE);
  const brightlineSnapshot = buildFullDeploymentSnapshot(brightlineSeed, {
    version: brightlineSeed.activeDeploymentSnapshot?.version ?? "v1",
    lastDeployedAt: brightlineSeed.activeDeploymentSnapshot?.lastDeployedAt ?? "2026-03-15T18:00:00.000Z",
    deployedBy: brightlineSeed.activeDeploymentSnapshot?.deployedBy ?? "Reydel Gutierrez",
    systemStatus: brightlineSeed.activeDeploymentSnapshot?.systemStatus ?? "Running",
  });
  const fromStorage = loadAllActiveReleases();
  return {
    [SITE_IDS.MIAMI_HQ]: fromStorage[SITE_IDS.MIAMI_HQ] != null ? fromStorage[SITE_IDS.MIAMI_HQ] : snapshot,
    [SITE_IDS.BRIGHTLINE]: fromStorage[SITE_IDS.BRIGHTLINE] != null ? fromStorage[SITE_IDS.BRIGHTLINE] : brightlineSnapshot,
    [SITE_IDS.NEW_SITE]: fromStorage[SITE_IDS.NEW_SITE] != null ? fromStorage[SITE_IDS.NEW_SITE] : null,
    ...fromStorage,
  };
}

export function EngineeringVersionProvider({ children }) {
  const { site, apiSites } = useSite();
  /** UUID for API calls when localStorage still has a display name like "Sunset Strip Plaza". */
  const siteKeyForApi = useMemo(() => {
    const c = coerceSiteKeyToApiId(site, apiSites);
    if (c) return c;
    return isBackendSiteId(site) ? site : null;
  }, [site, apiSites]);
  const [workingState, dispatch] = useReducer(workingVersionReducer, site, getInitialWorkingVersionState);
  const [activeReleaseBySite, setActiveReleaseBySite] = React.useState(getInitialActiveReleasesMap);
  const [backendWorkingVersionLoading, setBackendWorkingVersionLoading] = React.useState(false);
  const [backendWorkingVersionError, setBackendWorkingVersionError] = React.useState(null);
  /** True only after a successful GET working-version for this site (avoids PUT empty payload over DB). */
  const [backendWorkingVersionSynced, setBackendWorkingVersionSynced] = React.useState(false);
  const saveTimeoutRef = useRef(null);
  const backendApiSaveTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const workingVersion = useMemo(() => toWorkingVersion(site, workingState), [site, workingState]);

  useEffect(() => {
    isMountedRef.current = true;
    if (USE_HIERARCHY_API && (site === SITE_IDS.NEW_SITE || site === "New Building")) {
      const stored = loadWorkingVersionForSite(SITE_IDS.NEW_SITE) || loadWorkingVersionForSite("New Building");
      const raw = stored || getInitialWorkingVersionState(SITE_IDS.NEW_SITE);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (!USE_HIERARCHY_API && site === SITE_IDS.MIAMI_HQ) {
      const stored = loadWorkingVersionForSite(SITE_IDS.MIAMI_HQ);
      const raw =
        stored && (stored.site || (stored.equipment && stored.equipment.length > 0))
          ? stored
          : getInitialWorkingVersionState(SITE_IDS.MIAMI_HQ);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (!USE_HIERARCHY_API && site === SITE_IDS.BRIGHTLINE) {
      const stored = loadWorkingVersionForSite(SITE_IDS.BRIGHTLINE);
      const raw =
        stored && (stored.site || (stored.equipment && stored.equipment.length > 0))
          ? stored
          : getInitialWorkingVersionState(SITE_IDS.BRIGHTLINE);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (!USE_HIERARCHY_API && (site === SITE_IDS.NEW_SITE || site === "New Building")) {
      const stored = loadWorkingVersionForSite(SITE_IDS.NEW_SITE) || loadWorkingVersionForSite("New Building");
      const raw = stored || getInitialWorkingVersionState(SITE_IDS.NEW_SITE);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (siteKeyForApi && USE_HIERARCHY_API) {
      const emptyPayload = {
        site: null,
        templates: { equipmentTemplates: [], graphicTemplates: [] },
        equipment: [],
        discoveredDevices: [],
        discoveredObjects: {},
        mappings: {},
        graphics: {},
        siteLayoutGraphics: {},
        networkConfig: createEmptyNetworkConfig(),
        validation: null,
        deploymentHistory: [],
        activeDeploymentSnapshot: null,
      };
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(emptyPayload, siteKeyForApi),
      });
    } else if (isBackendSiteId(site) && !USE_HIERARCHY_API) {
      const emptyPayload = {
        site: null,
        templates: { equipmentTemplates: [], graphicTemplates: [] },
        equipment: [],
        discoveredDevices: [],
        discoveredObjects: {},
        mappings: {},
        graphics: {},
        siteLayoutGraphics: {},
        networkConfig: createEmptyNetworkConfig(),
        validation: null,
        deploymentHistory: [],
        activeDeploymentSnapshot: null,
      };
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(emptyPayload, site),
      });
    } else if (USE_HIERARCHY_API) {
      const emptyPayload = {
        site: null,
        templates: { equipmentTemplates: [], graphicTemplates: [] },
        equipment: [],
        discoveredDevices: [],
        discoveredObjects: {},
        mappings: {},
        graphics: {},
        siteLayoutGraphics: {},
        networkConfig: createEmptyNetworkConfig(),
        validation: null,
        deploymentHistory: [],
        activeDeploymentSnapshot: null,
      };
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(emptyPayload, site),
      });
    } else {
      const stored = loadWorkingVersionForSite(site);
      const currentSiteName = workingState?.site?.name;
      const hasContent = workingState?.site || (Array.isArray(workingState?.equipment) && workingState.equipment.length > 0);
      if (currentSiteName === site && hasContent) {
        return;
      }
      const emptyPayload = {
        site: null,
        templates: { equipmentTemplates: [], graphicTemplates: [] },
        equipment: [],
        discoveredDevices: [],
        discoveredObjects: {},
        mappings: {},
        graphics: {},
        siteLayoutGraphics: {},
        networkConfig: createEmptyNetworkConfig(),
        validation: null,
        deploymentHistory: [],
        activeDeploymentSnapshot: null,
      };
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(stored || emptyPayload, site),
      });
    }
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, siteKeyForApi]);

  useEffect(() => {
    if (!USE_HIERARCHY_API || !siteKeyForApi) {
      setBackendWorkingVersionLoading(false);
      setBackendWorkingVersionError(null);
      setBackendWorkingVersionSynced(false);
      return undefined;
    }
    let cancelled = false;
    setBackendWorkingVersionLoading(true);
    setBackendWorkingVersionError(null);
    setBackendWorkingVersionSynced(false);
    fetchWorkingVersion(siteKeyForApi)
      .then((state) => {
        if (cancelled) return;
        if (!state) {
          setBackendWorkingVersionError("No working version payload from server.");
          setBackendWorkingVersionSynced(false);
          return;
        }
        dispatch({
          type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
          payload: normalizeWorkingVersionNetworkConfig(state, siteKeyForApi),
        });
        setBackendWorkingVersionSynced(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setBackendWorkingVersionError(e?.message || String(e));
          setBackendWorkingVersionSynced(false);
        }
      })
      .finally(() => {
        if (!cancelled) setBackendWorkingVersionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteKeyForApi]);

  useEffect(() => {
    if (!site) return;
    if (siteKeyForApi) return;
    if (
      USE_HIERARCHY_API &&
      site !== SITE_IDS.NEW_SITE &&
      site !== "New Building"
    ) {
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      if (isMountedRef.current) {
        saveWorkingVersionForSite(site, workingState);
        if (workingState?.site?.name && workingState.site.name !== site) {
          saveWorkingVersionForSite(workingState.site.name, workingState);
        }
      }
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [site, siteKeyForApi, workingState]);

  /** Persist full working payload to API for backend UUID sites (templates, mappings, etc.). */
  useEffect(() => {
    if (!USE_HIERARCHY_API || !siteKeyForApi) return;
    if (!backendWorkingVersionSynced || backendWorkingVersionLoading) return;
    if (backendApiSaveTimeoutRef.current) clearTimeout(backendApiSaveTimeoutRef.current);
    backendApiSaveTimeoutRef.current = setTimeout(() => {
      backendApiSaveTimeoutRef.current = null;
      if (!isMountedRef.current) return;
      saveWorkingVersion(siteKeyForApi, workingState)
        .then(() => notifyEngineeringHierarchyChanged(siteKeyForApi))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Failed to persist working version to API", err);
        });
    }, 800);
    return () => {
      if (backendApiSaveTimeoutRef.current) clearTimeout(backendApiSaveTimeoutRef.current);
    };
  }, [siteKeyForApi, workingState, backendWorkingVersionSynced, backendWorkingVersionLoading]);

  useEffect(() => {
    if (USE_HIERARCHY_API) return;
    const fromStorage = loadAllActiveReleases();
    setActiveReleaseBySite((prev) => {
      let next = { ...prev };
      let changed = false;
      Object.keys(fromStorage).forEach((key) => {
        if (fromStorage[key] != null && prev[key] === undefined) {
          next[key] = fromStorage[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const deployWorkingVersion = useCallback(
    (options) => {
      const snapshot = buildFullDeploymentSnapshot(workingState, { notes: options?.notes });
      const releaseKey = USE_HIERARCHY_API && siteKeyForApi ? siteKeyForApi : site;
      dispatch({ type: WORKING_VERSION_ACTIONS.DEPLOY_WORKING_VERSION, payload: options });
      setActiveReleaseBySite((prev) => {
        const next = { ...prev, [releaseKey]: { ...snapshot, version: snapshot.version } };
        saveActiveReleaseForSite(releaseKey, next[releaseKey]);
        return next;
      });
      notifyEngineeringHierarchyChanged(releaseKey);
    },
    [workingState, site, siteKeyForApi]
  );

  /** After POST /deploy (API); keeps engineering sidebar "(no release)" accurate for UUID sites. */
  const registerBackendActiveRelease = useCallback((siteId, snapshotStub) => {
    if (!siteId || !snapshotStub || typeof snapshotStub !== "object") return;
    setActiveReleaseBySite((prev) => {
      const next = { ...prev, [siteId]: snapshotStub };
      saveActiveReleaseForSite(siteId, snapshotStub);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!USE_HIERARCHY_API || !siteKeyForApi) return undefined;
    let cancelled = false;
    fetchSiteVersionSummary(siteKeyForApi)
      .then((sum) => {
        if (cancelled || sum?.activeVersionNumber == null) return;
        setActiveReleaseBySite((prev) => {
          if (prev[siteKeyForApi] != null) return prev;
          return {
            ...prev,
            [siteKeyForApi]: { version: `v${sum.activeVersionNumber}` },
          };
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [siteKeyForApi]);

  const value = useMemo(
    () => ({
      siteId: site,
      workingState,
      workingVersion,
      dispatch,
      activeReleaseBySite,
      deployWorkingVersion,
      registerBackendActiveRelease,
      backendWorkingVersionLoading,
      backendWorkingVersionError,
      backendWorkingVersionSynced,
    }),
    [
      site,
      workingState,
      workingVersion,
      dispatch,
      activeReleaseBySite,
      deployWorkingVersion,
      registerBackendActiveRelease,
      backendWorkingVersionLoading,
      backendWorkingVersionError,
      backendWorkingVersionSynced,
    ]
  );

  return <EngineeringVersionContext.Provider value={value}>{children}</EngineeringVersionContext.Provider>;
}

export function useEngineeringVersionContext() {
  const ctx = useContext(EngineeringVersionContext);
  if (!ctx) {
    throw new Error("useEngineeringVersionContext must be used within EngineeringVersionProvider");
  }
  return ctx;
}
