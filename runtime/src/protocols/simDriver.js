'use strict';

/**
 * SIM protocol driver (LC-ARCH-004 protocol boundary). Thin adapter over `runtimeCore`'s existing,
 * working SIM poll-loop implementation — see `driver.js` for the shared interface shape. The poll
 * loop itself stays in `runtimeCore.js` for now (it is tightly bound to the controller store and
 * runtime-state persistence); this driver exposes the same capability behind the protocol-neutral
 * shape so callers don't need to know it's SIM-specific.
 */

const runtimeCore = require('../core/runtimeCore');

function initialize() {
  return Promise.resolve();
}

function shutdown() {
  return Promise.resolve();
}

/** @param {{ code: string }} target - catalog runtimeId / mapped equipment id / controllerCode */
async function readPoints(target) {
  const row = await runtimeCore.pollNow(target?.code);
  return { ok: Boolean(row), controller: row };
}

async function writePoint() {
  // SIM points are advanced by the simulator itself; there is no external write path today.
  return { ok: false, reason: 'SIM driver does not accept external writes' };
}

function getHealth() {
  return {
    protocol: 'SIM',
    controllerCount: runtimeCore.listControllers().filter((c) => c.protocol === 'SIM').length,
  };
}

module.exports = { initialize, shutdown, readPoints, writePoint, getHealth };
