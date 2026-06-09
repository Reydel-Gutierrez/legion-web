'use strict';

/**
 * Legion runtime SIM controller catalog.
 * Empty — lab SIM devices were retired in favor of real BACnet/IP runtime.
 * DB assignment (ControllersMapped) is optional; link is resolved by `controllerCode`.
 */

/** @type {Array<object>} */
const SIMULATED_CONTROLLERS_CATALOG = [];

const byRuntimeId = new Map(SIMULATED_CONTROLLERS_CATALOG.map((e) => [e.runtimeId, e]));

/** @param {string} code */
function getCatalogEntryByControllerCode(code) {
  const want = String(code || '').trim().toLowerCase();
  if (!want) return null;
  return SIMULATED_CONTROLLERS_CATALOG.find((e) => e.controllerCode.toLowerCase() === want) ?? null;
}

/**
 * Discovery / bad assigns sometimes send BACnet instance instead of catalog `controllerCode`.
 * @param {string|number|null|undefined} instanceRaw
 */
function getCatalogEntryByDeviceInstance(instanceRaw) {
  const inst = String(instanceRaw ?? '').trim();
  if (!inst || !/^\d+$/.test(inst)) return null;
  return SIMULATED_CONTROLLERS_CATALOG.find((e) => String(e.deviceInstance).trim() === inst) ?? null;
}

/** @param {string|unknown} s */
function isNumericOnlyString(s) {
  const t = String(s ?? '').trim();
  return t.length > 0 && /^\d+$/.test(t);
}

/**
 * ControllersMapped row stored `controllerCode` as device instance — patch to catalog code.
 * @param {{ protocol?: string|null, controllerCode?: string|null, deviceInstance?: string|null }} row
 * @returns {{ controllerCode: string, deviceInstance: string } | null}
 */
function simCatalogRepairPatchForNumericControllerCode(row) {
  if (!row) return null;
  if (String(row.protocol || '').trim().toUpperCase() !== 'SIM') return null;
  const code = String(row.controllerCode || '').trim();
  if (!isNumericOnlyString(code)) return null;
  const diRaw = row.deviceInstance != null ? String(row.deviceInstance).trim() : '';
  const inst = isNumericOnlyString(diRaw) ? diRaw : code;
  const cat = getCatalogEntryByDeviceInstance(inst);
  if (!cat) return null;
  if (cat.controllerCode === code && String(cat.deviceInstance) === inst) return null;
  return {
    controllerCode: cat.controllerCode,
    deviceInstance: String(cat.deviceInstance),
  };
}

/** @param {string} id */
function getCatalogEntryByRuntimeId(id) {
  const k = String(id || '').trim();
  return k ? byRuntimeId.get(k) ?? null : null;
}

module.exports = {
  SIMULATED_CONTROLLERS_CATALOG,
  getCatalogEntryByControllerCode,
  getCatalogEntryByDeviceInstance,
  getCatalogEntryByRuntimeId,
  isNumericOnlyString,
  simCatalogRepairPatchForNumericControllerCode,
};
