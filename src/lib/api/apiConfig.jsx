import { getEnv } from "../env";

/**
 * Central API configuration. Base URL comes from env only (no hardcoded hosts).
 */
export function getApiBaseUrl() {
  const raw = getEnv("REACT_APP_API_BASE_URL") ? String(getEnv("REACT_APP_API_BASE_URL")).trim() : "";
  return raw.replace(/\/+$/, "");
}

export function isHierarchyApiEnabled() {
  return getApiBaseUrl().length > 0;
}
