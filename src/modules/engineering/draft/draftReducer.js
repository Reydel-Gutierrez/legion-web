/**
 * Reducer for the central engineering draft.
 * Actions update draft state; deployDraft updates active snapshot and history.
 */

import { EMPTY_DRAFT } from "./draftModel";
import { createSeedDraft } from "./draftSeed";
import { createEmptyNetworkConfig } from "../network/networkConfigModel";

export const DRAFT_ACTIONS = {
  RESET_DRAFT: "RESET_DRAFT",
  SET_SITE: "SET_SITE",
  SET_TEMPLATES: "SET_TEMPLATES",
  SET_EQUIPMENT: "SET_EQUIPMENT",
  SET_DISCOVERED_DEVICES: "SET_DISCOVERED_DEVICES",
  SET_DISCOVERED_OBJECTS: "SET_DISCOVERED_OBJECTS",
  SET_DISCOVERED_OBJECTS_FOR_DEVICE: "SET_DISCOVERED_OBJECTS_FOR_DEVICE",
  SET_MAPPINGS: "SET_MAPPINGS",
  SET_MAPPINGS_FOR_EQUIPMENT: "SET_MAPPINGS_FOR_EQUIPMENT",
  SET_GRAPHICS: "SET_GRAPHICS",
  SET_GRAPHIC_FOR_EQUIPMENT: "SET_GRAPHIC_FOR_EQUIPMENT",
  SET_GRAPHIC_FOR_SITE_LAYOUT: "SET_GRAPHIC_FOR_SITE_LAYOUT",
  SET_VALIDATION: "SET_VALIDATION",
  SET_DEPLOYMENT_HISTORY: "SET_DEPLOYMENT_HISTORY",
  SET_ACTIVE_DEPLOYMENT_SNAPSHOT: "SET_ACTIVE_DEPLOYMENT_SNAPSHOT",
  DEPLOY_DRAFT: "DEPLOY_DRAFT",
  SET_NETWORK_CONFIG: "SET_NETWORK_CONFIG",
};

function draftReducer(state, action) {
  switch (action.type) {
    case DRAFT_ACTIONS.RESET_DRAFT: {
      const seed = action.payload ?? EMPTY_DRAFT;
      return { ...seed };
    }

    case DRAFT_ACTIONS.SET_SITE:
      return { ...state, site: action.payload };

    case DRAFT_ACTIONS.SET_TEMPLATES:
      return { ...state, templates: action.payload };

    case DRAFT_ACTIONS.SET_EQUIPMENT:
      return { ...state, equipment: action.payload };

    case DRAFT_ACTIONS.SET_DISCOVERED_DEVICES:
      return { ...state, discoveredDevices: action.payload };

    case DRAFT_ACTIONS.SET_DISCOVERED_OBJECTS:
      return { ...state, discoveredObjects: action.payload };

    case DRAFT_ACTIONS.SET_DISCOVERED_OBJECTS_FOR_DEVICE: {
      const { deviceId, objects } = action.payload;
      const deviceKey = String(deviceId);
      const next = { ...state.discoveredObjects, [deviceKey]: objects || [] };
      return { ...state, discoveredObjects: next };
    }

    case DRAFT_ACTIONS.SET_MAPPINGS:
      return { ...state, mappings: action.payload };

    case DRAFT_ACTIONS.SET_MAPPINGS_FOR_EQUIPMENT: {
      const { equipmentId, mappings: eqMappings } = action.payload;
      const next = { ...state.mappings, [equipmentId]: eqMappings || {} };
      return { ...state, mappings: next };
    }

    case DRAFT_ACTIONS.SET_GRAPHICS:
      return { ...state, graphics: action.payload };

    case DRAFT_ACTIONS.SET_GRAPHIC_FOR_EQUIPMENT: {
      const { equipmentId, graphic } = action.payload;
      const next =
        graphic != null
          ? { ...state.graphics, [equipmentId]: graphic }
          : (() => {
              const { [equipmentId]: _, ...rest } = state.graphics || {};
              return rest;
            })();
      return { ...state, graphics: next };
    }

    case DRAFT_ACTIONS.SET_GRAPHIC_FOR_SITE_LAYOUT: {
      const { nodeId, graphic } = action.payload;
      const current = state.siteLayoutGraphics || {};
      const next = graphic
        ? { ...current, [nodeId]: graphic }
        : (() => {
          const { [nodeId]: _, ...rest } = current;
          return rest;
        })();
      return { ...state, siteLayoutGraphics: next };
    }

    case DRAFT_ACTIONS.SET_VALIDATION:
      return { ...state, validation: action.payload };

    case DRAFT_ACTIONS.SET_DEPLOYMENT_HISTORY:
      return { ...state, deploymentHistory: action.payload };

    case DRAFT_ACTIONS.SET_ACTIVE_DEPLOYMENT_SNAPSHOT:
      return { ...state, activeDeploymentSnapshot: action.payload };

    case DRAFT_ACTIONS.SET_NETWORK_CONFIG:
      return {
        ...state,
        networkConfig: action.payload ?? createEmptyNetworkConfig(),
      };

    case DRAFT_ACTIONS.DEPLOY_DRAFT: {
      const now = new Date();
      const currentVersion = state.activeDeploymentSnapshot?.version || "v0";
      const versionNum = parseInt(String(currentVersion).replace(/\D/g, ""), 10) + 1;
      const newVersion = `v${versionNum}`;
      const entry = {
        version: newVersion,
        date: now.toISOString().slice(0, 10),
        user: "Reydel",
        result: "Success",
        notes: action.payload?.notes ?? "",
        timestamp: now.toISOString(),
      };
      const snapshot = {
        version: newVersion,
        lastDeployedAt: now.toISOString(),
        deployedBy: "Reydel Gutierrez",
        systemStatus: "Running",
      };
      return {
        ...state,
        deploymentHistory: [entry, ...(state.deploymentHistory || [])],
        activeDeploymentSnapshot: snapshot,
      };
    }

    default:
      return state;
  }
}

export default draftReducer;

/** Create initial state from seed for a site name */
export function getInitialDraftState(siteName) {
  return createSeedDraft(siteName || "Miami HQ");
}
