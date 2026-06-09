'use strict';

const { getClient } = require('./bacnetClient');
const { DEFAULT_DISCOVERY_TIMEOUT_MS } = require('./bacnet.constants');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeIAmDevice(msg) {
  const payload = msg.payload || {};
  const address = msg.header?.sender?.address || msg.header?.address || null;

  return {
    deviceInstance: payload.deviceId,
    address,
    maxApdu: payload.maxApdu,
    segmentation: payload.segmentation,
    vendorId: payload.vendorId,
    protocol: 'BACnet/IP',
  };
}

/**
 * Broadcast Who-Is and collect I-Am responses for a bounded period.
 * @param {{ lowLimit?: number, highLimit?: number, timeoutMs?: number }} [options]
 */
async function discoverDevices(options = {}) {
  const client = getClient();
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_DISCOVERY_TIMEOUT_MS;
  const devicesByKey = new Map();

  const onIAm = (msg) => {
    const device = normalizeIAmDevice(msg);
    if (device.deviceInstance == null || !device.address) return;
    const key = `${device.deviceInstance}:${device.address}`;
    devicesByKey.set(key, device);
  };

  client.on('iAm', onIAm);

  const startedAt = Date.now();
  try {
    const whoIsOptions = {};
    if (options.lowLimit != null) whoIsOptions.lowLimit = Number(options.lowLimit);
    if (options.highLimit != null) whoIsOptions.highLimit = Number(options.highLimit);
    client.whoIs(whoIsOptions);
    await sleep(timeoutMs);
  } finally {
    client.removeListener('iAm', onIAm);
  }

  const devices = Array.from(devicesByKey.values()).sort(
    (a, b) => Number(a.deviceInstance) - Number(b.deviceInstance)
  );

  return {
    devices,
    discoveredAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    timeoutMs,
  };
}

module.exports = {
  discoverDevices,
};
