/**
 * Central API configuration. Base URL comes from env only (no hardcoded hosts).
 */
export function getApiBaseUrl() {
  const raw =
    typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE_URL
      ? String(process.env.REACT_APP_API_BASE_URL).trim()
      : "";
  return raw.replace(/\/+$/, "");
}

export function isHierarchyApiEnabled() {
  return getApiBaseUrl().length > 0;
}
