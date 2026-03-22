/**
 * Provider for the central engineering draft state and active deployments.
 * Draft is keyed by current site; when site changes, draft is loaded from seed or persistence.
 * activeDeploymentBySite holds the deployed config per site — Operator reads from this.
 * Engineering = author draft; Deployment publishes draft -> active; Operator = consume active.
 * Persistence: drafts and deployments saved to localStorage (backend-ready shape).
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import { useSite } from "./SiteProvider";
import draftReducer, { getInitialDraftState, DRAFT_ACTIONS } from "../../modules/engineering/draft/draftReducer";
import { createSeedDraft } from "../../modules/engineering/draft/draftSeed";
import {
  createEmptyNetworkConfig,
  normalizeDraftNetworkConfig,
} from "../../modules/engineering/network/networkConfigModel";
import { buildFullDeploymentSnapshot } from "../../modules/engineering/draft/deploymentSnapshot";
import { SITE_IDS } from "../../lib/sites";
import {
  loadAllDeployments,
  saveDraftForSite,
  saveDeploymentForSite,
  loadDraftForSite,
} from "../../lib/data/persistence/draftPersistence";

const DraftContext = createContext(null);

/** Build initial active deployments: in-memory seed + hydrate from persistence. */
function getInitialActiveDeployments() {
  const miamiSeed = createSeedDraft("Miami HQ");
  const snapshot = buildFullDeploymentSnapshot(miamiSeed, {
    version: miamiSeed.activeDeploymentSnapshot?.version ?? "v12",
    lastDeployedAt: miamiSeed.activeDeploymentSnapshot?.lastDeployedAt ?? "2026-03-09T21:45:00.000Z",
    deployedBy: miamiSeed.activeDeploymentSnapshot?.deployedBy ?? "Reydel Gutierrez",
    systemStatus: miamiSeed.activeDeploymentSnapshot?.systemStatus ?? "Running",
  });
  const fromStorage = loadAllDeployments();
  return {
    [SITE_IDS.MIAMI_HQ]: fromStorage[SITE_IDS.MIAMI_HQ] != null ? fromStorage[SITE_IDS.MIAMI_HQ] : snapshot,
    [SITE_IDS.NEW_SITE]: fromStorage[SITE_IDS.NEW_SITE] != null ? fromStorage[SITE_IDS.NEW_SITE] : null,
    ...fromStorage,
  };
}

export function EngineeringDraftProvider({ children }) {
  const { site } = useSite();
  const [draft, dispatch] = useReducer(draftReducer, site, getInitialDraftState);
  const [activeDeploymentBySite, setActiveDeploymentBySite] = React.useState(getInitialActiveDeployments);
  const saveTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Load draft when site changes: built-in sites use seed; custom sites use persistence or empty
  useEffect(() => {
    isMountedRef.current = true;
    if (site === SITE_IDS.MIAMI_HQ) {
      const stored = loadDraftForSite(SITE_IDS.MIAMI_HQ);
      const raw =
        stored && (stored.site || (stored.equipment && stored.equipment.length > 0))
          ? stored
          : getInitialDraftState(SITE_IDS.MIAMI_HQ);
      dispatch({
        type: DRAFT_ACTIONS.RESET_DRAFT,
        payload: normalizeDraftNetworkConfig(raw, site),
      });
    } else if (site === SITE_IDS.NEW_SITE || site === "New Building") {
      const stored = loadDraftForSite(SITE_IDS.NEW_SITE) || loadDraftForSite("New Building");
      const raw = stored || getInitialDraftState(SITE_IDS.NEW_SITE);
      dispatch({
        type: DRAFT_ACTIONS.RESET_DRAFT,
        payload: normalizeDraftNetworkConfig(raw, site),
      });
    } else {
      const stored = loadDraftForSite(site);
      // If current draft already represents this site (e.g. just created in Site Builder), keep it
      // so we don't overwrite with empty/stored when setSite(name) runs right after actions.setSite(newSite)
      const currentDraftSiteName = draft?.site?.name;
      const draftHasContent = draft?.site || (Array.isArray(draft?.equipment) && draft.equipment.length > 0);
      if (currentDraftSiteName === site && draftHasContent) {
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
        type: DRAFT_ACTIONS.RESET_DRAFT,
        payload: normalizeDraftNetworkConfig(stored || emptyPayload, site),
      });
    }
    return () => {
      isMountedRef.current = false;
    };
    // Draft is read on purpose only when site changes (avoid wiping just-created site)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // Persist draft when it changes (debounced). Also save under draft.site.name so switching to that site loads it.
  useEffect(() => {
    if (!site) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      if (isMountedRef.current) {
        saveDraftForSite(site, draft);
        if (draft?.site?.name && draft.site.name !== site) saveDraftForSite(draft.site.name, draft);
      }
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [site, draft]);

  // Hydrate activeDeploymentBySite from persistence for custom sites on first load
  useEffect(() => {
    const fromStorage = loadAllDeployments();
    setActiveDeploymentBySite((prev) => {
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

  const deployDraftConfiguration = useCallback(
    (options) => {
      const snapshot = buildFullDeploymentSnapshot(draft, { notes: options?.notes });
      dispatch({ type: DRAFT_ACTIONS.DEPLOY_DRAFT, payload: options });
      setActiveDeploymentBySite((prev) => {
        const next = { ...prev, [site]: { ...snapshot, version: snapshot.version } };
        saveDeploymentForSite(site, next[site]);
        return next;
      });
    },
    [draft, site]
  );

  const value = useMemo(
    () => ({
      draft,
      dispatch,
      activeDeploymentBySite,
      deployDraftConfiguration,
    }),
    [draft, activeDeploymentBySite, deployDraftConfiguration]
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraftContext() {
  const ctx = useContext(DraftContext);
  if (!ctx) {
    throw new Error("useDraftContext must be used within EngineeringDraftProvider");
  }
  return ctx;
}
