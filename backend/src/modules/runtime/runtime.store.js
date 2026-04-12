'use strict';

/** SIM / runtime controller poll period (how often present values may advance). */
const DEFAULT_POLL_MS = 20000;

const store = {
  /** @type {Record<string, object>} */
  controllers: {},
};

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {string} code
 * @param {{
 *   runtimeId?: string | null,
 *   mappedEquipmentId?: string | null,
 *   deviceType?: string | null,
 *   deviceInstance?: string | null,
 *   deviceAddress?: string | null,
 *   fieldPoints?: object[] | null,
 *   online?: boolean,
 *   simEnabled?: boolean,
 *   pollRateMs?: number,
 * }} [opts]
 */
function createDefaultController(code, opts = {}) {
  return {
    runtimeId: opts.runtimeId ?? null,
    controllerCode: code,
    protocol: 'SIM',
    deviceType: opts.deviceType ?? null,
    deviceInstance: opts.deviceInstance ?? null,
    deviceAddress: opts.deviceAddress ?? null,
    mappedEquipmentId: opts.mappedEquipmentId ?? null,
    fieldPoints: opts.fieldPoints ?? null,
    online: opts.online !== false,
    scanVisible: true,
    simEnabled: opts.simEnabled !== false,
    pollRateMs: opts.pollRateMs != null ? Number(opts.pollRateMs) : DEFAULT_POLL_MS,
    lastSeenAt: null,
    startedAt: nowIso(),
    stats: { pollCount: 0, lastPollAt: null },
    pollWarnings: [],
    /** @type {object | null} numeric scratch for smooth simulation */
    simScratch: null,
  };
}

module.exports = {
  store,
  createDefaultController,
  nowIso,
  DEFAULT_POLL_MS,
};
