'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { readPropertyAsync } = require('./bacnetClient');
const {
  OBJECT_TYPE_BY_ABBR,
  OBJECT_NAME_PROPERTY_ID,
  bacnetEnum,
} = require('./bacnet.constants');

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2000;
const BULK_HEALTH_CHECK_CONCURRENCY = 2;

const MODEL_NAME_PROPERTY_ID = bacnetEnum.PropertyIdentifier.MODEL_NAME;

function readPropertyWithTimeout(address, objectId, propertyId, timeoutMs) {
  const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_HEALTH_CHECK_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('BACnet read timed out'));
    }, timeout);

    readPropertyAsync(address, objectId, propertyId)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function attemptDeviceHealthRead(address, deviceInstance, timeoutMs) {
  const deviceObjectId = {
    type: OBJECT_TYPE_BY_ABBR.DEVICE,
    instance: deviceInstance,
  };

  const startedAt = Date.now();

  try {
    await readPropertyWithTimeout(address, deviceObjectId, OBJECT_NAME_PROPERTY_ID, timeoutMs);
    return {
      online: true,
      status: 'online',
      responseMs: Date.now() - startedAt,
      detail: 'Read objectName successfully',
    };
  } catch (objectNameErr) {
    try {
      await readPropertyWithTimeout(address, deviceObjectId, MODEL_NAME_PROPERTY_ID, timeoutMs);
      return {
        online: true,
        status: 'online',
        responseMs: Date.now() - startedAt,
        detail: 'Read modelName successfully',
      };
    } catch (modelNameErr) {
      const message = objectNameErr?.message || modelNameErr?.message || 'BACnet read failed';
      const timedOut = /timed out/i.test(message);
      return {
        online: false,
        status: 'offline',
        responseMs: timedOut ? null : Date.now() - startedAt,
        detail: timedOut ? 'BACnet read timed out' : message,
      };
    }
  }
}

function toHealthCheckResult(device, checkResult) {
  const checkedAt = new Date().toISOString();
  return {
    deviceId: device.id,
    address: device.address,
    deviceInstance: device.deviceInstance,
    online: checkResult.online,
    checkedAt,
    responseMs: checkResult.responseMs,
    status: checkResult.status,
    detail: checkResult.detail,
  };
}

async function loadDeviceById(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) {
    throw new HttpError(400, 'deviceId is required');
  }

  const device = await prisma.bacnetDevice.findUnique({ where: { id } });
  if (!device) {
    throw new HttpError(404, 'BacnetDevice not found');
  }

  return device;
}

async function checkDeviceHealth(params = {}) {
  const device = await loadDeviceById(params.deviceId);
  const timeoutMs = params.timeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const checkResult = await attemptDeviceHealthRead(device.address, device.deviceInstance, timeoutMs);

  if (checkResult.online) {
    await prisma.bacnetDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return toHealthCheckResult(device, checkResult);
}

async function runChecksWithConcurrency(devices, timeoutMs, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < devices.length) {
      const currentIndex = index;
      index += 1;
      const device = devices[currentIndex];
      const checkResult = await attemptDeviceHealthRead(
        device.address,
        device.deviceInstance,
        timeoutMs
      );

      if (checkResult.online) {
        await prisma.bacnetDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        });
      }

      results[currentIndex] = toHealthCheckResult(device, checkResult);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, devices.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

async function checkDevicesHealth(params = {}) {
  const timeoutMs = params.timeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const requestedIds = Array.isArray(params.deviceIds)
    ? params.deviceIds.map((id) => String(id).trim()).filter(Boolean)
    : null;

  const devices = requestedIds?.length
    ? await prisma.bacnetDevice.findMany({
        where: { id: { in: requestedIds } },
        orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
      })
    : await prisma.bacnetDevice.findMany({
        orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
      });

  if (requestedIds?.length && devices.length !== requestedIds.length) {
    const found = new Set(devices.map((device) => device.id));
    const missing = requestedIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new HttpError(404, `BacnetDevice not found: ${missing.join(', ')}`);
    }
  }

  const deviceResults = devices.length
    ? await runChecksWithConcurrency(devices, timeoutMs, BULK_HEALTH_CHECK_CONCURRENCY)
    : [];

  const online = deviceResults.filter((result) => result.online).length;

  return {
    checkedAt: new Date().toISOString(),
    summary: {
      total: deviceResults.length,
      online,
      offline: deviceResults.length - online,
    },
    devices: deviceResults,
  };
}

module.exports = {
  checkDeviceHealth,
  checkDevicesHealth,
  DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
};
