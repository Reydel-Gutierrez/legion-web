'use strict';

const prisma = require('../../lib/prisma');
const pointService = require('../points/point.service');
const { SIMULATED_CONTROLLERS_CATALOG, getCatalogEntryByRuntimeId } = require('../../lib/simulatedControllers/catalog');
const { store, createDefaultController, nowIso, DEFAULT_POLL_MS } = require('./runtime.store');

/** Verbose SIM poll → DB writes (mapped equipment only). */
const DEV_RUNTIME_SIM_POLL_LOG = process.env.NODE_ENV === 'development';

/** Legacy export: primary demo FCU controller code from the SIM catalog. */
const FCU_CONTROLLER_CODE = SIMULATED_CONTROLLERS_CATALOG[0]?.controllerCode || 'FCU-1';

/** SIM controller / mapped point considered stale if last successful refresh is older than this window. */
function staleThresholdMs(pollRateMs) {
  const pr =
    pollRateMs != null && Number.isFinite(Number(pollRateMs)) ? Number(pollRateMs) : DEFAULT_POLL_MS;
  return Math.max(90000, pr * 4);
}

/**
 * @param {string} equipmentId
 * @returns {object|null}
 */
function simStoreControllerForMappedEquipment(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return null;
  return (
    Object.values(store.controllers).find(
      (c) =>
        c &&
        String(c.protocol || '').toUpperCase() === 'SIM' &&
        String(c.mappedEquipmentId || '').trim() === eid
    ) || null
  );
}

/**
 * @param {object} ec - ControllersMapped row
 * @param {Date} nowDate
 */
async function persistMappedSimControllerOnline(ec, nowDate) {
  if (!ec?.id) return;
  try {
    await prisma.controllersMapped.update({
      where: { id: ec.id },
      data: { lastSeenAt: nowDate, status: 'ONLINE' },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[runtime] ControllersMapped heartbeat persist failed:', e?.message || e);
  }
}

/**
 * Mark mapped SIM controllers/points OFFLINE when in-memory poll heartbeat is stale.
 */
async function reconcileSimMappedStaleState() {
  const ecs = await prisma.controllersMapped.findMany({
    where: {
      isEnabled: true,
      protocol: { equals: 'SIM', mode: 'insensitive' },
    },
  });
  const simEcs = ecs;
  const now = Date.now();

  for (const ec of simEcs) {
    const threshold = staleThresholdMs(ec.pollRateMs);
    const storeCtrl = simStoreControllerForMappedEquipment(ec.equipmentId);
    const memIso = storeCtrl?.lastSeenAt || storeCtrl?.stats?.lastPollAt;
    const memT = memIso ? new Date(memIso).getTime() : NaN;
    const memFresh =
      storeCtrl &&
      storeCtrl.online &&
      storeCtrl.simEnabled &&
      Number.isFinite(memT) &&
      now - memT < threshold;

    if (!memFresh) {
      try {
        await prisma.controllersMapped.update({
          where: { id: ec.id },
          data: { status: 'OFFLINE' },
        });
      } catch (_) {
        /* ignore */
      }
    }

    const mappings = await prisma.pointsMapped.findMany({
      where: { equipmentControllerId: ec.id, isBound: true, readEnabled: true },
    });
    for (const m of mappings) {
      const pt = await prisma.point.findUnique({
        where: { id: m.pointId },
        select: { id: true, lastSeenAt: true, commState: true },
      });
      if (!pt) continue;
      const ptT = pt.lastSeenAt ? new Date(pt.lastSeenAt).getTime() : NaN;
      const ptStale = !Number.isFinite(ptT) || now - ptT >= threshold;
      if (ptStale && String(pt.commState || '').toUpperCase() !== 'OFFLINE') {
        try {
          await prisma.point.update({
            where: { id: pt.id },
            data: { commState: 'OFFLINE' },
          });
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
}

/**
 * In-memory SIM row is "reachable" only when enabled and recently updated (poll loop wrote lastSeenAt).
 * @param {object} c - store controller
 */
function isSimControllerActivelyUpdating(c) {
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

/**
 * Phase 2: map field keys (e.g. SPACE_TEMP) to Legion Point rows via persisted PointsMapped.
 * When there are no mappings, returns the same map as toPointMap (Phase 1: pointCode === field key).
 */
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

async function loadPersistedBindingForEquipment(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return { ec: null, mappings: [] };
  const ec = await prisma.controllersMapped.findFirst({
    where: { equipmentId: eid, isEnabled: true },
  });
  if (!ec) return { ec: null, mappings: [] };
  const mappings = await prisma.pointsMapped.findMany({
    where: { equipmentControllerId: ec.id },
  });
  return { ec, mappings };
}

/**
 * After assign/unassign API, re-resolve ControllersMapped → catalog SIM rows (global reconciliation).
 */
async function refreshInMemoryBindingForEquipmentId(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return;
  await applyPersistedAssignmentsToSimControllers();
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
 * Resolve a runtime SIM controller by catalog `runtimeId`, persisted equipment UUID, or `controllerCode` when unambiguous.
 * @param {string} codeOrEquipmentId
 */
function resolveStoreController(codeOrEquipmentId) {
  const k = String(codeOrEquipmentId || '').trim();
  if (!k) return null;
  if (store.controllers[k]) return store.controllers[k];

  const sims = Object.values(store.controllers).filter((c) => c && c.protocol === 'SIM');

  const byMapped = sims.find((c) => c.mappedEquipmentId && String(c.mappedEquipmentId) === k);
  if (byMapped) return byMapped;

  const byRuntime = sims.find((c) => c.runtimeId && String(c.runtimeId) === k);
  if (byRuntime) return byRuntime;

  const lower = k.toLowerCase();
  const byCode = sims.filter((c) => String(c.controllerCode || '').toLowerCase() === lower);
  return byCode.length === 1 ? byCode[0] : null;
}

function publicControllerDto(c) {
  if (!c) return null;
  const storeKey = String(c.runtimeId || '').trim() || null;
  const mapped = String(c.mappedEquipmentId || '').trim() || null;
  const activelyUpdating = c.protocol === 'SIM' ? isSimControllerActivelyUpdating(c) : Boolean(c.online);
  return {
    controllerCode: c.controllerCode,
    runtimeId: c.runtimeId,
    /** Route param for /api/runtime/controllers/:code (stable catalog id, e.g. sim-fcu-01) */
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
    /** Mirrors ControllersMapped.status when persisted; aligned with `online` for SIM. */
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

async function pollController(storeKey) {
  const ctrl = store.controllers[storeKey];
  if (!ctrl) return;

  ctrl.pollWarnings = [];

  if (!ctrl.online || !ctrl.simEnabled) {
    return;
  }

  const mappedId = String(ctrl.mappedEquipmentId || '').trim() || null;
  let ec = null;
  let mappings = [];
  let points = [];
  let pointsByCodeForSim = new Map();

  if (mappedId) {
    const loaded = await loadPersistedBindingForEquipment(mappedId);
    ec = loaded.ec;
    mappings = loaded.mappings || [];
    if (ec) {
      if (ec.pollRateMs != null) ctrl.pollRateMs = ec.pollRateMs;
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
    ctrl.pollWarnings.push('No sim point keys in catalog/equipment; heartbeat only.');
    ctrl.lastSeenAt = nowIso();
    ctrl.stats.pollCount += 1;
    ctrl.stats.lastPollAt = ctrl.lastSeenAt;
    if (ec) {
      await persistMappedSimControllerOnline(ec, new Date(ctrl.lastSeenAt));
    }
    return;
  }

  const { nextStrings, simScratch } = computeSimValues(pointsByCodeForSim, ctrl.simScratch);
  ctrl.simScratch = simScratch;

  ctrl.lastSeenAt = nowIso();
  ctrl.stats.pollCount += 1;
  ctrl.stats.lastPollAt = ctrl.lastSeenAt;
  const pollAt = new Date(ctrl.lastSeenAt);

  if (!mappedId) {
    return;
  }

  const boundMappings = (mappings || []).filter((m) => m.isBound);
  if (boundMappings.length === 0) {
    ctrl.pollWarnings.push('Mapped equipment has no bound point mappings; skipping DB writes.');
    if (ec) await persistMappedSimControllerOnline(ec, pollAt);
    return;
  }
  if (!points.length) {
    ctrl.pollWarnings.push('Mapped equipment has no point rows in DB; skipping writes.');
    if (ec) await persistMappedSimControllerOnline(ec, pollAt);
    return;
  }

  const writeMappings = boundMappings.filter((m) => m.readEnabled);
  if (writeMappings.length === 0) {
    ctrl.pollWarnings.push('No read-enabled point mappings; skipping DB writes.');
    if (ec) await persistMappedSimControllerOnline(ec, pollAt);
    return;
  }

  if (ec) await persistMappedSimControllerOnline(ec, pollAt);

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
    try {
      await pointService.updatePoint(row.id, payload);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[runtime] ${storeKey} failed updating ${key || m.pointId}:`, e?.message || e);
    }
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
      reconcileSimMappedStaleState().catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[runtime] stale reconcile', e?.message || e)
      )
    );
  }, DEFAULT_POLL_MS);
  // eslint-disable-next-line no-console
  console.log(`[runtime] poll loop started (${DEFAULT_POLL_MS} ms)`);
}

async function applyPersistedAssignmentsToSimControllers() {
  for (const entry of SIMULATED_CONTROLLERS_CATALOG) {
    const rt = store.controllers[entry.runtimeId];
    if (!rt) continue;

    const ec = await prisma.controllersMapped.findFirst({
      where: {
        isEnabled: true,
        protocol: { equals: 'SIM', mode: 'insensitive' },
        controllerCode: { equals: entry.controllerCode, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (ec) {
      rt.mappedEquipmentId = String(ec.equipmentId);
      if (ec.pollRateMs != null) rt.pollRateMs = ec.pollRateMs;
      rt.controllerCode = ec.controllerCode;
    } else {
      rt.mappedEquipmentId = null;
      rt.controllerCode = entry.controllerCode;
      rt.pollRateMs = DEFAULT_POLL_MS;
    }
  }
}

/**
 * SIM devices always exist from the catalog (runtime ids). ControllersMapped rows only attach `mappedEquipmentId`.
 */
async function hydrateSimulatedControllersFromCatalog() {
  for (const { runtimeId } of SIMULATED_CONTROLLERS_CATALOG) {
    delete store.controllers[runtimeId];
  }
  for (const entry of SIMULATED_CONTROLLERS_CATALOG) {
    store.controllers[entry.runtimeId] = createDefaultController(entry.controllerCode, {
      runtimeId: entry.runtimeId,
      deviceType: entry.deviceType,
      deviceInstance: entry.deviceInstance,
      deviceAddress: entry.deviceAddress,
      fieldPoints: entry.fieldPoints,
      mappedEquipmentId: null,
      pollRateMs: DEFAULT_POLL_MS,
    });
  }
  await applyPersistedAssignmentsToSimControllers();
  // eslint-disable-next-line no-console
  console.log(`[runtime] SIM catalog loaded (${SIMULATED_CONTROLLERS_CATALOG.length} simulated device(s))`);
}

async function initialize() {
  await hydrateSimulatedControllersFromCatalog();
  startPollLoop();
  await Promise.all(Object.keys(store.controllers).map((k) => pollController(k).catch(() => {})));
  await reconcileSimMappedStaleState().catch(() => {});
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
  ref.lastSeenAt = ref.online ? nowIso() : ref.lastSeenAt;
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

    const cat = c.runtimeId ? getCatalogEntryByRuntimeId(c.runtimeId) : null;
    const addressFromDb =
      ec?.networkAddress != null && String(ec.networkAddress).trim() !== ''
        ? String(ec.networkAddress).trim()
        : null;
    const deviceAddress =
      addressFromDb ?? (c.deviceAddress != null ? String(c.deviceAddress) : cat?.deviceAddress ?? null);

    const discoveryOnline = c.protocol === 'SIM' ? isSimControllerActivelyUpdating(c) : Boolean(c.online);

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

module.exports = {
  initialize,
  listControllers,
  getController,
  setOnline,
  setSimEnabled,
  pollNow,
  pollController,
  listDiscoveryDevices,
  listFieldPointsForController,
  refreshInMemoryBindingForEquipmentId,
  refreshInMemoryBindingForControllerCode: refreshInMemoryBindingForEquipmentId,
  FCU_CONTROLLER_CODE,
  staleThresholdMs,
  reconcileSimMappedStaleState,
};
