import { getApiBaseUrl } from "./apiConfig";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * JSON fetch helper for the Legion API. Paths are relative to REACT_APP_API_BASE_URL.
 * @param {string} path - e.g. "/api/sites"
 * @param {RequestInit} [options]
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError("API base URL is not configured (REACT_APP_API_BASE_URL)", 0, null);
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };
  let body = options.body;
  if (body != null && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  /** Avoid HTTP cache + 304: empty body + res.ok false makes JSON APIs look like errors and breaks callers (e.g. runtime discovery merge). */
  const cache = options.cache !== undefined ? options.cache : "no-store";
  const res = await fetch(url, { ...options, cache, headers, body });
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
    throw new ApiError(msg, res.status, data);
  }
  return data;
}
