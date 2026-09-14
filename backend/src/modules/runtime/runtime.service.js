'use strict';

/**
 * LC-ARCH-004 Phase 2: this module is now a thin HTTP CLIENT to the standalone Legion Runtime
 * process (see `runtime/`) — it no longer owns the poll loop, in-memory controller store, or any
 * BACnet/SIM execution itself. Every exported function keeps its original name/signature (same
 * shapes `runtime.controller.js` and the rest of the Server already call) so this remains a
 * boring, compatible change from the API's point of view; only the ownership moved.
 *
 * A Runtime outage never crashes the Server: `runtimeClient` turns connection failures into
 * `HttpError(503)`, which `asyncHandler`/`errorHandler` already turn into a clean JSON error
 * response instead of an uncaught exception.
 */

const { runtimeGet, runtimePost, runtimeProbe } = require('../../lib/runtimeClient');

/** Legacy export retained for any caller still importing it directly (no SIM catalog dependency here anymore). */
const FCU_CONTROLLER_CODE = 'FCU-1';

async function listControllers() {
  return (await runtimeGet('/runtime/controllers')) || [];
}

async function getController(code) {
  return runtimeGet(`/runtime/controllers/${encodeURIComponent(code)}`, { notFoundValue: null });
}

async function listFieldPointsForController(code) {
  const body = await runtimeGet(`/runtime/controllers/${encodeURIComponent(code)}/field-points`, { notFoundValue: null });
  return body ? body.points : null;
}

async function setOnline(code, online) {
  const path = `/runtime/controllers/${encodeURIComponent(code)}/${online ? 'online' : 'offline'}`;
  return runtimePost(path, {}, { notFoundValue: null });
}

async function setSimEnabled(code, enabled) {
  const path = `/runtime/controllers/${encodeURIComponent(code)}/${enabled ? 'start' : 'stop'}`;
  return runtimePost(path, {}, { notFoundValue: null });
}

async function pollNow(code) {
  return runtimePost(`/runtime/controllers/${encodeURIComponent(code)}/poll-now`, {}, { notFoundValue: null });
}

/**
 * WRITE: the only path a live field write reaches a real device through — Server (here) -> Runtime
 * internal API -> BacnetDriver -> device. The backend process never talks to BACnet directly for a
 * normal live write (Engineering commissioning tooling under `/api/runtime/bacnet/*` is separate —
 * see `bacnet.controller.js` — and intentionally still calls the BACnet client directly for
 * pre-deployment testing of arbitrary/undeployed addresses).
 */
async function writePoint(code, fieldPointKey, value, options = {}) {
  return runtimePost(
    `/runtime/controllers/${encodeURIComponent(code)}/write`,
    { fieldPointKey, value, priority: options.priority },
    { notFoundValue: null }
  );
}

async function listDiscoveryDevices(siteId) {
  const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : '';
  const body = await runtimeGet(`/runtime/discovery-devices${qs}`);
  return body ? body.devices : [];
}

/**
 * RELOAD: called after `deployRelease`/`rollbackToVersion` (or the LS-100 activation pipeline)
 * activates a new release — tells Runtime to re-resolve its controller store against the freshly
 * materialized `LiveControllerBinding` rows. Never called from an Engineering-side edit.
 *
 * Deliberately does not throw on failure: per LC-ARCH-004, a Runtime reload failure must not roll
 * back the database activation that already committed. The caller logs/reports degraded state and
 * a later successful reload (manual retry, or Runtime's own restart-time reload) catches up.
 */
async function resyncLiveSimBindings() {
  try {
    return await runtimePost('/runtime/reload', {});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[runtime-client] reload failed — Runtime is unreachable or degraded:', e?.message || e);
    return { ok: false, reachable: false };
  }
}

/** Non-throwing status probe for Server health endpoints and the deploy-path warning above. */
async function getRuntimeHealth() {
  const probe = await runtimeProbe('/health');
  return probe;
}

module.exports = {
  listControllers,
  getController,
  setOnline,
  setSimEnabled,
  pollNow,
  writePoint,
  listDiscoveryDevices,
  listFieldPointsForController,
  resyncLiveSimBindings,
  getRuntimeHealth,
  FCU_CONTROLLER_CODE,
};
