/**
 * Reducer for the editable working-version payload (flat engineering state).
 */

import { EMPTY_WORKING_DATA } from "./workingVersionModel";
import { createSeedWorkingVersion } from "./workingVersionSeed";
import { createEmptyNetworkConfig } from "../network/networkConfigModel";
import { LAYOUT_GRAPHIC_CANVAS_DEFAULT } from "../../../lib/graphics/graphicsConstants";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";

export const WORKING_VERSION_ACTIONS = {
  RESET_WORKING_VERSION: "RESET_WORKING_VERSION",
  SET_SITE: "SET_SITE",
  SET_TEMPLATES: "SET_TEMPLATES",
  SET_EQUIPMENT: "SET_EQUIPMENT",
  SET_DISCOVERED_DEVICES: "SET_DISCOVERED_DEVICES",
  PATCH_DISCOVERED_DEVICE: "PATCH_DISCOVERED_DEVICE",
  SET_DISCOVERED_OBJECTS: "SET_DISCOVERED_OBJECTS",
  SET_DISCOVERED_OBJECTS_FOR_DEVICE: "SET_DISCOVERED_OBJECTS_FOR_DEVICE",
  SET_MAPPINGS: "SET_MAPPINGS",
  SET_MAPPINGS_FOR_EQUIPMENT: "SET_MAPPINGS_FOR_EQUIPMENT",
  SET_GRAPHICS: "SET_GRAPHICS",
  SET_GRAPHIC_FOR_EQUIPMENT: "SET_GRAPHIC_FOR_EQUIPMENT",
  SET_GRAPHIC_FOR_SITE_LAYOUT: "SET_GRAPHIC_FOR_SITE_LAYOUT",
  SET_VALIDATION: "SET_VALIDATION",
  SET_RELEASE_HISTORY: "SET_RELEASE_HISTORY",
  SET_ACTIVE_RELEASE_METADATA: "SET_ACTIVE_RELEASE_METADATA",
  DEPLOY_WORKING_VERSION: "DEPLOY_WORKING_VERSION",
  SET_NETWORK_CONFIG: "SET_NETWORK_CONFIG",
};

function workingVersionReducer(state, action) {
  switch (action.type) {
    case WORKING_VERSION_ACTIONS.RESET_WORKING_VERSION: {
      const seed = action.payload ?? EMPTY_WORKING_DATA;
      return { ...seed };
    }

    case WORKING_VERSION_ACTIONS.SET_SITE:
      return { ...state, site: action.payload };

    case WORKING_VERSION_ACTIONS.SET_TEMPLATES:
      return { ...state, templates: action.payload };

    case WORKING_VERSION_ACTIONS.SET_EQUIPMENT:
      return { ...state, equipment: action.payload };

    case WORKING_VERSION_ACTIONS.SET_DISCOVERED_DEVICES:
      return { ...state, discoveredDevices: action.payload };

    case WORKING_VERSION_ACTIONS.PATCH_DISCOVERED_DEVICE: {
      const { deviceId, patch } = action.payload;
      if (!deviceId || !patch || typeof patch !== "object") return state;
      function mapTree(nodes) {
        if (!Array.isArray(nodes)) return nodes;
        return nodes.map((n) => {
          if (n.id === deviceId) return { ...n, ...patch };
          if (n.children?.length) return { ...n, children: mapTree(n.children) };
          return n;
        });
      }
      return { ...state, discoveredDevices: mapTree(state.discoveredDevices || []) };
    }

    case WORKING_VERSION_ACTIONS.SET_DISCOVERED_OBJECTS:
      return { ...state, discoveredObjects: action.payload };

    case WORKING_VERSION_ACTIONS.SET_DISCOVERED_OBJECTS_FOR_DEVICE: {
      const { deviceId, objects } = action.payload;
      const deviceKey = String(deviceId);
      const next = { ...state.discoveredObjects, [deviceKey]: objects || [] };
      return { ...state, discoveredObjects: next };
    }

    case WORKING_VERSION_ACTIONS.SET_MAPPINGS:
      return { ...state, mappings: action.payload };

    case WORKING_VERSION_ACTIONS.SET_MAPPINGS_FOR_EQUIPMENT: {
      const { equipmentId, mappings: eqMappings } = action.payload;
      const next = { ...state.mappings, [equipmentId]: eqMappings || {} };
      return { ...state, mappings: next };
    }

    case WORKING_VERSION_ACTIONS.SET_GRAPHICS:
      return { ...state, graphics: action.payload };

    case WORKING_VERSION_ACTIONS.SET_GRAPHIC_FOR_EQUIPMENT: {
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

    case WORKING_VERSION_ACTIONS.SET_GRAPHIC_FOR_SITE_LAYOUT: {
      const { nodeId, graphic } = action.payload;
      const current = state.siteLayoutGraphics || {};
      const next = graphic
        ? {
            ...current,
            [nodeId]: {
              ...graphic,
              canvasSize: graphic.canvasSize || LAYOUT_GRAPHIC_CANVAS_DEFAULT,
            },
          }
        : (() => {
            const { [nodeId]: _, ...rest } = current;
            return rest;
          })();
      return { ...state, siteLayoutGraphics: next };
    }

    case WORKING_VERSION_ACTIONS.SET_VALIDATION:
      return { ...state, validation: action.payload };

    case WORKING_VERSION_ACTIONS.SET_RELEASE_HISTORY:
      return { ...state, deploymentHistory: action.payload };

    case WORKING_VERSION_ACTIONS.SET_ACTIVE_RELEASE_METADATA:
      return { ...state, activeDeploymentSnapshot: action.payload };

    case WORKING_VERSION_ACTIONS.SET_NETWORK_CONFIG:
      return {
        ...state,
        networkConfig: action.payload ?? createEmptyNetworkConfig(),
      };

    case WORKING_VERSION_ACTIONS.DEPLOY_WORKING_VERSION: {
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

export default workingVersionReducer;

export function getInitialWorkingVersionState(siteName) {
  if (USE_HIERARCHY_API && isBackendSiteId(siteName)) {
    return {
      ...EMPTY_WORKING_DATA,
      networkConfig: createEmptyNetworkConfig(),
    };
  }
  return createSeedWorkingVersion(siteName || "Miami HQ");
}
