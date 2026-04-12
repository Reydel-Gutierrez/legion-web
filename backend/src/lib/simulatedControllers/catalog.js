'use strict';

/**
 * Legion runtime SIM controller catalog.
 * Add entries here to surface new lab devices in discovery without DB rows.
 * DB assignment (ControllersMapped) is optional; link is resolved by `controllerCode`.
 */

const {
  FCU_SIM_POINT_DEFINITIONS,
  FCU_SIM_DEVICE_LABEL,
  FCU_SIM_VENDOR,
  FCU_SIM_BACNET_DEVICE_INSTANCE,
  FCU_SIM_DISCOVERY_NETWORK,
  FCU_SIM_DEVICE_ADDRESS,
} = require('../seedFcuSimEquipment');

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
    deviceLabel: 'LC-CGC (Bay 2)',
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
    deviceLabel: 'VAV-LAB-1',
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

/** @param {string} id */
function getCatalogEntryByRuntimeId(id) {
  const k = String(id || '').trim();
  return k ? byRuntimeId.get(k) ?? null : null;
}

module.exports = {
  SIMULATED_CONTROLLERS_CATALOG,
  getCatalogEntryByControllerCode,
  getCatalogEntryByRuntimeId,
};
