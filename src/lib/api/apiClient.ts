import { getApiBaseUrl } from "./apiConfig";
import { getAppActivityBridge } from "../app-activity/appActivityBridge";
import {
  formatApiLogMessage,
  shouldToastApiError,
  shouldToastApiSuccess,
} from "../app-activity/apiActivity";
import { appNotify } from "../app-activity/appNotify";

export interface ApiActivityOptions {
  /** No toasts; still logs API unless logApi is false. */
  silent?: boolean;
  /** Default true. */
  logApi?: boolean;
  toastOnError?: boolean;
  toastOnSuccess?: boolean;
  /** User-facing context for error toast. */
  label?: string;
  successMessage?: string;
  /** Internal: request path for heuristics. */
  _path?: string;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  activity?: ApiActivityOptions;
  body?: RequestInit["body"] | Record<string, unknown> | unknown[];
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function logApiActivity(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  ok: boolean,
  errorMessage?: string
) {
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
 * `T` is the caller-asserted shape of the parsed JSON response — this file does not validate it
 * at runtime, it only carries the type through for typed call sites.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { activity, ...fetchOptions } = options;
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("API base URL is not configured (REACT_APP_API_BASE_URL)", 0, null);
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (fetchOptions.method || "GET").toString().toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  let body = fetchOptions.body as BodyInit | Record<string, unknown> | unknown[] | undefined;
  if (body != null && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  // Avoid HTTP cache + 304: empty body + res.ok false makes JSON APIs look like errors and break
  // callers (e.g. runtime discovery merge).
  const cache = fetchOptions.cache !== undefined ? fetchOptions.cache : "no-store";
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();

  let res: Response;
  try {
    res = await fetch(url, { ...fetchOptions, cache, headers, body: body as BodyInit | undefined });
  } catch (networkErr) {
    const durationMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - started
    );
    const msg = (networkErr as Error)?.message || "Network request failed";
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
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const dataObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    let msg = dataObj?.error ? String(dataObj.error) : res.statusText || `HTTP ${res.status}`;
    if (dataObj?.detail) {
      msg = `${msg} — ${String(dataObj.detail)}`;
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

  return data as T;
}
