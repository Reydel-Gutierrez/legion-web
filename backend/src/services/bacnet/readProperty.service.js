'use strict';

const { HttpError } = require('../../lib/httpError');
const {
  readPropertyAsync,
  resolveTarget,
  objectTypeToAbbr,
} = require('./bacnetClient');
const { PRESENT_VALUE_PROPERTY_ID } = require('./bacnet.constants');

function normalizePresentValue(entry) {
  if (!entry) return null;

  if (entry.value !== undefined) {
    if (entry.type === 9 && typeof entry.value === 'number') {
      return entry.value === 1 ? 'active' : entry.value === 0 ? 'inactive' : entry.value;
    }
    return entry.value;
  }

  return entry;
}

/**
 * Read presentValue for one BACnet object.
 * Accepts manual { address, objectType, objectInstance } or { pointsMappedId }.
 */
async function readPresentValue(params = {}) {
  const target = await resolveTarget(params);

  if (target.source === 'pointsMapped' && target.readEnabled === false) {
    throw new HttpError(400, 'PointsMapped row has readEnabled=false');
  }

  let result;
  try {
    result = await readPropertyAsync(
      target.address,
      { type: target.objectType, instance: target.objectInstance },
      PRESENT_VALUE_PROPERTY_ID
    );
  } catch (err) {
    throw new HttpError(502, `BACnet read failed: ${err.message || err}`);
  }

  const rawValue = result?.values?.[0] || null;
  const presentValue = normalizePresentValue(rawValue);

  return {
    source: target.source,
    address: target.address,
    deviceInstance: target.deviceInstance,
    objectType: objectTypeToAbbr(target.objectType),
    objectTypeId: target.objectType,
    objectInstance: target.objectInstance,
    propertyId: PRESENT_VALUE_PROPERTY_ID,
    presentValue,
    raw: rawValue,
    readAt: new Date().toISOString(),
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
  readPresentValue,
  normalizePresentValue,
};
