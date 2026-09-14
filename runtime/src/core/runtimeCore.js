'use strict';

/**
 * LC-ARCH-004 Phase 2: the standalone Legion Runtime process's core logic — moved out of
 * `backend/src/modules/runtime/runtime.service.js` (which is now an HTTP client to this process,
 * see `backend/src/modules/runtime/runtime.service.js`). Owns: SIM polling, controller/point
 * resolution from the deployed Live projection (`LiveControllerBinding`/`LivePointBinding` — never
 * Engineering `ControllersMapped`/`PointsMapped`), runtime-state persistence
 * (`PointRuntimeState`/`ControllerRuntimeState`), stale/comm-failure reconciliation, historian
 * sample writes, and alarm-evaluation triggers.
 *
 * Shares the backend's Prisma client/Postgres connection (same database, separate OS process) and
 * a few pure library modules (historian, alarm evaluation, SIM catalog) via relative `require` —
 * this is intentional code reuse, not a second copy to maintain: there is exactly one poll-loop
 * implementation, it just now runs in its own process.
 */

const path = require('path');
const backendSrc = path.join(__dirname, '..', '..', '..', 'backend', 'src');

const prisma = require(path.join(backendSrc, 'lib', 'prisma'));
const alarmService = require(path.join(backendSrc, 'modules', 'alarms', 'alarm.service'));
const historian = require(path.join(backendSrc, 'lib', 'historian'));
const { SIMULATED_CONTROLLERS_CATALOG, getCatalogEntryByRuntimeId } = require(path.join(
  backendSrc,
  'lib',
  'simulatedControllers',
  'catalog'
));
const { store, createDefaultController, DEFAULT_POLL_MS } = require('./runtime.store');
const bacnetDriver = require('../protocols/bacnetDriver');

/** True for any BACnet/IP-flavored LiveControllerBinding.protocol string. */
function isBacnetProtocol(protocol) {
  return String(protocol || '').toUpperCase().includes('BACNET');
}

/** Verbose SIM poll → DB writes (mapped equipment only). */
const DEV_RUNTIME_SIM_POLL_LOG = process.env.NODE_ENV === 'development';

/** Legacy export: primary demo FCU controller code from the SIM catalog. */
const FCU_CONTROLLER_CODE = SIMULATED_CONTROLLERS_CATALOG[0]?.controllerCode || 'FCU-1';

/** Point/controller quality (LC-ARCH-004): GOOD while actively updating, STALE after one missed
 * poll window, COMM_FAILURE once genuinely unreachable. Never deletes/hides the last known value —
 * only the quality tag changes. */
const QUALITY = {
  GOOD: 'GOOD',
  STALE: 'STALE',
  COMM_FAILURE: 'COMM_FAILURE',
};

/** SIM controller / mapped point considered unreachable if last successful refresh is older than this window. */
function staleThresholdMs(pollRateMs) {
  const pr =
    pollRateMs != null && Number.isFinite(Number(pollRateMs)) ? Number(pollRateMs) : DEFAULT_POLL_MS;
  return Math.max(90000, pr * 4);
}

/** Earlier warning tier — one missed poll cycle is STALE, not yet COMM_FAILURE. */
function earlyStaleThresholdMs(pollRateMs) {
  const pr =
    pollRateMs != null && Number.isFinite(Number(pollRateMs)) ? Number(pollRateMs) : DEFAULT_POLL_MS;
  return Math.max(30000, pr * 2);
}

function qualityForAgeMs(ageMs, pollRateMs) {
  if (!Number.isFinite(ageMs)) return 'UNKNOWN';
  if (ageMs >= staleThresholdMs(pollRateMs)) return QUALITY.COMM_FAILURE;
  if (ageMs >= earlyStaleThresholdMs(pollRateMs)) return QUALITY.STALE;
  return QUALITY.GOOD;
}

/** Upsert the runtime-state row for one Point — the authoritative home for present value/quality. */
function pointRuntimeStateUpsertOp(pointId, { presentValue, quality, lastSeenAt, source }) {
  const setFields = { quality };
  if (presentValue !== undefined) setFields.presentValue = presentValue;
  if (lastSeenAt !== undefined) setFields.lastSeenAt = lastSeenAt;
  if (source !== undefined) setFields.source = source;
  return prisma.pointRuntimeState.upsert({
    where: { pointId },
    create: { pointId, presentValue: presentValue ?? null, quality, lastSeenAt: lastSeenAt ?? null, source: source ?? null },
    update: setFields,
  });
}

async function upsertControllerRuntimeState(liveControllerBindingId, patch) {
  if (!liveControllerBindingId) return;
  try {
    await prisma.controllerRuntimeState.upsert({
      where: { liveControllerBindingId },
      create: { liveControllerBindingId, failureCount: 0, ...patch },
      update: patch,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[runtime] ControllerRuntimeState upsert failed:', e?.message || e);
  }
}

async function bumpControllerFailureCount(liveControllerBindingId) {
  if (!liveControllerBindingId) return;
  try {
    await prisma.controllerRuntimeState.upsert({
      where: { liveControllerBindingId },
      create: { liveControllerBindingId, failureCount: 1, status: 'OFFLINE', quality: QUALITY.COMM_FAILURE },
      update: { failureCount: { increment: 1 } },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[runtime] ControllerRuntimeState failure-count bump failed:', e?.message || e);
  }
}

/**
 * @param {string} equipmentId
 * @returns {object|null}
 */
function storeControllerForMappedEquipment(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return null;
  return (
    Object.values(store.controllers).find((c) => c && String(c.mappedEquipmentId || '').trim() === eid) || null
  );
}

/**
 * @param {object} ec - LiveControllerBinding row (the deployed projection, never ControllersMapped)
 * @param {Date} nowDate
 */
async function persistControllerOnline(ec, nowDate) {
  if (!ec?.id) return;
  try {
    // Phase 2 compatibility mirror: existing consumers (Site Builder assignment display, discovery)
    // still read LiveControllerBinding.status/lastSeenAt directly. ControllerRuntimeState below is
    // the new authoritative row; full consumer migration is a Phase 3 item.
    await prisma.liveControllerBinding.update({
      where: { id: ec.id },
      data: { lastSeenAt: nowDate, status: 'ONLINE' },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[runtime] LiveControllerBinding heartbeat persist failed:', e?.message || e);
  }
  await upsertControllerRuntimeState(ec.id, {
    status: 'ONLINE',
    quality: QUALITY.GOOD,
    lastSeenAt: nowDate,
    lastPollAt: nowDate,
    failureCount: 0,
  });
}

/**
 * Mark mapped controllers/points (any protocol) STALE/COMM_FAILURE when the in-memory poll
 * heartbeat ages out. Reads/writes only the deployed Live projection and runtime-state tables —
 * never ControllersMapped/PointsMapped. Preserves the last known value; only quality/commState
 * changes. The same aging model that already worked for SIM applies unchanged to BACnet: a
 * temporarily unreachable device degrades GOOD -> STALE -> COMM_FAILURE and recovers automatically
 * on the next successful poll (via `persistControllerOnline`), with no protocol-specific logic here.
 */
async function reconcileMappedStaleState() {
  const ecs = await prisma.liveControllerBinding.findMany({
    where: { isEnabled: true },
  });
  const now = Date.now();

  for (const ec of ecs) {
    const storeCtrl = storeControllerForMappedEquipment(ec.equipmentId);
    const memIso = storeCtrl?.lastSeenAt || storeCtrl?.stats?.lastPollAt;
    const memT = memIso ? new Date(memIso).getTime() : NaN;
    const age = Number.isFinite(memT) ? now - memT : Infinity;
    const memFresh = storeCtrl && storeCtrl.online && storeCtrl.simEnabled && age < staleThresholdMs(ec.pollRateMs);
    const controllerQuality = qualityForAgeMs(age, ec.pollRateMs);

    if (!memFresh) {
      try {
        await prisma.liveControllerBinding.update({
          where: { id: ec.id },
          data: { status: 'OFFLINE' },
        });
      } catch (_) {
        /* ignore */
      }
      await upsertControllerRuntimeState(ec.id, { status: 'OFFLINE', quality: controllerQuality });
    }

    const mappings = await prisma.livePointBinding.findMany({
      where: { liveControllerBindingId: ec.id, isBound: true, readEnabled: true },
    });
    for (const m of mappings) {
      const pt = await prisma.point.findUnique({
        where: { id: m.pointId },
        select: { id: true, lastSeenAt: true, commState: true },
      });
      if (!pt) continue;
      const ptT = pt.lastSeenAt ? new Date(pt.lastSeenAt).getTime() : NaN;
      const ptAge = Number.isFinite(ptT) ? now - ptT : Infinity;
      const ptQuality = qualityForAgeMs(ptAge, ec.pollRateMs);
      const ptStale = ptQuality !== QUALITY.GOOD;

      if (ptStale) {
        try {
          await pointRuntimeStateUpsertOp(pt.id, { quality: ptQuality });
        } catch (_) {
          /* ignore */
        }
      }

      // Legacy mirror only flips to OFFLINE at the COMM_FAILURE tier (binary compat; the richer
      // STALE tier lives in PointRuntimeState.quality only, per the compatibility note above).
      const ptCommFailure = ptQuality === QUALITY.COMM_FAILURE;
      if (ptCommFailure && String(pt.commState || '').toUpperCase() !== 'OFFLINE') {
        try {
          await prisma.point.update({
            where: { id: pt.id },
            data: { commState: 'OFFLINE' },
          });
          // Write an explicit OFFLINE transition marker (value: null — never a fabricated
          // number) at the moment the reconciler confirms the point unreachable. This gives the
          // trend chart an authoritative "communication was lost here" row instead of only being
          // able to infer loss from how old the last real sample looks relative to "now". Only
          // written on the actual ONLINE/UNKNOWN -> OFFLINE transition above, never repeatedly
          // while a point stays offline across reconcile cycles.
          if (historian.isPointCovered(pt.id)) {
            await historian.recordSample({ pointId: pt.id, value: null, quality: historian.QUALITY.OFFLINE, timestamp: new Date(now) });
          }
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
}

/**
 * In-memory controller row (any protocol) is "reachable" only when enabled and recently updated
 * (poll loop wrote lastSeenAt within the staleness window).
 * @param {object} c - store controller
 */
function isControllerActivelyUpdating(c) {
  if (!c || !c.online || !c.simEnabled) return false;
  const raw = c.lastSeenAt || c.stats?.lastPollAt;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  const age = Date.now() - t;
  if (age < 0) return false;
  return age < staleThresholdMs(c.pollRateMs);
}

/** Point keys we simulate when rows exist (matched case-insensitively on pointCode). */
const SIM_POINT_KEYS = new Set([
  'SPACE_TEMP',
  'SPACE_TEMP_SP',
  'DISCHARGE_AIR_TEMP',
  'FAN_STATUS',
  'UNIT_STATUS',
  'OCCUPIED',
  'COOL_CALL',
  'HEAT_CALL',
  'VALVE_CMD',
  'FAN_CMD',
  'ALARM_STATUS',
]);

let pollIntervalHandle = null;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function toPointMap(rows) {
  const m = new Map();
  for (const p of rows || []) {
    const k = String(p.pointCode || '').trim().toUpperCase();
    if (k) m.set(k, p);
  }
  return m;
}

/** In-memory PV map from catalog when no equipment is assigned yet. */
function syntheticPointMapFromCatalog(ctrl) {
  const m = new Map();
  const rid = String(ctrl.runtimeId || 'sim').trim();
  for (const def of ctrl.fieldPoints || []) {
    const k = String(def.pointCode || '').trim().toUpperCase();
    if (!k) continue;
    m.set(k, {
      id: `synthetic-${rid}-${k}`,
      pointCode: def.pointCode,
      presentValue: def.presentValue,
      pointName: def.pointName,
      pointType: def.pointType,
    });
  }
  return m;
}

/** Map field keys (e.g. SPACE_TEMP) to Legion Point rows via the deployed LivePointBinding set. */
function mergePointsByCodeForSim(allPoints, mappings) {
  const byCode = toPointMap(allPoints);
  if (!mappings || mappings.length === 0) return byCode;

  const byId = new Map((allPoints || []).map((p) => [p.id, p]));
  const merged = new Map(byCode);
  for (const m of mappings) {
    if (!m.isBound) continue;
    const pt = byId.get(m.pointId);
    if (!pt) continue;
    const k = String(m.fieldPointKey || '').trim().toUpperCase();
    if (!k) continue;
    merged.set(k, pt);
  }
  return merged;
}

/**
 * Resolve the DEPLOYED binding for one equipment — LiveControllerBinding/LivePointBinding only.
 * An Engineering ControllersMapped/PointsMapped edit that hasn't been deployed must never surface
 * here (LC-ARCH-003 Phase 1.1 boundary, preserved unchanged by the Phase 2 process split).
 */
async function loadPersistedBindingForEquipment(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return { ec: null, mappings: [] };
  const ec = await prisma.liveControllerBinding.findFirst({
    where: { equipmentId: eid, isEnabled: true },
  });
  if (!ec) return { ec: null, mappings: [] };
  const mappings = await prisma.livePointBinding.findMany({
    where: { liveControllerBindingId: ec.id },
  });
  return { ec, mappings };
}

/**
 * RELOAD: called by Legion Server (via the internal HTTP API) after a deploy/rollback activates a
 * new release. Re-resolves every site's LiveControllerBinding rows (both SIM and BACnet/IP) so the
 * in-memory controller store matches whatever is now deployed — reconciling by desired-set diff
 * (see `applyPersistedAssignmentsToSimControllers`/`applyPersistedBacnetControllers`), so an
 * unchanged controller keeps its existing store entry (and poll history) untouched, a removed one
 * stops being polled, and nothing is ever duplicated. Never triggered by an Engineering-side
 * ControllersMapped/PointsMapped edit — only by an actual activation.
 */
async function reload() {
  await applyPersistedAssignmentsToSimControllers();
  await applyPersistedBacnetControllers();
  return getStatus();
}

function parseFloatPv(val, fallback) {
  const n = parseFloat(String(val ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolPv(val, fallback = false) {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'on' || s === 'active') return true;
  if (s === 'false' || s === '0' || s === 'off' || s === 'inactive') return false;
  return fallback;
}

/**
 * @param {Map<string, object>} pointsByCode
 * @param {object | null} prevScratch
 */
function computeSimValues(pointsByCode, prevScratch) {
  const st = prevScratch && typeof prevScratch === 'object' ? { ...prevScratch } : {};

  const has = (code) => pointsByCode.has(code.toUpperCase());

  if (has('SPACE_TEMP')) {
    st.spaceTemp = parseFloatPv(pointsByCode.get('SPACE_TEMP')?.presentValue, 72);
  }
  if (has('SPACE_TEMP_SP')) {
    st.spaceTempSp = parseFloatPv(pointsByCode.get('SPACE_TEMP_SP')?.presentValue, 72);
  }
  if (has('VALVE_CMD')) {
    st.valveCmd = parseFloatPv(pointsByCode.get('VALVE_CMD')?.presentValue, 10);
  }
  if (!Number.isFinite(st.spaceTemp)) st.spaceTemp = 72;
  if (!Number.isFinite(st.spaceTempSp)) st.spaceTempSp = 72;
  if (!Number.isFinite(st.valveCmd)) st.valveCmd = 8;

  if (has('DISCHARGE_AIR_TEMP')) {
    st.dischargeAir = parseFloatPv(pointsByCode.get('DISCHARGE_AIR_TEMP')?.presentValue, st.spaceTemp - 13);
  }
  if (!Number.isFinite(st.dischargeAir)) st.dischargeAir = st.spaceTemp - 13;

  st.spaceTempSp = clamp(st.spaceTempSp + (Math.random() - 0.5) * 0.04, 71, 73);

  const coolCall = st.spaceTemp > st.spaceTempSp + 0.5;
  if (coolCall) {
    st.spaceTemp += -0.1 + (Math.random() - 0.5) * 0.05;
  } else {
    st.spaceTemp += 0.055 + (Math.random() - 0.5) * 0.045;
  }
  st.spaceTemp = clamp(st.spaceTemp, 70.5, 75.5);

  const occupied = has('OCCUPIED') ? parseBoolPv(pointsByCode.get('OCCUPIED')?.presentValue, true) : true;
  const cycleWave = Math.sin(Date.now() / 25000);
  const fanOn = coolCall || (occupied && cycleWave > -0.25);

  const valveTarget = coolCall ? 38 + Math.random() * 42 : 2 + Math.random() * 12;
  st.valveCmd = st.valveCmd + (valveTarget - st.valveCmd) * 0.22;
  st.valveCmd = clamp(st.valveCmd, 0, 100);

  const heatCall = st.spaceTemp < st.spaceTempSp - 2;

  if (has('DISCHARGE_AIR_TEMP')) {
    const target = st.spaceTemp - 11 - Math.random() * 4;
    st.dischargeAir = st.dischargeAir + (target - st.dischargeAir) * 0.18;
    st.dischargeAir = clamp(st.dischargeAir, 48, 62);
  }

  let unitStatus = 'IDLE';
  if (coolCall) unitStatus = 'COOLING';
  else if (fanOn) unitStatus = 'FAN';
  else unitStatus = 'IDLE';

  /** @type {Record<string, string>} */
  const nextStrings = {};
  if (has('SPACE_TEMP')) nextStrings.SPACE_TEMP = st.spaceTemp.toFixed(2);
  if (has('SPACE_TEMP_SP')) nextStrings.SPACE_TEMP_SP = st.spaceTempSp.toFixed(1);
  if (has('COOL_CALL')) nextStrings.COOL_CALL = coolCall ? 'true' : 'false';
  if (has('HEAT_CALL')) nextStrings.HEAT_CALL = heatCall ? 'true' : 'false';
  if (has('OCCUPIED')) nextStrings.OCCUPIED = occupied ? 'true' : 'false';
  if (has('VALVE_CMD')) nextStrings.VALVE_CMD = st.valveCmd.toFixed(1);
  if (has('FAN_STATUS')) nextStrings.FAN_STATUS = fanOn ? 'true' : 'false';
  if (has('FAN_CMD')) nextStrings.FAN_CMD = fanOn ? 'true' : 'false';
  if (has('UNIT_STATUS')) nextStrings.UNIT_STATUS = unitStatus;
  if (has('ALARM_STATUS')) nextStrings.ALARM_STATUS = 'normal';
  if (has('DISCHARGE_AIR_TEMP')) nextStrings.DISCHARGE_AIR_TEMP = st.dischargeAir.toFixed(1);

  return { nextStrings, simScratch: st };
}

/**
 * Resolve a runtime controller (any protocol) by catalog `runtimeId`, persisted equipment UUID, or
 * `controllerCode` when unambiguous.
 * @param {string} codeOrEquipmentId
 */
function resolveStoreController(codeOrEquipmentId) {
  const k = String(codeOrEquipmentId || '').trim();
  if (!k) return null;
  if (store.controllers[k]) return store.controllers[k];

  const all = Object.values(store.controllers).filter(Boolean);

  const byMapped = all.find((c) => c.mappedEquipmentId && String(c.mappedEquipmentId) === k);
  if (byMapped) return byMapped;

  const byRuntime = all.find((c) => c.runtimeId && String(c.runtimeId) === k);
  if (byRuntime) return byRuntime;
  const byCatalog = all.filter((c) => c.catalogRuntimeId === k);
  if (byCatalog.length === 1) return byCatalog[0];

  const lower = k.toLowerCase();
  const byCode = all.filter((c) => String(c.controllerCode || '').toLowerCase() === lower);
  return byCode.length === 1 ? byCode[0] : null;
}

function publicControllerDto(c) {
  if (!c) return null;
  const storeKey = String(c.runtimeId || '').trim() || null;
  const mapped = String(c.mappedEquipmentId || '').trim() || null;
  const activelyUpdating = isControllerActivelyUpdating(c);
  return {
    controllerCode: c.controllerCode,
    runtimeId: c.runtimeId,
    siteId: c.siteId,
    /** Route param for controller-scoped endpoints (stable catalog id, e.g. sim-fcu-01) */
    runtimeRouteKey: storeKey,
    protocol: c.protocol,
    mappedEquipmentId: mapped,
    /** Back-compat: same as mappedEquipmentId for older clients */
    equipmentId: mapped,
    deviceType: c.deviceType,
    deviceInstance: c.deviceInstance,
    deviceAddress: c.deviceAddress,
    /** False when SIM is stopped, marked offline, or poll loop has not refreshed within the stale window. */
    online: activelyUpdating,
    /** Mirrors LiveControllerBinding.status when persisted; aligned with `online` for SIM. */
    status: activelyUpdating ? 'ONLINE' : 'OFFLINE',
    scanVisible: c.scanVisible,
    simEnabled: c.simEnabled,
    pollRateMs: c.pollRateMs,
    lastSeenAt: c.lastSeenAt,
    startedAt: c.startedAt,
    stats: { ...c.stats },
    pollWarnings: Array.isArray(c.pollWarnings) ? [...c.pollWarnings] : [],
  };
}

const inFlightPolls = new Map();

function pollController(storeKey) {
  if (inFlightPolls.has(storeKey)) return inFlightPolls.get(storeKey);
  const task = pollControllerOnce(storeKey).finally(() => inFlightPolls.delete(storeKey));
  inFlightPolls.set(storeKey, task);
  return task;
}

/**
 * Commit one poll cycle's successfully-read points as a single DB transaction (Point mirror +
 * PointRuntimeState + historian, all atomically) and record the controller heartbeat — shared by
 * every protocol so there is exactly one "how a successful poll gets persisted" code path. A
 * healthy fast poll cycle must not exceed the UI freshness window.
 * @returns {Promise<number>} number of points actually committed (0 on total failure)
 */
async function commitPointBatch(pointUpdates, ec, pollAt, source, storeKey) {
  if (!pointUpdates.length) return 0;
  try {
    const dueForHistory = pointUpdates.filter((item) => historian.shouldRecordSample(item.id, pollAt.getTime()));
    const historyOps = historian.sampleTransactionOps(
      dueForHistory.map((item) => ({
        pointId: item.id,
        value: item.historyValue,
        quality: historian.QUALITY.ONLINE,
        timestamp: pollAt,
      }))
    );
    await prisma.$transaction([
      ...pointUpdates.map((item) => prisma.point.update({ where: { id: item.id }, data: item.data })),
      ...pointUpdates.map((item) =>
        pointRuntimeStateUpsertOp(item.id, {
          presentValue: item.data.presentValue,
          quality: QUALITY.GOOD,
          lastSeenAt: pollAt,
          source,
        })
      ),
      ...historyOps,
    ]);
    // A committed point batch is the communication heartbeat. Record it before alarm work so
    // alarm latency cannot age a healthy controller.
    await persistControllerOnline(ec, pollAt);
    try {
      await alarmService.evaluateForPointIds(pointUpdates.map((item) => item.id));
    } catch (e) {
      // Alarm evaluation must not invalidate an otherwise successful communication heartbeat.
      console.warn(`[runtime] ${storeKey} alarm evaluation failed:`, e?.message || e);
    }
    return pointUpdates.length;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[runtime] ${storeKey} batch point update failed:`, e?.message || e);
    await bumpControllerFailureCount(ec?.id);
    return 0;
  }
}

async function pollControllerOnce(storeKey) {
  const ctrl = store.controllers[storeKey];
  if (!ctrl) return;

  ctrl.pollWarnings = [];

  if (!ctrl.online || !ctrl.simEnabled) {
    return;
  }

  if (isBacnetProtocol(ctrl.protocol)) {
    return pollBacnetControllerOnce(ctrl, storeKey);
  }
  return pollSimControllerOnce(ctrl, storeKey);
}

async function pollSimControllerOnce(ctrl, storeKey) {
  const mappedId = String(ctrl.mappedEquipmentId || '').trim() || null;
  let ec = null;
  let mappings = [];
  let points = [];
  let pointsByCodeForSim = new Map();

  if (mappedId) {
    const loaded = await loadPersistedBindingForEquipment(mappedId);
    ec = loaded.ec;
    if (!ec || String(ec.protocol || '').toUpperCase() !== 'SIM' ||
        String(ec.controllerCode).toUpperCase() !== String(ctrl.controllerCode).toUpperCase()) {
      ctrl.pollWarnings.push('SIM assignment is disabled, removed, or changed.');
      return;
    }
    mappings = loaded.mappings || [];
    if (ec) {
      ctrl.pollRateMs = Math.max(DEFAULT_POLL_MS, Number(ec.pollRateMs) || DEFAULT_POLL_MS);
      ctrl.controllerCode = ec.controllerCode;
    }
    points = await prisma.point.findMany({
      where: { equipmentId: mappedId },
    });
    const boundForSim = (mappings || []).filter((m) => m.isBound);
    pointsByCodeForSim = mergePointsByCodeForSim(points, boundForSim);
  } else {
    pointsByCodeForSim = syntheticPointMapFromCatalog(ctrl);
  }

  const simKeysPresent = [...SIM_POINT_KEYS].filter((k) => pointsByCodeForSim.has(k));
  if (simKeysPresent.length === 0) {
    ctrl.pollWarnings.push('No supported sim point keys; no runtime sample produced.');
    return;
  }

  const { nextStrings, simScratch } = computeSimValues(pointsByCodeForSim, ctrl.simScratch);
  ctrl.simScratch = simScratch;

  const pollAt = new Date();
  const recordSuccessfulPoll = () => {
    ctrl.lastSeenAt = pollAt.toISOString();
    ctrl.stats.pollCount += 1;
    ctrl.stats.lastPollAt = ctrl.lastSeenAt;
  };

  if (!mappedId) {
    recordSuccessfulPoll();
    return;
  }

  const boundMappings = (mappings || []).filter((m) => m.isBound);
  if (boundMappings.length === 0) {
    ctrl.pollWarnings.push('Mapped equipment has no bound point mappings; skipping DB writes.');
    return;
  }
  if (!points.length) {
    ctrl.pollWarnings.push('Mapped equipment has no point rows in DB; skipping writes.');
    return;
  }

  const writeMappings = boundMappings.filter((m) => m.readEnabled);
  if (writeMappings.length === 0) {
    ctrl.pollWarnings.push('No read-enabled point mappings; skipping DB writes.');
    return;
  }

  const pointUpdates = [];
  for (const m of writeMappings) {
    const row = points.find((p) => p.id === m.pointId);
    if (!row) {
      if (DEV_RUNTIME_SIM_POLL_LOG) {
        // eslint-disable-next-line no-console
        console.log('[DEV runtime SIM poll write]', {
          controllerCode: ctrl.controllerCode,
          mappedEquipmentId: mappedId,
          fieldPointKey: m.fieldPointKey,
          pointIdFromMapping: m.pointId,
          skipped: 'relational_point_row_not_found',
        });
      }
      continue;
    }
    const key = String(m.fieldPointKey || '').trim().toUpperCase();
    const value = nextStrings[key];
    if (value === undefined) continue;
    const prev = row.presentValue != null ? String(row.presentValue) : '';
    const payload = {
      lastSeenAt: pollAt,
      commState: 'ONLINE',
    };
    let presentValueChanged = false;
    if (value !== undefined) {
      const next = String(value);
      if (prev !== next) {
        payload.presentValue = next;
        presentValueChanged = true;
      }
    }
    if (DEV_RUNTIME_SIM_POLL_LOG) {
      // eslint-disable-next-line no-console
      console.log('[DEV runtime SIM poll write]', {
        controllerCode: ctrl.controllerCode,
        mappedEquipmentId: mappedId,
        fieldPointKey: m.fieldPointKey,
        resolvedPointId: row.id,
        pointCode: row.pointCode,
        simulatedValue: value !== undefined ? String(value) : undefined,
        presentValueChanged,
        payloadIncludesPresentValue: payload.presentValue !== undefined,
        lastSeenAtAndCommStateUpdated: true,
        commStateWritten: payload.commState,
        pollAtIso: pollAt.toISOString(),
      });
    }
    pointUpdates.push({ id: row.id, key: key || m.pointId, data: payload, historyValue: value !== undefined ? String(value) : prev });
  }

  const successfulWrites = await commitPointBatch(pointUpdates, ec, pollAt, 'SIM', storeKey);
  if (successfulWrites > 0) recordSuccessfulPoll();
}

/**
 * BACnet/IP poll: reads every bound+read-enabled LivePointBinding through `bacnetDriver` (never
 * `node-bacnet` directly — the protocol-driver boundary). A per-point read failure is recorded as a
 * warning and simply excluded from this cycle's batch — it never fabricates a value, and the
 * point's own quality only degrades once `reconcileMappedStaleState` observes it has aged past the
 * staleness thresholds (same mechanism SIM already relies on). One slow/offline device therefore
 * cannot block or crash polling for any other controller.
 */
async function pollBacnetControllerOnce(ctrl, storeKey) {
  const mappedId = String(ctrl.mappedEquipmentId || '').trim() || null;
  if (!mappedId) {
    ctrl.pollWarnings.push('BACnet controller has no mapped equipment.');
    return;
  }

  const loaded = await loadPersistedBindingForEquipment(mappedId);
  const ec = loaded.ec;
  if (!ec || !isBacnetProtocol(ec.protocol)) {
    ctrl.pollWarnings.push('BACnet assignment is disabled, removed, or changed.');
    return;
  }
  ctrl.pollRateMs = Math.max(DEFAULT_POLL_MS, Number(ec.pollRateMs) || DEFAULT_POLL_MS);
  ctrl.controllerCode = ec.controllerCode;
  ctrl.deviceInstance = ec.deviceInstance;
  ctrl.deviceAddress = ec.ipAddress || ec.networkAddress || ctrl.deviceAddress;

  if (!ec.ipAddress) {
    ctrl.pollWarnings.push('LiveControllerBinding has no ipAddress; cannot poll BACnet/IP.');
    return;
  }

  const mappings = (loaded.mappings || []).filter((m) => m.isBound && m.readEnabled);
  if (!mappings.length) {
    ctrl.pollWarnings.push('No read-enabled point mappings; skipping reads.');
    return;
  }

  const pollAt = new Date();
  const pointUpdates = [];
  for (const m of mappings) {
    if (!m.fieldObjectType || m.fieldObjectInstance == null) {
      ctrl.pollWarnings.push(`${m.fieldPointKey}: missing BACnet object type/instance`);
      continue;
    }
    try {
      const result = await bacnetDriver.readPoints({
        address: ec.ipAddress,
        deviceInstance: ec.deviceInstance,
        objectType: m.fieldObjectType,
        objectInstance: m.fieldObjectInstance,
      });
      const value = result?.presentValue != null ? String(result.presentValue) : null;
      if (value == null) {
        ctrl.pollWarnings.push(`${m.fieldPointKey}: read returned no value`);
        continue;
      }
      pointUpdates.push({
        id: m.pointId,
        key: m.fieldPointKey,
        data: { presentValue: value, lastSeenAt: pollAt, commState: 'ONLINE' },
        historyValue: value,
      });
    } catch (e) {
      // Never fabricate success — do not mark communication OK when the read actually failed.
      ctrl.pollWarnings.push(`${m.fieldPointKey}: ${e?.message || e}`);
    }
  }

  const successfulWrites = await commitPointBatch(pointUpdates, ec, pollAt, 'BACNET_IP', storeKey);
  if (successfulWrites > 0) {
    ctrl.lastSeenAt = pollAt.toISOString();
    ctrl.stats.pollCount += 1;
    ctrl.stats.lastPollAt = ctrl.lastSeenAt;
  } else if (mappings.length > 0) {
    // Every configured point failed this cycle (all reads threw, or the commit itself failed) —
    // count it as a controller-level communication failure. reconcileMappedStaleState progresses
    // GOOD -> STALE -> COMM_FAILURE as the outage continues, exactly as it already does for SIM.
    await bumpControllerFailureCount(ec.id);
  }
}

function startPollLoop() {
  if (pollIntervalHandle) clearInterval(pollIntervalHandle);
  pollIntervalHandle = setInterval(() => {
    const keys = Object.keys(store.controllers);
    Promise.all(
      keys.map((key) =>
        pollController(key).catch((e) =>
          // eslint-disable-next-line no-console
          console.warn(`[runtime] poll ${key}`, e?.message || e)
        )
      )
    ).then(() =>
      reconcileMappedStaleState().catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[runtime] stale reconcile', e?.message || e)
      )
    );
  }, DEFAULT_POLL_MS);
  if (typeof pollIntervalHandle.unref === 'function') pollIntervalHandle.unref();
  // eslint-disable-next-line no-console
  console.log(`[runtime] poll loop started (${DEFAULT_POLL_MS} ms)`);
}

function stopPollLoop() {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
}

async function applyPersistedAssignmentsToSimControllers() {
  const desired = new Set();
  for (const entry of SIMULATED_CONTROLLERS_CATALOG) {
    const assignments = await prisma.liveControllerBinding.findMany({
      where: {
        isEnabled: true,
        protocol: { equals: 'SIM', mode: 'insensitive' },
        controllerCode: { equals: entry.controllerCode, mode: 'insensitive' },
      },
      orderBy: { equipmentId: 'asc' },
    });
    // Assignments are site scoped. Never select a global "latest" winner. Keep the unassigned
    // catalog device discoverable from new projects as before.
    for (const ec of [null, ...assignments]) {
      const runtimeId = ec ? `${entry.runtimeId}:${ec.equipmentId}` : entry.runtimeId;
      desired.add(runtimeId);
      if (!store.controllers[runtimeId]) {
        store.controllers[runtimeId] = createDefaultController(entry.controllerCode, {
          runtimeId,
          catalogRuntimeId: entry.runtimeId,
          siteId: ec?.siteId,
          deviceType: entry.deviceType,
          deviceInstance: entry.deviceInstance,
          deviceAddress: entry.deviceAddress,
          fieldPoints: entry.fieldPoints,
          mappedEquipmentId: ec ? String(ec.equipmentId) : null,
        });
      }
      const rt = store.controllers[runtimeId];
      rt.pollRateMs = Math.max(DEFAULT_POLL_MS, Number(ec?.pollRateMs) || DEFAULT_POLL_MS);
    }
  }
  for (const key of Object.keys(store.controllers)) {
    if (store.controllers[key].protocol === 'SIM' && !desired.has(key)) delete store.controllers[key];
  }
}

/**
 * Load every deployed BACnet/IP `LiveControllerBinding` (across all sites) into the store, keyed by
 * equipment id (each is a real device, not a shared catalog entry like SIM). Desired-set diffing —
 * remove entries no longer deployed/enabled, create newly-deployed ones, update config-in-place for
 * ones that still exist — is what makes `reload()` safe to call on every deploy/rollback without
 * ever duplicating or leaking a poller for a removed controller.
 */
async function applyPersistedBacnetControllers() {
  const bindings = await prisma.liveControllerBinding.findMany({ where: { isEnabled: true } });
  const desired = new Set();
  for (const ec of bindings) {
    if (!isBacnetProtocol(ec.protocol)) continue;
    const runtimeId = String(ec.equipmentId);
    desired.add(runtimeId);
    if (!store.controllers[runtimeId]) {
      store.controllers[runtimeId] = createDefaultController(ec.controllerCode, {
        runtimeId,
        catalogRuntimeId: runtimeId,
        protocol: 'BACNET_IP',
        siteId: ec.siteId,
        deviceInstance: ec.deviceInstance,
        deviceAddress: ec.ipAddress || ec.networkAddress || null,
        mappedEquipmentId: ec.equipmentId,
      });
    }
    const rt = store.controllers[runtimeId];
    rt.controllerCode = ec.controllerCode;
    rt.pollRateMs = Math.max(DEFAULT_POLL_MS, Number(ec.pollRateMs) || DEFAULT_POLL_MS);
    rt.deviceInstance = ec.deviceInstance;
    rt.deviceAddress = ec.ipAddress || ec.networkAddress || rt.deviceAddress;
  }
  for (const key of Object.keys(store.controllers)) {
    const c = store.controllers[key];
    if (isBacnetProtocol(c.protocol) && !desired.has(key)) delete store.controllers[key];
  }
}

/**
 * SIM devices always exist from the catalog (runtime ids); BACnet devices exist only once deployed.
 * `LiveControllerBinding` rows only attach `mappedEquipmentId` once a release deploying that
 * assignment has been activated.
 */
async function hydratePersistedControllers() {
  await applyPersistedAssignmentsToSimControllers();
  await applyPersistedBacnetControllers();
  const bacnetCount = Object.values(store.controllers).filter((c) => isBacnetProtocol(c.protocol)).length;
  // eslint-disable-next-line no-console
  console.log(`[runtime] SIM catalog loaded (${SIMULATED_CONTROLLERS_CATALOG.length} simulated device(s)); ${bacnetCount} BACnet/IP controller(s) from Live configuration`);
}

let initialized = false;
let dbReachable = false;

async function initialize() {
  // Historian background maintenance runs independently of whether any controllers exist.
  historian.startIntervalCacheRefresh();
  historian.startRetentionSweep();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReachable = true;
  } catch (e) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.error('[runtime] database unreachable at startup:', e?.message || e);
  }
  await hydratePersistedControllers();
  const keys = Object.keys(store.controllers);
  initialized = true;
  if (keys.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[runtime] No controllers configured; poll loop not started');
    return;
  }
  startPollLoop();
  await Promise.all(keys.map((k) => pollController(k).catch(() => {})));
  await reconcileMappedStaleState().catch(() => {});
}

async function shutdown() {
  stopPollLoop();
  try {
    await bacnetDriver.shutdown();
  } catch (_) {
    /* ignore */
  }
  try {
    await prisma.$disconnect();
  } catch (_) {
    /* ignore */
  }
}

function listControllers() {
  return Object.values(store.controllers).map(publicControllerDto);
}

function getController(code) {
  const c = resolveStoreController(code);
  return c ? publicControllerDto(c) : null;
}

function setOnline(code, online) {
  const c = resolveStoreController(code);
  if (!c) return null;
  const k = String(c.runtimeId || '').trim();
  const ref = store.controllers[k] || c;
  ref.online = Boolean(online);
  return publicControllerDto(ref);
}

function setSimEnabled(code, enabled) {
  const c = resolveStoreController(code);
  if (!c) return null;
  const k = String(c.runtimeId || '').trim();
  const ref = store.controllers[k] || c;
  ref.simEnabled = Boolean(enabled);
  return publicControllerDto(ref);
}

async function pollNow(code) {
  const c = resolveStoreController(code);
  if (!c) return null;
  const k = String(c.runtimeId || '').trim();
  if (!store.controllers[k]) return null;
  await pollController(k);
  return getController(k);
}

/**
 * @param {string | undefined} siteId - reserved for future non-SIM discovery scoping; SIM lab devices are always included (trunk-style scan).
 */
async function listDiscoveryDevices(siteId) {
  const out = [];
  for (const c of Object.values(store.controllers)) {
    if (!c.scanVisible) continue;

    const isSim = String(c.protocol || '').toUpperCase() === 'SIM';
    const mappedId = String(c.mappedEquipmentId || '').trim() || null;

    if (!isSim) {
      if (!mappedId) continue;
      if (siteId) {
        const eq = await prisma.equipment.findUnique({
          where: { id: mappedId },
          select: { siteId: true },
        });
        if (!eq || String(eq.siteId) !== String(siteId)) continue;
      }
    }

    const { ec } = mappedId ? await loadPersistedBindingForEquipment(mappedId) : { ec: null };

    let pointCount = null;
    if (mappedId) {
      pointCount = await prisma.point.count({ where: { equipmentId: mappedId } });
    } else if (Array.isArray(c.fieldPoints)) {
      pointCount = c.fieldPoints.length;
    }

    if (isSim && siteId && c.siteId && String(c.siteId) !== String(siteId)) continue;
    if (isSim && !mappedId && Object.values(store.controllers).some((other) =>
      other.mappedEquipmentId && other.catalogRuntimeId === c.catalogRuntimeId &&
      (!siteId || String(other.siteId) === String(siteId)))) continue;
    const cat = getCatalogEntryByRuntimeId(c.catalogRuntimeId || c.runtimeId);
    const addressFromDb =
      ec?.networkAddress != null && String(ec.networkAddress).trim() !== ''
        ? String(ec.networkAddress).trim()
        : null;
    const deviceAddress =
      addressFromDb ?? (c.deviceAddress != null ? String(c.deviceAddress) : cat?.deviceAddress ?? null);

    const discoveryOnline = isControllerActivelyUpdating(c);

    out.push({
      code: c.runtimeId,
      runtimeId: c.runtimeId,
      controllerCode: ec?.controllerCode ?? c.controllerCode,
      protocol: c.protocol,
      deviceType: c.deviceType ?? cat?.deviceType ?? null,
      online: discoveryOnline,
      lastSeenAt: c.lastSeenAt || c.startedAt,
      equipmentId: mappedId,
      mappedEquipmentId: mappedId,
      deviceLabel: cat?.deviceLabel ?? `Controller ${c.controllerCode}`,
      vendorName: cat?.vendorName ?? undefined,
      bacnetDeviceInstance: c.deviceInstance ?? cat?.deviceInstance ?? undefined,
      discoveryNetwork: cat?.discoveryNetwork ?? String(c.protocol || ''),
      deviceAddress,
      source: 'runtime',
      pointCount,
    });
  }
  return out;
}

function inferSimFieldDataType(def) {
  const t = String(def.pointType || '').toLowerCase();
  if (t.includes('binary')) return 'boolean';
  if (t.includes('analog') || t.includes('integer')) return 'number';
  return 'string';
}

/**
 * Runtime-native field point list for engineering (from catalog per SIM device).
 * @param {string} code - catalog runtimeId (e.g. sim-fcu-01), mapped equipment UUID, or controllerCode when unique
 */
async function listFieldPointsForController(code) {
  const ctrl = resolveStoreController(code);
  if (!ctrl) return null;

  if (ctrl.protocol === 'SIM') {
    const defs = Array.isArray(ctrl.fieldPoints) ? ctrl.fieldPoints : [];
    return defs.map((d) => ({
      fieldPointKey: d.pointCode,
      fieldPointName: d.pointName,
      fieldObjectType: d.pointType,
      fieldObjectInstance: d.pointCode,
      fieldDataType: inferSimFieldDataType(d),
    }));
  }

  return [];
}

/**
 * WRITE: resolves the deployed binding/mapping for one controller + field point and dispatches
 * through the appropriate protocol driver (BacnetDriver for BACnet/IP; SIM has no external write
 * path, matching existing behavior — SIM commands are advanced by the simulator itself). This is
 * the only way a write reaches a real device: Server -> this function -> BacnetDriver -> device.
 * Never fabricates success — a driver failure is reported back, not swallowed.
 * @param {string} code - controller runtimeId / mapped equipment id / controllerCode
 * @param {string} fieldPointKey
 * @param {unknown} value
 * @param {{ priority?: number }} [options]
 */
async function writePoint(code, fieldPointKey, value, options = {}) {
  const ctrl = resolveStoreController(code);
  if (!ctrl) return { ok: false, status: 404, error: 'Controller not found' };
  const mappedId = String(ctrl.mappedEquipmentId || '').trim() || null;
  if (!mappedId) return { ok: false, status: 400, error: 'Controller has no mapped equipment' };

  const loaded = await loadPersistedBindingForEquipment(mappedId);
  const ec = loaded.ec;
  if (!ec) return { ok: false, status: 404, error: 'Live controller binding not found' };
  const key = String(fieldPointKey || '').trim().toUpperCase();
  const mapping = (loaded.mappings || []).find((m) => String(m.fieldPointKey || '').trim().toUpperCase() === key);
  if (!mapping) return { ok: false, status: 404, error: 'Point mapping not found' };
  if (!mapping.writeEnabled) return { ok: false, status: 400, error: 'Point mapping is not write-enabled' };

  if (!isBacnetProtocol(ec.protocol)) {
    return { ok: false, status: 400, error: 'SIM points have no external write path — values are advanced by the simulator' };
  }
  if (!mapping.fieldObjectType || mapping.fieldObjectInstance == null) {
    return { ok: false, status: 400, error: 'Point mapping is missing BACnet object type/instance' };
  }

  try {
    const result = await bacnetDriver.writePoint(
      { address: ec.ipAddress, deviceInstance: ec.deviceInstance, objectType: mapping.fieldObjectType, objectInstance: mapping.fieldObjectInstance },
      value,
      options
    );
    return { ok: true, status: 200, result };
  } catch (e) {
    return { ok: false, status: 502, error: e?.message || String(e) };
  }
}

/** Summary used by GET /health and GET /runtime/status. */
async function getStatus() {
  const controllers = listControllers();
  let dbOk = dbReachable;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (_) {
    dbOk = false;
  }
  const byProtocol = (pred) => controllers.filter(pred);
  const sim = byProtocol((c) => c.protocol === 'SIM');
  const bacnetIp = byProtocol((c) => isBacnetProtocol(c.protocol));
  return {
    initialized,
    dbReachable: dbOk,
    pollLoopRunning: Boolean(pollIntervalHandle),
    controllerCount: controllers.length,
    onlineControllerCount: controllers.filter((c) => c.online).length,
    offlineControllerCount: controllers.filter((c) => !c.online).length,
    sites: Array.from(new Set(controllers.map((c) => c.siteId).filter(Boolean))),
    protocols: {
      SIM: { configured: sim.length, online: sim.filter((c) => c.online).length, offline: sim.filter((c) => !c.online).length },
      BACNET_IP: {
        configured: bacnetIp.length,
        online: bacnetIp.filter((c) => c.online).length,
        offline: bacnetIp.filter((c) => !c.online).length,
        driver: bacnetDriver.getHealth(),
      },
    },
  };
}

module.exports = {
  initialize,
  shutdown,
  reload,
  listControllers,
  getController,
  setOnline,
  setSimEnabled,
  pollNow,
  pollController,
  writePoint,
  listDiscoveryDevices,
  listFieldPointsForController,
  reconcileMappedStaleState,
  getStatus,
  FCU_CONTROLLER_CODE,
  staleThresholdMs,
  QUALITY,
};
