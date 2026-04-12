'use strict';

const prisma = require('../../lib/prisma');
const pointService = require('../points/point.service');
const {
  FCU_SIM_POINT_DEFINITIONS,
  FCU_SIM_DEVICE_LABEL,
  FCU_SIM_VENDOR,
  FCU_SIM_BACNET_DEVICE_INSTANCE,
  FCU_SIM_DISCOVERY_NETWORK,
  FCU_SIM_DEVICE_ADDRESS,
} = require('../../lib/seedFcuSimEquipment');
const { store, createDefaultController, nowIso, DEFAULT_POLL_MS } = require('./runtime.store');

/** SIM controller considered offline if last successful poll/heartbeat is older than this window. */
function staleThresholdMs(pollRateMs) {
  const pr =
    pollRateMs != null && Number.isFinite(Number(pollRateMs)) ? Number(pollRateMs) : DEFAULT_POLL_MS;
  return Math.max(90000, pr * 4);
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

const FCU_CONTROLLER_CODE = 'FCU-1';

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
 * After assign/unassign API, sync the in-memory runtime store for this equipment (SIM lab).
 */
async function refreshInMemoryBindingForEquipmentId(equipmentId) {
  const eid = String(equipmentId || '').trim();
  if (!eid) return;
  const ec = await prisma.controllersMapped.findFirst({
    where: {
      equipmentId: eid,
      isSimulated: true,
      isEnabled: true,
      protocol: { equals: 'SIM', mode: 'insensitive' },
    },
  });
  if (!ec) {
    delete store.controllers[eid];
    return;
  }
  store.controllers[eid] = createDefaultController(ec.controllerCode, {
    equipmentId: eid,
    pollRateMs: ec.pollRateMs != null ? ec.pollRateMs : DEFAULT_POLL_MS,
  });
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
 * Runtime store is keyed by equipment id (UUID) so multiple sites can each use controllerCode "FCU-1".
 * @param {string} codeOrEquipmentId - store key (equipment UUID) or legacy "FCU-1" when unique
 */
function resolveStoreController(codeOrEquipmentId) {
  const k = String(codeOrEquipmentId || '').trim();
  if (!k) return null;
  if (store.controllers[k]) return store.controllers[k];
  const lower = k.toLowerCase();
  if (lower === FCU_CONTROLLER_CODE.toLowerCase()) {
    const sims = Object.values(store.controllers).filter(
      (c) =>
        c &&
        c.protocol === 'SIM' &&
        String(c.controllerCode || '').toLowerCase() === FCU_CONTROLLER_CODE.toLowerCase()
    );
    return sims.length === 1 ? sims[0] : null;
  }
  return null;
}

function publicControllerDto(c) {
  if (!c) return null;
  const storeKey = String(c.equipmentId || '').trim() || null;
  const activelyUpdating = c.protocol === 'SIM' ? isSimControllerActivelyUpdating(c) : Boolean(c.online);
  return {
    controllerCode: c.controllerCode,
    /** Route param for /api/runtime/controllers/:code when multiple SIM FCUs exist */
    runtimeRouteKey: storeKey,
    protocol: c.protocol,
    equipmentId: c.equipmentId,
    /** False when SIM is stopped, marked offline, or poll loop has not refreshed within the stale window. */
    online: activelyUpdating,
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

  const { ec, mappings } = await loadPersistedBindingForEquipment(ctrl.equipmentId);
  if (ec) {
    ctrl.equipmentId = ec.equipmentId;
    if (ec.pollRateMs != null) ctrl.pollRateMs = ec.pollRateMs;
    ctrl.controllerCode = ec.controllerCode;
  }

  if (!ctrl.equipmentId) {
    ctrl.pollWarnings.push('No equipment mapped; skipping point writes.');
    // eslint-disable-next-line no-console
    console.warn(`[runtime] ${storeKey} poll skipped: no equipmentId`);
    return;
  }

  const points = await prisma.point.findMany({
    where: { equipmentId: ctrl.equipmentId },
  });

  if (!points.length) {
    ctrl.pollWarnings.push('Equipment has no point rows in DB.');
    // eslint-disable-next-line no-console
    console.warn(`[runtime] ${storeKey} poll skipped: zero points for equipment ${ctrl.equipmentId}`);
    ctrl.lastSeenAt = nowIso();
    ctrl.stats.pollCount += 1;
    ctrl.stats.lastPollAt = ctrl.lastSeenAt;
    return;
  }

  const boundMappings = (mappings || []).filter((m) => m.isBound);
  const pointsByCodeForSim = mergePointsByCodeForSim(points, boundMappings);
  const simKeysPresent = [...SIM_POINT_KEYS].filter((k) => pointsByCodeForSim.has(k));
  if (simKeysPresent.length === 0) {
    ctrl.pollWarnings.push('No sim point keys (SPACE_TEMP, …) on equipment; nothing to update.');
    ctrl.lastSeenAt = nowIso();
    ctrl.stats.pollCount += 1;
    ctrl.stats.lastPollAt = ctrl.lastSeenAt;
    return;
  }

  const { nextStrings, simScratch } = computeSimValues(pointsByCodeForSim, ctrl.simScratch);
  ctrl.simScratch = simScratch;

  ctrl.lastSeenAt = nowIso();
  ctrl.stats.pollCount += 1;
  ctrl.stats.lastPollAt = ctrl.lastSeenAt;

  const pointsByCode = toPointMap(points);
  const writeMappings = boundMappings.filter((m) => m.readEnabled);

  async function writePresentValue(row, codeUpper, value) {
    if (!row) return;
    const prev = row.presentValue != null ? String(row.presentValue) : '';
    const next = String(value);
    if (prev === next) return;
    try {
      await pointService.updatePoint(row.id, { presentValue: next });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[runtime] ${storeKey} failed updating ${codeUpper}:`, e?.message || e);
    }
  }

  if (writeMappings.length > 0) {
    const mappedKeys = new Set(
      writeMappings.map((m) => String(m.fieldPointKey || '').trim().toUpperCase()).filter(Boolean)
    );
    for (const m of writeMappings) {
      const key = String(m.fieldPointKey || '').trim().toUpperCase();
      const value = nextStrings[key];
      if (value === undefined) continue;
      const row = points.find((p) => p.id === m.pointId);
      await writePresentValue(row, key, value);
    }
    for (const [codeUpper, value] of Object.entries(nextStrings)) {
      if (mappedKeys.has(codeUpper)) continue;
      const row = pointsByCode.get(codeUpper);
      await writePresentValue(row, codeUpper, value);
    }
  } else {
    for (const [codeUpper, value] of Object.entries(nextStrings)) {
      const row = pointsByCode.get(codeUpper);
      await writePresentValue(row, codeUpper, value);
    }
  }
}

function startPollLoop() {
  if (pollIntervalHandle) clearInterval(pollIntervalHandle);
  pollIntervalHandle = setInterval(() => {
    Object.keys(store.controllers).forEach((key) => {
      pollController(key).catch((e) =>
        // eslint-disable-next-line no-console
        console.warn(`[runtime] poll ${key}`, e?.message || e)
      );
    });
  }, DEFAULT_POLL_MS);
  // eslint-disable-next-line no-console
  console.log(`[runtime] poll loop started (${DEFAULT_POLL_MS} ms)`);
}

/**
 * One in-memory SIM controller per persisted ControllersMapped SIM row (key = equipmentId).
 */
async function registerSimControllersFromDb() {
  for (const k of Object.keys(store.controllers)) {
    if (store.controllers[k]?.protocol === 'SIM') delete store.controllers[k];
  }
  const rows = await prisma.controllersMapped.findMany({
    where: {
      isSimulated: true,
      isEnabled: true,
      protocol: { equals: 'SIM', mode: 'insensitive' },
    },
  });
  for (const ec of rows) {
    const eqId = String(ec.equipmentId);
    store.controllers[eqId] = createDefaultController(ec.controllerCode, {
      equipmentId: eqId,
      pollRateMs: ec.pollRateMs != null ? ec.pollRateMs : DEFAULT_POLL_MS,
    });
    // eslint-disable-next-line no-console
    console.log(`[runtime] SIM registered key=${eqId} controllerCode=${ec.controllerCode} (ControllersMapped ${ec.id})`);
  }
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[runtime] No SIM ControllersMapped rows — run seed or assign a SIM controller in Network Discovery.');
  }
}

async function initialize() {
  await registerSimControllersFromDb();
  startPollLoop();
  await Promise.all(Object.keys(store.controllers).map((k) => pollController(k).catch(() => {})));
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
  const k = String(c.equipmentId || '').trim();
  const ref = store.controllers[k] || c;
  ref.online = Boolean(online);
  ref.lastSeenAt = ref.online ? nowIso() : ref.lastSeenAt;
  return publicControllerDto(ref);
}

function setSimEnabled(code, enabled) {
  const c = resolveStoreController(code);
  if (!c) return null;
  const k = String(c.equipmentId || '').trim();
  const ref = store.controllers[k] || c;
  ref.simEnabled = Boolean(enabled);
  return publicControllerDto(ref);
}

async function pollNow(code) {
  const c = resolveStoreController(code);
  if (!c) return null;
  const k = String(c.equipmentId || '').trim();
  if (!store.controllers[k]) return null;
  await pollController(k);
  return getController(k);
}

/**
 * @param {string | undefined} siteId - reserved for future non-SIM discovery scoping; SIM lab devices are always included (trunk-style scan).
 */
async function listDiscoveryDevices(_siteId) {
  const out = [];
  for (const c of Object.values(store.controllers)) {
    if (!c.scanVisible) continue;

    const effEquipmentId = c.equipmentId;
    if (!effEquipmentId) continue;

    const isSim = String(c.protocol || '').toUpperCase() === 'SIM';
    if (siteId && !isSim) {
      const eq = await prisma.equipment.findUnique({
        where: { id: effEquipmentId },
        select: { siteId: true },
      });
      if (!eq || String(eq.siteId) !== String(siteId)) continue;
    }

    const { ec } = await loadPersistedBindingForEquipment(effEquipmentId);

    let pointCount = null;
    pointCount = await prisma.point.count({ where: { equipmentId: effEquipmentId } });

    const isFcuSimLab =
      c.protocol === 'SIM' &&
      String(c.controllerCode || '').toUpperCase() === FCU_CONTROLLER_CODE.toUpperCase();

    const addressFromDb =
      ec?.networkAddress != null && String(ec.networkAddress).trim() !== ''
        ? String(ec.networkAddress).trim()
        : null;
    const deviceAddress = addressFromDb ?? (isFcuSimLab ? String(FCU_SIM_DEVICE_ADDRESS) : null);

    const discoveryOnline = c.protocol === 'SIM' ? isSimControllerActivelyUpdating(c) : Boolean(c.online);

    out.push({
      code: effEquipmentId,
      controllerCode: ec?.controllerCode ?? c.controllerCode,
      protocol: c.protocol,
      online: discoveryOnline,
      lastSeenAt: c.lastSeenAt || c.startedAt,
      equipmentId: effEquipmentId,
      deviceLabel: isFcuSimLab ? FCU_SIM_DEVICE_LABEL : `Controller ${c.controllerCode}`,
      vendorName: isFcuSimLab ? FCU_SIM_VENDOR : undefined,
      bacnetDeviceInstance: isFcuSimLab ? FCU_SIM_BACNET_DEVICE_INSTANCE : undefined,
      discoveryNetwork: isFcuSimLab ? FCU_SIM_DISCOVERY_NETWORK : String(c.protocol || ''),
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
 * Runtime-native field point list for engineering (SIM: canonical FCU keys).
 * @param {string} code - equipment UUID (store key) or legacy FCU-1 when only one SIM row exists
 */
async function listFieldPointsForController(code) {
  const ctrl = resolveStoreController(code);
  if (!ctrl) return null;

  if (ctrl.protocol === 'SIM') {
    return FCU_SIM_POINT_DEFINITIONS.map((d) => ({
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
};
