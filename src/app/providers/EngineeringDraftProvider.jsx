/**
 * Provider for the central engineering draft state and active deployments.
 * Draft is keyed by current site; when site changes, draft is re-seeded.
 * activeDeploymentBySite holds the deployed config per site — Operator reads from this.
 * Engineering = author draft; Deployment publishes draft -> active; Operator = consume active.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from "react";
import { useSite } from "./SiteProvider";
import draftReducer, { getInitialDraftState, DRAFT_ACTIONS } from "../../modules/engineering/draft/draftReducer";
import { createSeedDraft } from "../../modules/engineering/draft/draftSeed";
import { buildFullDeploymentSnapshot } from "../../modules/engineering/draft/deploymentSnapshot";
import { SITE_IDS } from "../../lib/sites";

const DraftContext = createContext(null);

/** Initial active deployment per site: Miami HQ gets seeded from draft seed; New Site has none. */
function getInitialActiveDeployments() {
  const miamiSeed = createSeedDraft("Miami HQ");
  const snapshot = buildFullDeploymentSnapshot(miamiSeed, {
    version: miamiSeed.activeDeploymentSnapshot?.version ?? "v12",
    lastDeployedAt: miamiSeed.activeDeploymentSnapshot?.lastDeployedAt ?? "2026-03-09T21:45:00.000Z",
    deployedBy: miamiSeed.activeDeploymentSnapshot?.deployedBy ?? "Reydel Gutierrez",
    systemStatus: miamiSeed.activeDeploymentSnapshot?.systemStatus ?? "Running",
  });
  return {
    [SITE_IDS.MIAMI_HQ]: snapshot,
    [SITE_IDS.NEW_SITE]: null,
  };
}

export function EngineeringDraftProvider({ children }) {
  const { site } = useSite();
  const [draft, dispatch] = useReducer(draftReducer, site, getInitialDraftState);
  const [activeDeploymentBySite, setActiveDeploymentBySite] = React.useState(getInitialActiveDeployments);

  useEffect(() => {
    // Only reset draft for built-in sites. Custom sites (e.g. "Home Lab" created in Site Builder) keep current draft.
    if (site === SITE_IDS.MIAMI_HQ) {
      dispatch({ type: DRAFT_ACTIONS.RESET_DRAFT, payload: getInitialDraftState(SITE_IDS.MIAMI_HQ) });
    } else if (site === SITE_IDS.NEW_SITE || site === "New Building") {
      dispatch({ type: DRAFT_ACTIONS.RESET_DRAFT, payload: getInitialDraftState(SITE_IDS.NEW_SITE) });
    }
    // else: custom site name — do not reset; draft stays as-is (e.g. "Home Lab" created in Site Builder)
  }, [site]);

  const deployDraftConfiguration = useCallback(
    (options) => {
      const snapshot = buildFullDeploymentSnapshot(draft, { notes: options?.notes });
      dispatch({ type: DRAFT_ACTIONS.DEPLOY_DRAFT, payload: options });
      setActiveDeploymentBySite((prev) => ({
        ...prev,
        [site]: { ...snapshot, version: snapshot.version },
      }));
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
