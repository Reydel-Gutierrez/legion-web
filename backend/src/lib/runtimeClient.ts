/**
 * LC-ARCH-004 Phase 2: Legion Server's HTTP client to the standalone Legion Runtime process. This
 * is the ONLY way the Server talks to Runtime now — no shared function calls, no shared in-memory
 * objects. Every call degrades to a clear `HttpError(503)` when Runtime is unreachable rather than
 * throwing an uncaught exception, so an outage there never crashes the API.
 *
 * Executed directly by Node's native TypeScript type-stripping (Node >=22.6, no build step) —
 * keep this file to erasable syntax only (see backend/src/config/env.ts for the same note).
 */
const { HttpError } = require("./httpError");
const env = require("../config/env.ts");

const LEGION_RUNTIME_URL: string = env.LEGION_RUNTIME_URL;
const RUNTIME_INTERNAL_TOKEN: string | null = env.RUNTIME_INTERNAL_TOKEN;
const RUNTIME_REQUEST_TIMEOUT_MS: number = env.RUNTIME_REQUEST_TIMEOUT_MS;

export interface RuntimeFetchOptions {
  method?: string;
  body?: unknown;
}

export interface RuntimeFetchResult {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface RuntimeCallOptions {
  notFoundValue?: unknown;
}

export interface RuntimeProbeResult {
  reachable: boolean;
  status: number;
  body: unknown;
  error?: string;
}

async function runtimeFetch(path: string, options: RuntimeFetchOptions = {}): Promise<RuntimeFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUNTIME_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${LEGION_RUNTIME_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(RUNTIME_INTERNAL_TOKEN ? { "X-Runtime-Token": RUNTIME_INTERNAL_TOKEN } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new HttpError(503, `Legion Runtime is unavailable: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** GET; returns parsed body, or `notFoundValue` on a 404, or throws HttpError(503) if unreachable. */
async function runtimeGet(path: string, { notFoundValue = undefined }: RuntimeCallOptions = {}): Promise<unknown> {
  const { status, body } = await runtimeFetch(path);
  if (status === 404) return notFoundValue;
  if (status >= 500) throw new HttpError(502, (body as { error?: string })?.error || "Legion Runtime returned an error");
  return body;
}

async function runtimePost(path: string, payload: unknown, { notFoundValue = undefined }: RuntimeCallOptions = {}): Promise<unknown> {
  const { status, body } = await runtimeFetch(path, { method: "POST", body: payload ?? {} });
  if (status === 404) return notFoundValue;
  if (status >= 500) throw new HttpError(502, (body as { error?: string })?.error || "Legion Runtime returned an error");
  return body;
}

/** Never throws — used for health/status probes where "unreachable" is itself a valid, reportable state. */
async function runtimeProbe(path: string): Promise<RuntimeProbeResult> {
  try {
    const { status, body } = await runtimeFetch(path);
    return { reachable: true, status, body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { reachable: false, status: 0, body: null, error: message };
  }
}

module.exports = { runtimeGet, runtimePost, runtimeProbe };
