/**
 * Data layer configuration.
 * When false, some repositories skip legacy in-memory mock paths (see each repository).
 */
export const USE_MOCK_DATA =
  typeof process !== "undefined" &&
  process.env &&
  process.env.REACT_APP_USE_MOCK_DATA === "false"
    ? false
    : true;

/**
 * When REACT_APP_API_BASE_URL is set, sites/buildings/floors/equipment/points use the backend.
 * Other operator surfaces use `adapters/api/operatorApi.js` stubs until HTTP is wired.
 */
export const USE_HIERARCHY_API =
  typeof process !== "undefined" &&
  process.env &&
  process.env.REACT_APP_API_BASE_URL &&
  String(process.env.REACT_APP_API_BASE_URL).trim() !== "";
