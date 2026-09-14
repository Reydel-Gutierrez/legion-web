'use strict';

/**
 * Legion runtime SIM controller catalog.
 * In-memory lab devices for discovery + the operator live-point poll loop.
 * DB assignment (ControllersMapped) is optional; link is resolved by `controllerCode`.
 * Does not create equipment rows — Engineering FCU-1 is bound at runtime when it exists.
 */

/**
 * Simulated-device labels follow the Legion Controls Master Architecture (LC-ARCH-001)
 * product naming standard (Section 3 / Decision Register D-003, D-004):
 * - FCU/AHU/pump-class sim units are labeled with the general controller model, LPC0810.
 * - VAV-class sim units are labeled with the LPCV family name only. The final LPCV
 *   suffix is an explicit OPEN QUESTION (Section 3, Section 7) until the VAV I/O
 *   schedule is frozen — do not invent a suffix here.
 */
const FCU_SIM_DEVICE_LABEL = 'LPC0810';
const LPCV_SIM_DEVICE_LABEL = 'LPCV';
const FCU_SIM_VENDOR = 'Legion Controls';
const FCU_SIM_BACNET_DEVICE_INSTANCE = '10004';
const FCU_SIM_DISCOVERY_NETWORK = 'SIM';
const FCU_SIM_DEVICE_ADDRESS = '4';

/** Defaults aligned with runtime simulator expectations (presentValue stored as string). */
const FCU_SIM_POINT_DEFINITIONS = [
  { pointCode: 'SPACE_TEMP', pointName: 'Space Temperature', pointType: 'Analog Input', unit: '°F', writable: false, presentValue: '72' },
  { pointCode: 'DISCHARGE_AIR_TEMP', pointName: 'Discharge Air Temperature', pointType: 'Analog Input', unit: '°F', writable: false, presentValue: '58' },
  { pointCode: 'SPACE_TEMP_SP', pointName: 'Space Temperature Setpoint', pointType: 'Analog Value', unit: '°F', writable: true, presentValue: '72' },
  { pointCode: 'FAN_STATUS', pointName: 'Fan Status', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'UNIT_STATUS', pointName: 'Unit Status', pointType: 'Character String Value', unit: null, writable: false, presentValue: 'IDLE' },
  { pointCode: 'OCCUPIED', pointName: 'Occupied', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'true' },
  { pointCode: 'COOL_CALL', pointName: 'Cooling Call', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'HEAT_CALL', pointName: 'Heating Call', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'VALVE_CMD', pointName: 'Valve Command', pointType: 'Analog Output', unit: '%', writable: true, presentValue: '0' },
  { pointCode: 'FAN_CMD', pointName: 'Fan Command', pointType: 'Binary Value', unit: null, writable: true, presentValue: 'false' },
  { pointCode: 'ALARM_STATUS', pointName: 'Alarm Status', pointType: 'Character String Value', unit: null, writable: false, presentValue: 'normal' },
];

/** @typedef {typeof FCU_SIM_POINT_DEFINITIONS[number]} SimFieldPointDef */

/**
 * @type {Array<{
 *   runtimeId: string,
 *   controllerCode: string,
 *   protocol: string,
 *   deviceType: string,
 *   deviceInstance: string,
 *   deviceAddress: string,
 *   deviceLabel: string,
 *   vendorName: string,
 *   discoveryNetwork: string,
 *   fieldPoints: SimFieldPointDef[],
 * }>}
 */
const SIMULATED_CONTROLLERS_CATALOG = [
  {
    runtimeId: 'sim-fcu-01',
    controllerCode: 'FCU-1',
    protocol: 'SIM',
    deviceType: 'FCU',
    deviceInstance: String(FCU_SIM_BACNET_DEVICE_INSTANCE),
    deviceAddress: String(FCU_SIM_DEVICE_ADDRESS),
    deviceLabel: FCU_SIM_DEVICE_LABEL,
    vendorName: FCU_SIM_VENDOR,
    discoveryNetwork: FCU_SIM_DISCOVERY_NETWORK,
    fieldPoints: FCU_SIM_POINT_DEFINITIONS,
  },
  {
    runtimeId: 'sim-fcu-02',
    controllerCode: 'FCU-2',
    protocol: 'SIM',
    deviceType: 'FCU',
    deviceInstance: '10005',
    deviceAddress: '5',
    deviceLabel: FCU_SIM_DEVICE_LABEL,
    vendorName: FCU_SIM_VENDOR,
    discoveryNetwork: FCU_SIM_DISCOVERY_NETWORK,
    fieldPoints: FCU_SIM_POINT_DEFINITIONS,
  },
  {
    runtimeId: 'sim-vav-01',
    controllerCode: 'VAV-1',
    protocol: 'SIM',
    deviceType: 'VAV',
    deviceInstance: '10100',
    deviceAddress: '100',
    deviceLabel: LPCV_SIM_DEVICE_LABEL,
    vendorName: FCU_SIM_VENDOR,
    discoveryNetwork: FCU_SIM_DISCOVERY_NETWORK,
    fieldPoints: [
      {
        pointCode: 'SPACE_TEMP',
        pointName: 'Zone Temperature',
        pointType: 'Analog Input',
        unit: '°F',
        writable: false,
        presentValue: '72',
      },
      {
        pointCode: 'SPACE_TEMP_SP',
        pointName: 'Cooling Setpoint',
        pointType: 'Analog Value',
        unit: '°F',
        writable: true,
        presentValue: '72',
      },
      {
        pointCode: 'DAMPER_CMD',
        pointName: 'Damper Command',
        pointType: 'Analog Output',
        unit: '%',
        writable: true,
        presentValue: '35',
      },
      {
        pointCode: 'OCCUPIED',
        pointName: 'Occupied',
        pointType: 'Binary Value',
        unit: null,
        writable: false,
        presentValue: 'true',
      },
    ],
  },
];

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
  FCU_SIM_POINT_DEFINITIONS,
  FCU_SIM_DEVICE_LABEL,
  LPCV_SIM_DEVICE_LABEL,
  FCU_SIM_VENDOR,
  FCU_SIM_BACNET_DEVICE_INSTANCE,
  FCU_SIM_DISCOVERY_NETWORK,
  FCU_SIM_DEVICE_ADDRESS,
  getCatalogEntryByControllerCode,
  getCatalogEntryByDeviceInstance,
  getCatalogEntryByRuntimeId,
  isNumericOnlyString,
  simCatalogRepairPatchForNumericControllerCode,
};
