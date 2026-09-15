/**
 * Site network configuration for engineering discovery (mock/local; backend-ready shape).
 */

import { SITE_IDS } from "../../../lib/sites";

export const SCAN_MODES = {
  ALL: "all",
  BACNET_IP: "bacnet_ip",
  BACNET_MSTP: "bacnet_mstp",
};

/** @returns {object} NetworkConfig shape */
export function createEmptyNetworkConfig() {
  return {
    bacnetIpNetworks: [],
    mstpTrunks: [],
    scanDefaults: {
      defaultScanMode: SCAN_MODES.ALL,
      scanTimeoutSec: 15,
      retries: 2,
      includeUnconfiguredProtocols: false,
      autoScanOnOpen: false,
    },
    routingNotes: "",
    networkInterfaces: [
      {
        id: "if-default",
        label: "Primary interface",
        bindAddress: "",
        listenUdp: 47808,
        enabled: true,
        notes: "",
      },
    ],
  };
}

/** Seed defaults aligned with Miami HQ mock discovery */
export function createMiamiHqNetworkConfig() {
  return {
    bacnetIpNetworks: [
      {
        id: "ip-miami-1",
        name: "Primary building LAN",
        enabled: true,
        interfaceName: "Ethernet — Building LAN",
        localIpSubnet: "10.0.40.0/24",
        udpPort: 47808,
        bbmdOrForeignDevice: "",
        notes: "JACE / supervisory BACnet/IP",
      },
    ],
    mstpTrunks: [
      {
        id: "mstp-miami-1",
        name: "VAV field bus",
        enabled: true,
        comPort: "COM3",
        baudRate: "76800",
        macRange: "0–127",
        maxMaster: 127,
        notes: "Tower A floor controllers",
      },
    ],
    scanDefaults: {
      defaultScanMode: SCAN_MODES.ALL,
      scanTimeoutSec: 15,
      retries: 2,
      includeUnconfiguredProtocols: false,
      autoScanOnOpen: false,
    },
    routingNotes:
      "Supervisory engine uses BACnet/IP on the building LAN. MSTP trunks hang off BACnet routers for field devices.",
    networkInterfaces: [
      {
        id: "if-miami-1",
        label: "Ethernet — Building LAN",
        bindAddress: "10.0.40.50",
        listenUdp: 47808,
        enabled: true,
        notes: "",
      },
      {
        id: "if-miami-2",
        label: "USB–serial adapter",
        bindAddress: "",
        listenUdp: null,
        enabled: false,
        notes: "Reserved for local MSTP commissioning",
      },
    ],
  };
}

export function ensureNetworkConfig(workingData) {
  if (workingData?.networkConfig && typeof workingData.networkConfig === "object") return workingData.networkConfig;
  return createEmptyNetworkConfig();
}

/** Merge defaults when loading persisted working versions that predate `networkConfig`. */
export function normalizeWorkingVersionNetworkConfig(workingData, siteName) {
  if (!workingData || workingData.networkConfig) return workingData;
  const isMiamiSeed =
    siteName === SITE_IDS.MIAMI_HQ || workingData?.site?.name === SITE_IDS.MIAMI_HQ;
  return {
    ...workingData,
    networkConfig: isMiamiSeed ? createMiamiHqNetworkConfig() : createEmptyNetworkConfig(),
  };
}

/**
 * @typedef {object} BacnetIpNetworkRow
 * @property {string} id
 * @property {string} name
 * @property {boolean} enabled
 * @property {string} interfaceName
 * @property {string} localIpSubnet
 * @property {number} udpPort
 * @property {string} bbmdOrForeignDevice
 * @property {string} notes
 *
 * @typedef {object} MstpTrunkRow
 * @property {string} id
 * @property {string} name
 * @property {boolean} enabled
 * @property {string} comPort
 * @property {string} baudRate
 * @property {string} macRange
 * @property {number} maxMaster
 * @property {string} notes
 *
 * @typedef {object} NetworkInterfaceRow
 * @property {string} id
 * @property {string} label
 * @property {string} bindAddress
 * @property {number|null} listenUdp
 * @property {boolean} enabled
 * @property {string} notes
 *
 * @typedef {object} NetworkConfig
 * @property {BacnetIpNetworkRow[]} bacnetIpNetworks
 * @property {MstpTrunkRow[]} mstpTrunks
 * @property {object} scanDefaults
 * @property {string} routingNotes
 * @property {NetworkInterfaceRow[]} networkInterfaces
 */
