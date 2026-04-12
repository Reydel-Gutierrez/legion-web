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
 * @param {{ equipmentId?: string | null, online?: boolean, simEnabled?: boolean }} [opts]
 */
function createDefaultController(code, opts = {}) {
  return {
    controllerCode: code,
    protocol: 'SIM',
    equipmentId: opts.equipmentId ?? null,
    online: opts.online !== false,
    scanVisible: true,
    simEnabled: opts.simEnabled !== false,
    pollRateMs: DEFAULT_POLL_MS,
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
