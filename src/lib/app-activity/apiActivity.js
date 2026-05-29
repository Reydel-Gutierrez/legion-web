const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * @param {string} method
 * @param {string} path
 */
export function isAutoSaveWorkingVersionRequest(method, path) {
  const m = (method || "GET").toUpperCase();
  return m === "PUT" && /\/working-version\/?$/.test(path);
}

/**
 * @param {string} method
 * @param {import('./types').ApiActivityOptions} [activity]
 */
export function shouldToastApiError(method, path, activity) {
  if (activity?.silent) return false;
  if (activity?.toastOnError === true) return true;
  if (activity?.toastOnError === false) return false;
  const m = (method || "GET").toUpperCase();
  if (isAutoSaveWorkingVersionRequest(m, path || "")) return false;
  return MUTATING_METHODS.has(m);
}

/**
 * @param {string} method
 * @param {import('./types').ApiActivityOptions} [activity]
 */
export function shouldToastApiSuccess(method, activity) {
  if (activity?.silent) return false;
  return activity?.toastOnSuccess === true;
}

/**
 * @param {string} method
 * @param {string} path
 */
export function formatApiLogMessage(method, path, status, ok) {
  const m = (method || "GET").toUpperCase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (ok) {
    return `${m} ${p} completed with status ${status}`;
  }
  return `${m} ${p} failed with status ${status}`;
}
