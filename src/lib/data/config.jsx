import { getEnv } from "../env";

/**
 * Data layer configuration.
 * When false, some repositories skip legacy in-memory mock paths (see each repository).
 */
export const USE_MOCK_DATA = getEnv("REACT_APP_USE_MOCK_DATA") === "false" ? false : true;

/**
 * When REACT_APP_API_BASE_URL is set, sites/buildings/floors/equipment/points use the backend.
 * Other operator surfaces use `adapters/api/operatorApi.js` stubs until HTTP is wired.
 */
export const USE_HIERARCHY_API = Boolean(
  getEnv("REACT_APP_API_BASE_URL") && String(getEnv("REACT_APP_API_BASE_URL")).trim() !== ""
);
