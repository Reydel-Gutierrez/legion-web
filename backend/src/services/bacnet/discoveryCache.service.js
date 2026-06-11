'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const {
  OBJECT_TYPE_BY_ABBR,
  COMMANDABLE_OBJECT_TYPE_ABBRS,
  READABLE_OBJECT_TYPE_ABBRS,
} = require('./bacnet.constants');

function toIso(value) {
  return value ? value.toISOString() : null;
}

function toDeviceDto(row) {
  return {
    id: row.id,
    deviceInstance: row.deviceInstance,
    address: row.address,
    vendorId: row.vendorId,
    maxApdu: row.maxApdu,
    segmentation: row.segmentation,
    protocol: row.protocol,
    objectName: row.objectName,
    modelName: row.modelName,
    lastSeenAt: toIso(row.lastSeenAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    _count: {
      discoveredObjects: row._count?.discoveredObjects ?? 0,
    },
  };
}

function toObjectDto(row) {
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
    lastReadAt: toIso(row.lastReadAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseQueryBool(value) {
  if (value == null || value === '') {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function resolveObjectTypeFilter(objectType) {
  if (objectType == null || String(objectType).trim() === '') {
    return null;
  }

  const abbr = String(objectType).trim().toUpperCase();
  if (!OBJECT_TYPE_BY_ABBR[abbr]) {
    throw new HttpError(400, `Unsupported BACnet objectType "${objectType}"`);
  }

  return abbr;
}

function buildObjectWhere(deviceId, query = {}) {
  const where = { bacnetDeviceId: deviceId };
  const and = [];

  const objectType = resolveObjectTypeFilter(query.objectType);
  if (objectType) {
    and.push({ objectType });
  }

  if (parseQueryBool(query.commandable)) {
    and.push({ objectType: { in: COMMANDABLE_OBJECT_TYPE_ABBRS } });
  }

  if (parseQueryBool(query.readable)) {
    and.push({ objectType: { in: READABLE_OBJECT_TYPE_ABBRS } });
  }

  const search = String(query.search || '').trim();
  if (search) {
    const or = [
      { objectName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { objectType: { contains: search, mode: 'insensitive' } },
    ];

    if (/^\d+$/.test(search)) {
      or.push({ objectInstance: Number(search) });
    }

    const refMatch = search.match(/^([A-Za-z]+)-(\d+)$/);
    if (refMatch) {
      const refType = refMatch[1].toUpperCase();
      if (OBJECT_TYPE_BY_ABBR[refType]) {
        or.push({
          AND: [{ objectType: refType }, { objectInstance: Number(refMatch[2]) }],
        });
      }
    }

    and.push({ OR: or });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

async function listDevices() {
  const rows = await prisma.bacnetDevice.findMany({
    orderBy: [{ lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: {
        select: { discoveredObjects: true },
      },
    },
  });

  return {
    devices: rows.map(toDeviceDto),
  };
}

async function listDeviceObjects(deviceId, query = {}) {
  const id = String(deviceId || '').trim();
  if (!id) {
    throw new HttpError(400, 'device id is required');
  }

  const device = await prisma.bacnetDevice.findUnique({
    where: { id },
    select: {
      id: true,
      address: true,
      deviceInstance: true,
    },
  });

  if (!device) {
    throw new HttpError(404, 'BacnetDevice not found');
  }

  const rows = await prisma.bacnetDiscoveredObject.findMany({
    where: buildObjectWhere(device.id, query),
    orderBy: [{ objectTypeId: 'asc' }, { objectInstance: 'asc' }],
  });

  return {
    device: {
      id: device.id,
      address: device.address,
      deviceInstance: device.deviceInstance,
    },
    objects: rows.map(toObjectDto),
  };
}

module.exports = {
  listDevices,
  listDeviceObjects,
};
