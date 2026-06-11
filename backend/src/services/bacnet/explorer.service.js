'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { readPropertyAsync } = require('./bacnetClient');
const {
  OBJECT_TYPE_BY_ABBR,
  PRESENT_VALUE_PROPERTY_ID,
  OBJECT_NAME_PROPERTY_ID,
  DESCRIPTION_PROPERTY_ID,
  UNITS_PROPERTY_ID,
  OUT_OF_SERVICE_PROPERTY_ID,
  RELIABILITY_PROPERTY_ID,
} = require('./bacnet.constants');
const { normalizePropertyValue } = require('./discoverObjects.service');
const {
  classifyDiscoveredObjects,
  buildDeviceExposureFindings,
  logEngineeringDiagnostics,
} = require('./engineeringDiagnostics.service');
const {
  readDeviceObjectList,
  readDevicePropertyList,
} = require('./arrayProperty.util');

const LIVE_OBJECT_PROPERTY_READS = [
  { key: 'objectName', propertyId: OBJECT_NAME_PROPERTY_ID },
  { key: 'description', propertyId: DESCRIPTION_PROPERTY_ID },
  { key: 'presentValue', propertyId: PRESENT_VALUE_PROPERTY_ID },
  { key: 'units', propertyId: UNITS_PROPERTY_ID },
  { key: 'reliability', propertyId: RELIABILITY_PROPERTY_ID },
  { key: 'outOfService', propertyId: OUT_OF_SERVICE_PROPERTY_ID },
];

function toDiscoveredObjectDto(row) {
  return {
    id: row.id,
    bacnetDeviceId: row.bacnetDeviceId,
    objectType: row.objectType,
    objectTypeId: row.objectTypeId,
    objectInstance: row.objectInstance,
    objectName: row.objectName,
    description: row.description,
    presentValue: row.presentValue ?? null,
    units: row.units,
    outOfService: row.outOfService,
    reliability: row.reliability,
    lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toExplorerDeviceSummary(row) {
  return {
    id: row.id,
    deviceInstance: row.deviceInstance,
    address: row.address,
    objectName: row.objectName,
    modelName: row.modelName,
    protocol: row.protocol,
    objectCount: row._count?.discoveredObjects ?? 0,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    networkNumber: row.networkNumber ?? null,
    mstpMacAddress: row.mstpMacAddress ?? null,
    routerAddress: row.routerAddress ?? null,
  };
}

async function listExplorerDevices() {
  const rows = await prisma.bacnetDevice.findMany({
    orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: {
        select: { discoveredObjects: true },
      },
    },
  });

  return rows.map(toExplorerDeviceSummary);
}

async function readLiveObjectProperties(address, objectTypeId, objectInstance) {
  const objectId = {
    type: objectTypeId,
    instance: objectInstance,
  };

  const liveProperties = {
    objectName: null,
    description: null,
    presentValue: null,
    units: null,
    reliability: null,
    outOfService: null,
  };
  const errors = {};

  for (const { key, propertyId } of LIVE_OBJECT_PROPERTY_READS) {
    try {
      const result = await readPropertyAsync(address, objectId, propertyId);
      liveProperties[key] = normalizePropertyValue(key, result?.values?.[0]);
    } catch (err) {
      errors[key] = err?.message || String(err);
    }
  }

  return { liveProperties, errors };
}

async function loadDeviceWithObjects(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) {
    throw new HttpError(400, 'device id is required');
  }

  const device = await prisma.bacnetDevice.findUnique({
    where: { id },
    include: {
      discoveredObjects: {
        orderBy: [{ objectTypeId: 'asc' }, { objectInstance: 'asc' }],
      },
      _count: {
        select: { discoveredObjects: true },
      },
    },
  });

  if (!device) {
    throw new HttpError(404, 'BacnetDevice not found');
  }

  return device;
}

async function collectLiveDeviceLists(address, deviceInstance) {
  const deviceObjectId = {
    type: OBJECT_TYPE_BY_ABBR.DEVICE,
    instance: deviceInstance,
  };

  const [liveObjectList, livePropertyList] = await Promise.all([
    readDeviceObjectList(address, deviceObjectId).catch(() => null),
    readDevicePropertyList(address, deviceObjectId).catch(() => null),
  ]);

  return { liveObjectList, livePropertyList };
}

async function getDeviceTree(deviceId) {
  const device = await loadDeviceWithObjects(deviceId);
  const groups = classifyDiscoveredObjects(device.discoveredObjects);

  const { liveObjectList, livePropertyList } = await collectLiveDeviceLists(
    device.address,
    device.deviceInstance
  );

  const findings = buildDeviceExposureFindings({
    device,
    cachedObjects: device.discoveredObjects,
    liveObjectList,
    livePropertyList,
  });

  logEngineeringDiagnostics(
    {
      scope: 'explorer.deviceTree',
      deviceId: device.id,
      address: device.address,
      deviceInstance: device.deviceInstance,
    },
    findings
  );

  return {
    device: {
      id: device.id,
      deviceInstance: device.deviceInstance,
      address: device.address,
      vendorId: device.vendorId,
      objectName: device.objectName,
      modelName: device.modelName,
      protocol: device.protocol,
      objectCount: device._count.discoveredObjects,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
    },
    groups,
  };
}

async function getExplorerObject(objectId) {
  const id = String(objectId || '').trim();
  if (!id) {
    throw new HttpError(400, 'object id is required');
  }

  const discoveredObject = await prisma.bacnetDiscoveredObject.findUnique({
    where: { id },
    include: {
      bacnetDevice: true,
    },
  });

  if (!discoveredObject) {
    throw new HttpError(404, 'BacnetDiscoveredObject not found');
  }

  const { liveProperties, errors } = await readLiveObjectProperties(
    discoveredObject.bacnetDevice.address,
    discoveredObject.objectTypeId,
    discoveredObject.objectInstance
  );

  const { liveObjectList, livePropertyList } = await collectLiveDeviceLists(
    discoveredObject.bacnetDevice.address,
    discoveredObject.bacnetDevice.deviceInstance
  );

  const findings = buildDeviceExposureFindings({
    device: discoveredObject.bacnetDevice,
    cachedObjects: [discoveredObject],
    liveObjectList,
    livePropertyList,
  });

  if (Object.keys(errors).length > 0) {
    findings.push({
      code: 'LIVE_OBJECT_PROPERTY_READ_ERRORS',
      message: 'One or more live property reads failed for the requested object.',
      objectId: discoveredObject.id,
      errors,
    });
  }

  logEngineeringDiagnostics(
    {
      scope: 'explorer.objectDetail',
      objectId: discoveredObject.id,
      bacnetDeviceId: discoveredObject.bacnetDeviceId,
      address: discoveredObject.bacnetDevice.address,
      objectType: discoveredObject.objectType,
      objectInstance: discoveredObject.objectInstance,
    },
    findings
  );

  return {
    discoveredObject: toDiscoveredObjectDto(discoveredObject),
    liveProperties,
  };
}

module.exports = {
  listExplorerDevices,
  getDeviceTree,
  getExplorerObject,
};
