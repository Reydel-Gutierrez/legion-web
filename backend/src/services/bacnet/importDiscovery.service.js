'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../lib/prisma');
const discoverObjectsService = require('./discoverObjects.service');
const { discoverDevices } = require('./discovery.service');
const { readPropertyAsync } = require('./bacnetClient');
const {
  OBJECT_TYPE_BY_ABBR,
  OBJECT_NAME_PROPERTY_ID,
  bacnetEnum,
} = require('./bacnet.constants');

const DEVICE_OBJECT_TYPE_ID = OBJECT_TYPE_BY_ABBR.DEVICE;
const MODEL_NAME_PROPERTY_ID = bacnetEnum.PropertyIdentifier.MODEL_NAME;
const IAM_LOOKUP_TIMEOUT_MS = 2000;

function toPrismaJson(value) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value;
}

function normalizeAddress(address) {
  return String(address || '').trim();
}

/**
 * Try a scoped Who-Is to collect I-Am metadata (vendorId, maxApdu, segmentation).
 */
async function lookupIamMetadata(address, deviceInstance) {
  const normalizedAddress = normalizeAddress(address);
  const result = await discoverDevices({
    lowLimit: deviceInstance,
    highLimit: deviceInstance,
    timeoutMs: IAM_LOOKUP_TIMEOUT_MS,
  });

  return (
    result.devices.find(
      (device) =>
        normalizeAddress(device.address) === normalizedAddress &&
        Number(device.deviceInstance) === Number(deviceInstance)
    ) || null
  );
}

async function readDeviceStringProperty(address, deviceInstance, propertyId) {
  try {
    const result = await readPropertyAsync(
      address,
      { type: DEVICE_OBJECT_TYPE_ID, instance: deviceInstance },
      propertyId
    );
    const entry = result?.values?.[0];
    if (!entry || entry.value == null) {
      return null;
    }
    return String(entry.value);
  } catch (_err) {
    return null;
  }
}

async function readDeviceMetadata(address, deviceInstance, discoveredObjects) {
  const deviceObject = discoveredObjects.find(
    (object) =>
      object.objectTypeId === DEVICE_OBJECT_TYPE_ID &&
      Number(object.objectInstance) === Number(deviceInstance)
  );

  const [objectNameFromWire, modelName] = await Promise.all([
    deviceObject?.objectName
      ? Promise.resolve(deviceObject.objectName)
      : readDeviceStringProperty(address, deviceInstance, OBJECT_NAME_PROPERTY_ID),
    readDeviceStringProperty(address, deviceInstance, MODEL_NAME_PROPERTY_ID),
  ]);

  return {
    objectName: objectNameFromWire ?? deviceObject?.objectName ?? null,
    modelName,
  };
}

function buildObjectUpsertData(bacnetDeviceId, object, lastReadAt) {
  return {
    bacnetDeviceId,
    objectType: object.objectType,
    objectTypeId: object.objectTypeId,
    objectInstance: object.objectInstance,
    objectName: object.objectName ?? null,
    description: object.description ?? null,
    presentValue: toPrismaJson(object.presentValue),
    units: object.units != null ? String(object.units) : null,
    outOfService: object.outOfService ?? null,
    reliability: object.reliability != null ? String(object.reliability) : null,
    lastReadAt,
  };
}

/**
 * Discover BACnet objects on a device and persist results to staging tables.
 * @param {{ address: string, deviceInstance: number, limit?: number }} params
 */
async function importDiscovery(params = {}) {
  const discoveryResult = await discoverObjectsService.discoverObjects(params);
  const { address, deviceInstance } = discoveryResult.device;
  const lastReadAt = new Date();

  const [iamMetadata, deviceMetadata] = await Promise.all([
    lookupIamMetadata(address, deviceInstance).catch(() => null),
    readDeviceMetadata(address, deviceInstance, discoveryResult.objects),
  ]);

  const bacnetDevice = await prisma.bacnetDevice.upsert({
    where: {
      deviceInstance_address: {
        deviceInstance,
        address,
      },
    },
    create: {
      deviceInstance,
      address,
      vendorId: iamMetadata?.vendorId ?? null,
      maxApdu: iamMetadata?.maxApdu ?? null,
      segmentation: iamMetadata?.segmentation ?? null,
      protocol: iamMetadata?.protocol ?? 'BACnet/IP',
      objectName: deviceMetadata.objectName,
      modelName: deviceMetadata.modelName,
      lastSeenAt: lastReadAt,
    },
    update: {
      vendorId: iamMetadata?.vendorId ?? undefined,
      maxApdu: iamMetadata?.maxApdu ?? undefined,
      segmentation: iamMetadata?.segmentation ?? undefined,
      protocol: iamMetadata?.protocol ?? 'BACnet/IP',
      objectName: deviceMetadata.objectName ?? undefined,
      modelName: deviceMetadata.modelName ?? undefined,
      lastSeenAt: lastReadAt,
    },
  });

  let objectsUpserted = 0;
  for (const object of discoveryResult.objects) {
    await prisma.bacnetDiscoveredObject.upsert({
      where: {
        bacnetDeviceId_objectTypeId_objectInstance: {
          bacnetDeviceId: bacnetDevice.id,
          objectTypeId: object.objectTypeId,
          objectInstance: object.objectInstance,
        },
      },
      create: buildObjectUpsertData(bacnetDevice.id, object, lastReadAt),
      update: buildObjectUpsertData(bacnetDevice.id, object, lastReadAt),
    });
    objectsUpserted += 1;
  }

  return {
    device: {
      id: bacnetDevice.id,
      address: bacnetDevice.address,
      deviceInstance: bacnetDevice.deviceInstance,
      vendorId: bacnetDevice.vendorId,
      maxApdu: bacnetDevice.maxApdu,
      segmentation: bacnetDevice.segmentation,
      protocol: bacnetDevice.protocol,
      objectName: bacnetDevice.objectName,
      modelName: bacnetDevice.modelName,
      lastSeenAt: bacnetDevice.lastSeenAt?.toISOString() ?? null,
    },
    totalObjectsDiscovered: discoveryResult.totalObjectsDiscovered,
    objectsScanned: discoveryResult.objectsScanned,
    objectsUpserted,
    importedAt: lastReadAt.toISOString(),
  };
}

module.exports = {
  importDiscovery,
};
