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
import {
  loadAllActiveReleases,
  saveWorkingVersionForSite,
  saveActiveReleaseForSite,
  loadWorkingVersionForSite,
} from "../../lib/data/persistence/engineeringVersionPersistence";
import { notifyEngineeringHierarchyChanged } from "../../lib/data/repositories/engineeringRepository";

const EngineeringVersionContext = createContext(null);

function getInitialActiveReleasesMap() {
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
  const { site } = useSite();
  const [workingState, dispatch] = useReducer(workingVersionReducer, site, getInitialWorkingVersionState);
  const [activeReleaseBySite, setActiveReleaseBySite] = React.useState(getInitialActiveReleasesMap);
  const saveTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const workingVersion = useMemo(() => toWorkingVersion(site, workingState), [site, workingState]);

  useEffect(() => {
    isMountedRef.current = true;
    if (site === SITE_IDS.MIAMI_HQ) {
      const stored = loadWorkingVersionForSite(SITE_IDS.MIAMI_HQ);
      const raw =
        stored && (stored.site || (stored.equipment && stored.equipment.length > 0))
          ? stored
          : getInitialWorkingVersionState(SITE_IDS.MIAMI_HQ);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (site === SITE_IDS.BRIGHTLINE) {
      const stored = loadWorkingVersionForSite(SITE_IDS.BRIGHTLINE);
      const raw =
        stored && (stored.site || (stored.equipment && stored.equipment.length > 0))
          ? stored
          : getInitialWorkingVersionState(SITE_IDS.BRIGHTLINE);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
      });
    } else if (site === SITE_IDS.NEW_SITE || site === "New Building") {
      const stored = loadWorkingVersionForSite(SITE_IDS.NEW_SITE) || loadWorkingVersionForSite("New Building");
      const raw = stored || getInitialWorkingVersionState(SITE_IDS.NEW_SITE);
      dispatch({
        type: WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION,
        payload: normalizeWorkingVersionNetworkConfig(raw, site),
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
  }, [site]);

  useEffect(() => {
    if (!site) return;
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
  }, [site, workingState]);

  useEffect(() => {
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
      dispatch({ type: WORKING_VERSION_ACTIONS.DEPLOY_WORKING_VERSION, payload: options });
      setActiveReleaseBySite((prev) => {
        const next = { ...prev, [site]: { ...snapshot, version: snapshot.version } };
        saveActiveReleaseForSite(site, next[site]);
        return next;
      });
      notifyEngineeringHierarchyChanged(site);
    },
    [workingState, site]
  );

  const value = useMemo(
    () => ({
      siteId: site,
      workingState,
      workingVersion,
      dispatch,
      activeReleaseBySite,
      deployWorkingVersion,
    }),
    [site, workingState, workingVersion, activeReleaseBySite, deployWorkingVersion]
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
