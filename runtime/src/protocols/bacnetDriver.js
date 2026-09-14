'use strict';

/**
 * BACnet/IP protocol driver (LC-ARCH-004 protocol boundary). Wraps the EXISTING, working
 * `node-bacnet`-based read/write services in `backend/src/services/bacnet/` rather than
 * reimplementing BACnet here — Phase 2 is about establishing the driver boundary, not rewriting the
 * BACnet stack. No continuous BACnet field-polling loop exists yet in this codebase (only SIM does);
 * this driver makes the existing point-in-time read/write callable through the same shape the
 * runtime process uses for SIM, so a future BACnet polling loop can be added without another
 * protocol-specific rewrite of the runtime core.
 */

const path = require('path');
const backendSrc = path.join(__dirname, '..', '..', '..', 'backend', 'src');

const { readPresentValue } = require(path.join(backendSrc, 'services', 'bacnet', 'readProperty.service'));
const { writePresentValue } = require(path.join(backendSrc, 'services', 'bacnet', 'writeProperty.service'));

function initialize() {
  return Promise.resolve();
}

function shutdown() {
  return Promise.resolve();
}

/** @param {object} target - { address, deviceInstance, objectType, objectInstance } or a pointsMappedId */
async function readPoints(target) {
  const result = await readPresentValue(target || {});
  return { ok: true, result };
}

/** @param {object} target @param {unknown} value */
async function writePoint(target, value) {
  const result = await writePresentValue({ ...(target || {}), value });
  return { ok: true, result };
}

function getHealth() {
  return { protocol: 'BACNET_IP', driverLoaded: true };
}

module.exports = { initialize, shutdown, readPoints, writePoint, getHealth };
