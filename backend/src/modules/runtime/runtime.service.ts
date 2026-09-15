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
 *
 * Executed directly by Node's native TypeScript type-stripping (Node >=22.6, no build step) —
 * keep this file to erasable syntax only (see backend/src/config/env.ts for the same note).
 */
const { runtimeGet, runtimePost, runtimeProbe } = require("../../lib/runtimeClient.ts");

/** The public controller DTO served by Runtime's own `publicControllerDto()` (runtimeCore.js) — proxied through verbatim, never reshaped here. */
export interface RuntimeControllerDto {
  controllerCode: string;
  runtimeId: string;
  siteId: string | null;
  runtimeRouteKey: string;
  protocol: string;
  mappedEquipmentId: string | null;
  equipmentId: string | null;
  deviceType: string;
  deviceInstance: number | null;
  deviceAddress: string | null;
  online: boolean;
  status: "ONLINE" | "OFFLINE";
  scanVisible: boolean;
  simEnabled: boolean;
  pollRateMs: number;
  lastSeenAt: string | null;
  startedAt: string | null;
  stats: Record<string, unknown>;
  pollWarnings: string[];
  [key: string]: unknown;
}

export interface RuntimeFieldPointDto {
  fieldPointKey: string;
  fieldPointName?: string | null;
  fieldObjectType?: string | null;
  fieldObjectInstance?: number | null;
  fieldDataType?: string | null;
}

export interface RuntimeDiscoveryDeviceDto {
  code: string;
  runtimeId: string;
  controllerCode: string;
  protocol: string;
  online: boolean;
  lastSeenAt: string | null;
  equipmentId: string | null;
  mappedEquipmentId: string | null;
  deviceLabel: string;
  vendorName?: string | null;
  bacnetDeviceInstance?: number | null;
  discoveryNetwork?: string | null;
  deviceAddress: string | null;
  source: "runtime";
  pointCount: number;
  [key: string]: unknown;
}

export interface RuntimeHealthProbe {
  reachable: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export interface WritePointOptions {
  priority?: number;
}

/** Legacy export retained for any caller still importing it directly (no SIM catalog dependency here anymore). */
const FCU_CONTROLLER_CODE = "FCU-1";

async function listControllers(): Promise<RuntimeControllerDto[]> {
  return ((await runtimeGet("/runtime/controllers")) as RuntimeControllerDto[]) || [];
}

async function getController(code: string): Promise<RuntimeControllerDto | null> {
  return (await runtimeGet(`/runtime/controllers/${encodeURIComponent(code)}`, { notFoundValue: null })) as RuntimeControllerDto | null;
}

async function listFieldPointsForController(code: string): Promise<RuntimeFieldPointDto[] | null> {
  const body = (await runtimeGet(`/runtime/controllers/${encodeURIComponent(code)}/field-points`, { notFoundValue: null })) as { points: RuntimeFieldPointDto[] } | null;
  return body ? body.points : null;
}

async function setOnline(code: string, online: boolean): Promise<RuntimeControllerDto | null> {
  const path = `/runtime/controllers/${encodeURIComponent(code)}/${online ? "online" : "offline"}`;
  return (await runtimePost(path, {}, { notFoundValue: null })) as RuntimeControllerDto | null;
}

async function setSimEnabled(code: string, enabled: boolean): Promise<RuntimeControllerDto | null> {
  const path = `/runtime/controllers/${encodeURIComponent(code)}/${enabled ? "start" : "stop"}`;
  return (await runtimePost(path, {}, { notFoundValue: null })) as RuntimeControllerDto | null;
}

async function pollNow(code: string): Promise<RuntimeControllerDto | null> {
  return (await runtimePost(`/runtime/controllers/${encodeURIComponent(code)}/poll-now`, {}, { notFoundValue: null })) as RuntimeControllerDto | null;
}

/**
 * WRITE: the only path a live field write reaches a real device through — Server (here) -> Runtime
 * internal API -> BacnetDriver -> device. The backend process never talks to BACnet directly for a
 * normal live write (Engineering commissioning tooling under `/api/runtime/bacnet/*` is separate —
 * see `bacnet.controller.js` — and intentionally still calls the BACnet client directly for
 * pre-deployment testing of arbitrary/undeployed addresses).
 */
async function writePoint(code: string, fieldPointKey: string, value: unknown, options: WritePointOptions = {}): Promise<unknown> {
  return runtimePost(
    `/runtime/controllers/${encodeURIComponent(code)}/write`,
    { fieldPointKey, value, priority: options.priority },
    { notFoundValue: null }
  );
}

async function listDiscoveryDevices(siteId?: string): Promise<RuntimeDiscoveryDeviceDto[]> {
  const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  const body = (await runtimeGet(`/runtime/discovery-devices${qs}`)) as { devices: RuntimeDiscoveryDeviceDto[] } | null;
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
async function resyncLiveSimBindings(): Promise<{ ok: boolean; reachable?: boolean; [key: string]: unknown }> {
  try {
    return (await runtimePost("/runtime/reload", {})) as { ok: boolean };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[runtime-client] reload failed — Runtime is unreachable or degraded:", message);
    return { ok: false, reachable: false };
  }
}

/** Non-throwing status probe for Server health endpoints and the deploy-path warning above. */
async function getRuntimeHealth(): Promise<RuntimeHealthProbe> {
  return runtimeProbe("/health") as Promise<RuntimeHealthProbe>;
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
