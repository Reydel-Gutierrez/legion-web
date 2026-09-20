'use strict';

/**
 * BACnet/IP protocol driver (LC-ARCH-004 protocol boundary). Wraps the EXISTING, working
 * `node-bacnet`-based client/property utilities in `backend/src/services/bacnet/` rather than
 * reimplementing BACnet here — this task is about wiring continuous field polling into the
 * standalone Runtime, not rewriting the BACnet stack.
 *
 * Deliberately does NOT reuse `readProperty.service.js`'s `readPresentValue` /
 * `writeProperty.service.js`'s `writePresentValue` end-to-end, because their `pointsMappedId` path
 * (`bacnetClient.resolveTargetFromPointsMapped`) reads Engineering `PointsMapped`/`ControllersMapped`
 * — exactly what Runtime must never query (LC-ARCH-003 Phase 1.1 boundary). This driver instead
 * takes an already-resolved target (built by `runtimeCore.js` from `LiveControllerBinding`/
 * `LivePointBinding`) and calls the same low-level `bacnetClient`/property-encoding functions those
 * services use — one BACnet implementation, reached from two different config sources.
 */

const path = require('path');
const backendSrc = path.join(__dirname, '..', '..', '..', 'backend', 'src');

const { readPropertyAsync, writePropertyAsync, resolveObjectType, resolveObjectInstance, resolveAddress } = require(
  path.join(backendSrc, 'services', 'bacnet', 'bacnetClient')
);
const { normalizePresentValue } = require(path.join(backendSrc, 'services', 'bacnet', 'propertyValue.util'));
const { encodePresentValue } = require(path.join(backendSrc, 'services', 'bacnet', 'writeProperty.service'));
const { PRESENT_VALUE_PROPERTY_ID, DEFAULT_WRITE_PRIORITY } = require(
  path.join(backendSrc, 'services', 'bacnet', 'bacnet.constants')
);

function initialize() {
  return Promise.resolve();
}

/** Closes the shared node-bacnet client/socket cleanly (used on Runtime shutdown). */
function shutdown() {
  try {
    const { closeClient } = require(path.join(backendSrc, 'services', 'bacnet', 'bacnetClient'));
    closeClient();
  } catch (_) {
    /* ignore */
  }
  return Promise.resolve();
}

/**
 * @param {{ address: string, deviceInstance?: number|string|null, objectType: string|number, objectInstance: string|number }} target
 * @returns {Promise<{ ok: true, presentValue: string|null, raw: unknown }>} rejects (never fabricates success) on any failure
 */
async function readPoints(target) {
  const address = resolveAddress(target?.address);
  const objectType = resolveObjectType(target?.objectType);
  const objectInstance = resolveObjectInstance(target?.objectInstance);

  const result = await readPropertyAsync(address, { type: objectType, instance: objectInstance }, PRESENT_VALUE_PROPERTY_ID);
  const rawValue = result?.values?.[0] || null;
  const presentValue = normalizePresentValue(rawValue);
  return { ok: true, presentValue, raw: rawValue };
}

/**
 * @param {{ address: string, objectType: string|number, objectInstance: string|number }} target
 * @param {unknown} value
 * @param {{ priority?: number }} [options]
 */
async function writePoint(target, value, options = {}) {
  const address = resolveAddress(target?.address);
  const objectType = resolveObjectType(target?.objectType);
  const objectInstance = resolveObjectInstance(target?.objectInstance);
  const encoded = encodePresentValue(value, objectType);
  const priority = options.priority != null ? Number(options.priority) : DEFAULT_WRITE_PRIORITY;

  await writePropertyAsync(address, { type: objectType, instance: objectInstance }, PRESENT_VALUE_PROPERTY_ID, [encoded], { priority });
  return { ok: true, writtenAt: new Date().toISOString() };
}

function getHealth() {
  return { protocol: 'BACNET_IP', driverLoaded: true };
}

module.exports = { initialize, shutdown, readPoints, writePoint, getHealth };
