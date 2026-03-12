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
