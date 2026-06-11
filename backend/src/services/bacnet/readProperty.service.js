'use strict';

const { HttpError } = require('../../lib/httpError');
const {
  readPropertyAsync,
  resolveAddress,
  resolveObjectType,
  resolveObjectInstance,
  objectTypeToAbbr,
} = require('./bacnetClient');
const {
  resolvePropertyIdentifier,
  propertyIdentifierToName,
  normalizeReadPropertyValues,
  normalizePresentValue,
} = require('./propertyValue.util');

/**
 * Low-level BACnet read-property for engineering tools.
 * Accepts property names (objectName) or numeric property IDs.
 */
async function readProperty(params = {}) {
  const address = resolveAddress(params.address);
  const objectType = resolveObjectType(params.objectType);
  const objectInstance = resolveObjectInstance(params.objectInstance);
  const propertyId = resolvePropertyIdentifier(params.property);
  const propertyKey = propertyIdentifierToName(propertyId);

  let result;
  try {
    result = await readPropertyAsync(
      address,
      { type: objectType, instance: objectInstance },
      propertyId
    );
  } catch (err) {
    throw new HttpError(502, `BACnet read failed: ${err.message || err}`);
  }

  const rawValue = result?.values ?? null;
  const value = normalizeReadPropertyValues(rawValue, { propertyKey, propertyId });

  return {
    objectType: objectTypeToAbbr(objectType),
    objectInstance,
    property: params.property != null ? String(params.property) : propertyKey,
    value,
    rawValue,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Read presentValue for one BACnet object.
 * Accepts manual { address, objectType, objectInstance } or { pointsMappedId }.
 */
async function readPresentValue(params = {}) {
  const { resolveTarget } = require('./bacnetClient');
  const { PRESENT_VALUE_PROPERTY_ID } = require('./bacnet.constants');
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
  readProperty,
  readPresentValue,
  normalizePresentValue,
};
