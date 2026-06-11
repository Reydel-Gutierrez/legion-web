'use strict';

const bacnet = require('node-bacnet');
const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const {
  bacnetEnum,
  DEFAULT_BACNET_PORT,
  DEFAULT_APDU_TIMEOUT_MS,
  OBJECT_TYPE_BY_ABBR,
  OBJECT_TYPE_ABBR_BY_NUM,
} = require('./bacnet.constants');

let client = null;

function getClientOptions() {
  const options = {
    port: Number(process.env.BACNET_PORT) || DEFAULT_BACNET_PORT,
    apduTimeout: Number(process.env.BACNET_APDU_TIMEOUT_MS) || DEFAULT_APDU_TIMEOUT_MS,
    reuseAddr: true,
  };

  if (process.env.BACNET_INTERFACE) {
    options.interface = process.env.BACNET_INTERFACE;
  }
  if (process.env.BACNET_BROADCAST_ADDRESS) {
    options.broadcastAddress = process.env.BACNET_BROADCAST_ADDRESS;
  }

  return options;
}

function getClient() {
  if (!client) {
    client = new bacnet(getClientOptions());
    client.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[bacnet] client error:', err?.message || err);
    });
  }
  return client;
}

function closeClient() {
  if (!client) return;
  try {
    client.close();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[bacnet] close failed:', e?.message || e);
  }
  client = null;
}

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function readPropertyAsync(address, objectId, propertyId, options) {
  return promisify(getClient().readProperty.bind(getClient()), address, objectId, propertyId, options || {});
}

function writePropertyAsync(address, objectId, propertyId, values, options) {
  return promisify(
    getClient().writeProperty.bind(getClient()),
    address,
    objectId,
    propertyId,
    values,
    options || {}
  );
}

/**
 * Resolve BACnet object type from numeric id or short abbreviation (AV, AI, …).
 * @param {number|string} objectType
 * @returns {number}
 */
function resolveObjectType(objectType) {
  if (objectType == null || objectType === '') {
    throw new HttpError(400, 'objectType is required');
  }

  if (typeof objectType === 'number' && Number.isInteger(objectType)) {
    return objectType;
  }

  const raw = String(objectType).trim();
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const normalized = raw.toUpperCase();
  const resolved = OBJECT_TYPE_BY_ABBR[normalized];
  if (resolved != null) {
    return resolved;
  }

  const enumMatch = bacnetEnum.ObjectType[normalized];
  if (enumMatch != null) {
    return enumMatch;
  }

  throw new HttpError(400, `Unsupported BACnet objectType "${objectType}"`);
}

function resolveObjectInstance(objectInstance) {
  if (objectInstance == null || objectInstance === '') {
    throw new HttpError(400, 'objectInstance is required');
  }
  const n = Number(objectInstance);
  if (!Number.isInteger(n) || n < 0) {
    throw new HttpError(400, 'objectInstance must be a non-negative integer');
  }
  return n;
}

function resolveAddress(address, ipAddressFallback) {
  const resolved = String(address || ipAddressFallback || '').trim();
  if (!resolved) {
    throw new HttpError(400, 'address (IP) is required');
  }
  return resolved;
}

/**
 * Manual test target: deviceInstance, address, objectType, objectInstance.
 * Future path: optional pointsMappedId loads ControllersMapped + PointsMapped.
 */
async function resolveTarget(params = {}) {
  if (params.pointsMappedId) {
    return resolveTargetFromPointsMapped(params.pointsMappedId);
  }

  return {
    source: 'manual',
    address: resolveAddress(params.address),
    deviceInstance:
      params.deviceInstance != null && String(params.deviceInstance).trim() !== ''
        ? Number(params.deviceInstance)
        : null,
    objectType: resolveObjectType(params.objectType),
    objectInstance: resolveObjectInstance(params.objectInstance),
  };
}

/**
 * Load BACnet read/write target from persisted mapping rows.
 * ControllersMapped supplies ipAddress/deviceInstance; PointsMapped supplies object identity.
 */
async function resolveTargetFromPointsMapped(pointsMappedId) {
  const id = String(pointsMappedId || '').trim();
  if (!id) {
    throw new HttpError(400, 'pointsMappedId is required');
  }

  const row = await prisma.pointsMapped.findUnique({
    where: { id },
    include: { controllersMapped: true },
  });

  if (!row) {
    throw new HttpError(404, 'PointsMapped row not found');
  }

  const controller = row.controllersMapped;
  if (!controller) {
    throw new HttpError(404, 'ControllersMapped row not found for mapping');
  }

  const protocol = String(controller.protocol || '').toUpperCase();
  if (!protocol.includes('BACNET')) {
    throw new HttpError(400, 'ControllersMapped protocol is not BACnet/IP');
  }

  const objectTypeRaw = row.fieldObjectType || row.fieldPointKey;
  const objectInstanceRaw = row.fieldObjectInstance;

  if (!objectTypeRaw || objectInstanceRaw == null) {
    throw new HttpError(
      400,
      'PointsMapped row is missing fieldObjectType or fieldObjectInstance for BACnet I/O'
    );
  }

  return {
    source: 'pointsMapped',
    pointsMappedId: row.id,
    equipmentControllerId: controller.id,
    equipmentId: row.equipmentId,
    pointId: row.pointId,
    fieldPointKey: row.fieldPointKey,
    address: resolveAddress(controller.ipAddress),
    deviceInstance:
      controller.deviceInstance != null && String(controller.deviceInstance).trim() !== ''
        ? Number(controller.deviceInstance)
        : null,
    objectType: resolveObjectType(objectTypeRaw),
    objectInstance: resolveObjectInstance(objectInstanceRaw),
    readEnabled: row.readEnabled,
    writeEnabled: row.writeEnabled,
  };
}

function objectTypeToAbbr(objectTypeNum) {
  return OBJECT_TYPE_ABBR_BY_NUM[String(objectTypeNum)] || String(objectTypeNum);
}

module.exports = {
  getClient,
  closeClient,
  readPropertyAsync,
  writePropertyAsync,
  resolveObjectType,
  resolveObjectInstance,
  resolveAddress,
  resolveTarget,
  resolveTargetFromPointsMapped,
  objectTypeToAbbr,
};
