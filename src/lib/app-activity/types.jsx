/** App-level activity log categories (not BAS alarm severities). */
export const LOG_CATEGORY = {
  SUCCESS: "Success",
  INFO: "Info",
  ERROR: "Error",
  API: "API",
};

export const TOAST_VARIANT = {
  SUCCESS: "success",
  INFO: "info",
  ERROR: "error",
};

export const MAX_APP_LOGS = 500;
export const APP_LOGS_STORAGE_KEY = "legion.appActivityLogs";
export const DEFAULT_TOAST_MS = 3000;

/**
 * @typedef {Object} AppLogMeta
 * @property {string} [area]
 * @property {string} [action]
 * @property {string} [details]
 * @property {Record<string, unknown>} [extra]
 */

/**
 * @typedef {Object} AppLogEntry
 * @property {string} id
 * @property {number} timestamp
 * @property {string} category
 * @property {string} message
 * @property {AppLogMeta} [meta]
 * @property {{ method?: string, endpoint?: string, status?: number, durationMs?: number, ok?: boolean, error?: string }} [api]
 */

/**
 * @typedef {Object} ToastOptions
 * @property {number} [durationMs]
 * @property {boolean} [log]
 * @property {AppLogMeta} [meta]
 */

/**
 * @typedef {Object} ApiActivityOptions
 * @property {boolean} [silent] - No toasts; still logs API unless logApi is false
 * @property {boolean} [logApi] - Default true
 * @property {boolean} [toastOnError]
 * @property {boolean} [toastOnSuccess]
 * @property {string} [label] - User-facing context for error toast
 * @property {string} [_path] - Internal: request path for heuristics
 */

/**
 * @typedef {Object} AppActivityBridge
 * @property {(variant: string, message: string, options?: ToastOptions) => void} notify
 * @property {(category: string, message: string, meta?: AppLogMeta, api?: AppLogEntry['api']) => void} log
 * @property {(payload: { method: string, endpoint: string, status: number, durationMs?: number, ok?: boolean, error?: string }, meta?: AppLogMeta) => void} logApi
 * @property {() => void} openLogs
 */
