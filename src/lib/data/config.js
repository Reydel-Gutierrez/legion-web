/**
 * Data layer configuration.
 * Toggle mock vs API; when false, repositories use API adapters (not yet implemented).
 */
export const USE_MOCK_DATA =
  typeof process !== "undefined" &&
  process.env &&
  process.env.REACT_APP_USE_MOCK_DATA === "false"
    ? false
    : true;

/**
 * When REACT_APP_API_BASE_URL is set, sites/buildings/floors/equipment/points use the backend.
 * Other operator features (alarms, trends, etc.) still follow USE_MOCK_DATA unless migrated.
 */
export const USE_HIERARCHY_API =
  typeof process !== "undefined" &&
  process.env &&
  process.env.REACT_APP_API_BASE_URL &&
  String(process.env.REACT_APP_API_BASE_URL).trim() !== "";
