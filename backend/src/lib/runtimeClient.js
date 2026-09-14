'use strict';

/**
 * LC-ARCH-004 Phase 2: Legion Server's HTTP client to the standalone Legion Runtime process. This
 * is the ONLY way the Server talks to Runtime now — no shared function calls, no shared in-memory
 * objects. Every call degrades to a clear `HttpError(503)` when Runtime is unreachable rather than
 * throwing an uncaught exception, so an outage there never crashes the API.
 */

const { HttpError } = require('./httpError');
const { LEGION_RUNTIME_URL, RUNTIME_INTERNAL_TOKEN, RUNTIME_REQUEST_TIMEOUT_MS } = require('../config/env');

async function runtimeFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUNTIME_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${LEGION_RUNTIME_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(RUNTIME_INTERNAL_TOKEN ? { 'X-Runtime-Token': RUNTIME_INTERNAL_TOKEN } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    throw new HttpError(503, `Legion Runtime is unavailable: ${e?.message || e}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** GET; returns parsed body, or `notFoundValue` on a 404, or throws HttpError(503) if unreachable. */
async function runtimeGet(path, { notFoundValue = undefined } = {}) {
  const { status, body } = await runtimeFetch(path);
  if (status === 404) return notFoundValue;
  if (status >= 500) throw new HttpError(502, body?.error || 'Legion Runtime returned an error');
  return body;
}

async function runtimePost(path, payload, { notFoundValue = undefined } = {}) {
  const { status, body } = await runtimeFetch(path, { method: 'POST', body: payload ?? {} });
  if (status === 404) return notFoundValue;
  if (status >= 500) throw new HttpError(502, body?.error || 'Legion Runtime returned an error');
  return body;
}

/** Never throws — used for health/status probes where "unreachable" is itself a valid, reportable state. */
async function runtimeProbe(path) {
  try {
    const { status, body } = await runtimeFetch(path);
    return { reachable: true, status, body };
  } catch (e) {
    return { reachable: false, status: 0, body: null, error: e?.message || String(e) };
  }
}

module.exports = { runtimeGet, runtimePost, runtimeProbe };
