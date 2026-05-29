import { getApiBaseUrl } from "./apiConfig";
import { getAppActivityBridge } from "../app-activity/appActivityBridge";
import {
  formatApiLogMessage,
  shouldToastApiError,
  shouldToastApiSuccess,
} from "../app-activity/apiActivity";
import { appNotify } from "../app-activity/appNotify";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function logApiActivity(method, path, status, durationMs, ok, errorMessage) {
  const bridge = getAppActivityBridge();
  if (!bridge || !bridge.logApi) return;
  bridge.logApi(
    {
      method,
      endpoint: path,
      status,
      durationMs,
      ok,
      error: errorMessage,
    },
    undefined
  );
}

/**
 * JSON fetch helper for the Legion API. Paths are relative to REACT_APP_API_BASE_URL.
 * @param {string} path - e.g. "/api/sites"
 * @param {RequestInit & { activity?: import('../app-activity/types').ApiActivityOptions }} [options]
 */
export async function apiFetch(path, options = {}) {
  const { activity, ...fetchOptions } = options;
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("API base URL is not configured (REACT_APP_API_BASE_URL)", 0, null);
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(fetchOptions.headers || {}),
  };
  let body = fetchOptions.body;
  if (body != null && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  /** Avoid HTTP cache + 304: empty body + res.ok false makes JSON APIs look like errors and break callers (e.g. runtime discovery merge). */
  const cache = fetchOptions.cache !== undefined ? fetchOptions.cache : "no-store";
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, cache, headers, body });
  } catch (networkErr) {
    const durationMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - started
    );
    const msg = networkErr?.message || "Network request failed";
    if (activity?.logApi !== false) {
      logApiActivity(method, path, 0, durationMs, false, msg);
    }
    if (shouldToastApiError(method, path, activity)) {
      appNotify.error(activity?.label ? `${activity.label}: server communication failed` : "Server communication failed");
    }
    throw new ApiError(msg, 0, null);
  }

  const durationMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - started
  );
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let msg =
      data && typeof data === "object" && data.error
        ? String(data.error)
        : res.statusText || `HTTP ${res.status}`;
    if (data && typeof data === "object" && data.detail) {
      msg = `${msg} — ${String(data.detail)}`;
    }
    if (activity?.logApi !== false) {
      logApiActivity(method, path, res.status, durationMs, false, msg);
    }
    if (shouldToastApiError(method, path, activity)) {
      appNotify.error(activity?.label ? `${activity.label}: API request failed` : "API request failed");
    }
    throw new ApiError(msg, res.status, data);
  }

  if (activity?.logApi !== false) {
    logApiActivity(method, path, res.status, durationMs, true);
  }
  if (shouldToastApiSuccess(method, activity)) {
    const okMsg = activity?.successMessage || formatApiLogMessage(method, path, res.status, true);
    appNotify.success(okMsg, { log: false });
  }

  return data;
}
