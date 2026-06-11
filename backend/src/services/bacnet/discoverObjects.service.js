'use strict';

const { HttpError } = require('../../lib/httpError');
const {
  readPropertyAsync,
  resolveAddress,
  objectTypeToAbbr,
} = require('./bacnetClient');
const { normalizePresentValue } = require('./readProperty.service');
const {
  bacnetEnum,
  OBJECT_TYPE_BY_ABBR,
  OBJECT_NAME_PROPERTY_ID,
  DESCRIPTION_PROPERTY_ID,
  PRESENT_VALUE_PROPERTY_ID,
  UNITS_PROPERTY_ID,
  OUT_OF_SERVICE_PROPERTY_ID,
  RELIABILITY_PROPERTY_ID,
} = require('./bacnet.constants');
const { readDeviceObjectList } = require('./arrayProperty.util');

const OBJECT_IDENTIFIER_TAG = bacnetEnum.ApplicationTag.OBJECTIDENTIFIER;
const UNSIGNED_INTEGER_TAG = bacnetEnum.ApplicationTag.UNSIGNED_INTEGER;
const BOOLEAN_TAG = bacnetEnum.ApplicationTag.BOOLEAN;
const ENUMERATED_TAG = bacnetEnum.ApplicationTag.ENUMERATED;
const CHARACTER_STRING_TAG = bacnetEnum.ApplicationTag.CHARACTER_STRING;

const OBJECT_PROPERTY_READS = [
  { key: 'objectName', propertyId: OBJECT_NAME_PROPERTY_ID },
  { key: 'description', propertyId: DESCRIPTION_PROPERTY_ID },
  { key: 'presentValue', propertyId: PRESENT_VALUE_PROPERTY_ID },
  { key: 'units', propertyId: UNITS_PROPERTY_ID },
  { key: 'outOfService', propertyId: OUT_OF_SERVICE_PROPERTY_ID },
  { key: 'reliability', propertyId: RELIABILITY_PROPERTY_ID },
];

function resolveDeviceInstance(deviceInstance) {
  if (deviceInstance == null || String(deviceInstance).trim() === '') {
    throw new HttpError(400, 'deviceInstance is required');
  }

  const n = Number(deviceInstance);
  if (!Number.isInteger(n) || n < 0) {
    throw new HttpError(400, 'deviceInstance must be a non-negative integer');
  }
  return n;
}

function resolveLimit(limit) {
  if (limit == null || limit === '') {
    return null;
  }

  const n = Number(limit);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, 'limit must be a positive integer');
  }
  return n;
}

function parseObjectIdentifier(entry) {
  if (!entry) {
    return null;
  }

  if (entry.type === OBJECT_IDENTIFIER_TAG && entry.value?.type != null && entry.value?.instance != null) {
    return {
      objectTypeId: entry.value.type,
      objectInstance: entry.value.instance,
    };
  }

  if (entry.value?.type != null && entry.value?.instance != null) {
    return {
      objectTypeId: entry.value.type,
      objectInstance: entry.value.instance,
    };
  }

  return null;
}

function parseObjectListValues(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(parseObjectIdentifier).filter(Boolean);
}

function extractUnsigned(entry) {
  if (!entry) {
    return null;
  }

  if (entry.type === UNSIGNED_INTEGER_TAG && typeof entry.value === 'number') {
    return entry.value;
  }

  if (typeof entry.value === 'number') {
    return entry.value;
  }

  return null;
}

function normalizePropertyValue(propertyKey, entry) {
  if (!entry) {
    return null;
  }

  switch (propertyKey) {
    case 'presentValue':
      return normalizePresentValue(entry);
    case 'objectName':
    case 'description':
      if (entry.type === CHARACTER_STRING_TAG || typeof entry.value === 'string') {
        return entry.value != null ? String(entry.value) : null;
      }
      return entry.value != null ? String(entry.value) : null;
    case 'outOfService':
      if (entry.type === BOOLEAN_TAG) {
        return !!entry.value;
      }
      return entry.value;
    case 'units':
      if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
        return bacnetEnum.EngineeringUnitsName[entry.value] || entry.value;
      }
      return entry.value;
    case 'reliability':
      if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
        return bacnetEnum.ReliabilityName[entry.value] || entry.value;
      }
      return entry.value;
    default:
      return entry.value;
  }
}

/**
 * Read common BACnet object properties for discovery scans.
 */
async function readObjectProperties(address, objectRef) {
  const objectId = {
    type: objectRef.objectTypeId,
    instance: objectRef.objectInstance,
  };

  const result = {
    objectType: objectRef.objectType,
    objectTypeId: objectRef.objectTypeId,
    objectInstance: objectRef.objectInstance,
    objectName: null,
    description: null,
    presentValue: null,
    units: null,
    outOfService: null,
    reliability: null,
  };

  const errors = {};

  for (const { key, propertyId } of OBJECT_PROPERTY_READS) {
    try {
      const readResult = await readPropertyAsync(address, objectId, propertyId);
      result[key] = normalizePropertyValue(key, readResult?.values?.[0]);
    } catch (err) {
      errors[key] = err?.message || String(err);
    }
  }

  if (Object.keys(errors).length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Discover BACnet objects on a device by reading its object-list and per-object properties.
 * @param {{ address: string, deviceInstance: number, limit?: number }} params
 */
async function discoverObjects(params = {}) {
  const address = resolveAddress(params.address);
  const deviceInstance = resolveDeviceInstance(params.deviceInstance);
  const limit = resolveLimit(params.limit);

  let rawIdentifiers;
  try {
    rawIdentifiers = await readDeviceObjectList(address, {
      type: OBJECT_TYPE_BY_ABBR.DEVICE,
      instance: deviceInstance,
    });
  } catch (err) {
    throw new HttpError(502, `BACnet object-list read failed: ${err.message || err}`);
  }

  const normalizedIdentifiers = rawIdentifiers.map((identifier) => ({
    objectTypeId: identifier.objectTypeId,
    objectInstance: identifier.objectInstance,
    objectType: objectTypeToAbbr(identifier.objectTypeId),
  }));

  const totalObjectsDiscovered = normalizedIdentifiers.length;
  const identifiersToScan =
    limit != null ? normalizedIdentifiers.slice(0, limit) : normalizedIdentifiers;

  const objects = [];
  for (const identifier of identifiersToScan) {
    objects.push(await readObjectProperties(address, identifier));
  }

  return {
    device: {
      address,
      deviceInstance,
    },
    totalObjectsDiscovered,
    objectsScanned: objects.length,
    objects,
  };
}

module.exports = {
  discoverObjects,
  parseObjectIdentifier,
  parseObjectListValues,
  normalizePropertyValue,
};
