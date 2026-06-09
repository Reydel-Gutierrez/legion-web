'use strict';

const { HttpError } = require('../../lib/httpError');
const {
  writePropertyAsync,
  resolveTarget,
  objectTypeToAbbr,
} = require('./bacnetClient');
const {
  bacnetEnum,
  PRESENT_VALUE_PROPERTY_ID,
  DEFAULT_WRITE_PRIORITY,
  MIN_WRITE_PRIORITY,
  MAX_WRITE_PRIORITY,
  BINARY_OBJECT_TYPES,
  MULTI_STATE_OBJECT_TYPES,
} = require('./bacnet.constants');

function resolveWritePriority(priority) {
  const resolved = priority == null ? DEFAULT_WRITE_PRIORITY : Number(priority);
  if (!Number.isInteger(resolved) || resolved < MIN_WRITE_PRIORITY || resolved > MAX_WRITE_PRIORITY) {
    throw new HttpError(
      400,
      `priority must be an integer between ${MIN_WRITE_PRIORITY} and ${MAX_WRITE_PRIORITY}`
    );
  }
  return resolved;
}

function encodeBinaryPresentValue(value) {
  if (typeof value === 'boolean') {
    return { type: bacnetEnum.ApplicationTag.ENUMERATED, value: value ? 1 : 0 };
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'active' || normalized === '1' || normalized === 'true') {
    return { type: bacnetEnum.ApplicationTag.ENUMERATED, value: 1 };
  }
  if (normalized === 'inactive' || normalized === '0' || normalized === 'false') {
    return { type: bacnetEnum.ApplicationTag.ENUMERATED, value: 0 };
  }

  throw new HttpError(400, 'Binary presentValue must be active/inactive, true/false, or 0/1');
}

function encodePresentValue(value, objectType) {
  if (value === undefined || value === null) {
    throw new HttpError(400, 'value is required');
  }

  if (BINARY_OBJECT_TYPES.has(objectType)) {
    return encodeBinaryPresentValue(value);
  }

  if (MULTI_STATE_OBJECT_TYPES.has(objectType)) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new HttpError(400, 'Multi-state presentValue must be a non-negative integer');
    }
    return { type: bacnetEnum.ApplicationTag.UNSIGNED_INTEGER, value: n };
  }

  if (typeof value === 'boolean') {
    return { type: bacnetEnum.ApplicationTag.BOOLEAN, value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { type: bacnetEnum.ApplicationTag.REAL, value };
    }
    return { type: bacnetEnum.ApplicationTag.REAL, value };
  }

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && String(value).trim() !== '') {
    return { type: bacnetEnum.ApplicationTag.REAL, value: asNumber };
  }

  return { type: bacnetEnum.ApplicationTag.CHARACTER_STRING, value: String(value) };
}

/**
 * Write presentValue using BACnet priority (default 8).
 * Accepts manual fields or pointsMappedId.
 */
async function writePresentValue(params = {}) {
  const target = await resolveTarget(params);

  if (target.source === 'pointsMapped' && target.writeEnabled === false) {
    throw new HttpError(400, 'PointsMapped row has writeEnabled=false');
  }

  const priority = resolveWritePriority(params.priority);
  const encodedValue = encodePresentValue(params.value, target.objectType);

  try {
    await writePropertyAsync(
      target.address,
      { type: target.objectType, instance: target.objectInstance },
      PRESENT_VALUE_PROPERTY_ID,
      [encodedValue],
      { priority }
    );
  } catch (err) {
    throw new HttpError(502, `BACnet write failed: ${err.message || err}`);
  }

  return {
    ok: true,
    source: target.source,
    address: target.address,
    deviceInstance: target.deviceInstance,
    objectType: objectTypeToAbbr(target.objectType),
    objectTypeId: target.objectType,
    objectInstance: target.objectInstance,
    propertyId: PRESENT_VALUE_PROPERTY_ID,
    written: {
      value: params.value,
      priority,
      encoded: encodedValue,
    },
    writtenAt: new Date().toISOString(),
    mapping:
      target.source === 'pointsMapped'
        ? {
            pointsMappedId: target.pointsMappedId,
            equipmentControllerId: target.equipmentControllerId,
            fieldPointKey: target.fieldPointKey,
          }
        : null,
  };
}

module.exports = {
  writePresentValue,
  encodePresentValue,
};
