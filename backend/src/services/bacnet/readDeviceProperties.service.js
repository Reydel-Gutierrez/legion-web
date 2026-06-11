'use strict';

const { HttpError } = require('../../lib/httpError');
const {
  readPropertyAsync,
  resolveAddress,
} = require('./bacnetClient');
const {
  DEVICE_IDENTITY_PROPERTY_SPECS,
  OBJECT_TYPE_BY_ABBR,
} = require('./bacnet.constants');
const {
  normalizeReadPropertyValues,
} = require('./propertyValue.util');
const {
  readDeviceObjectList,
  readDevicePropertyList,
} = require('./arrayProperty.util');

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

async function readSingleDeviceProperty(address, deviceInstance, spec) {
  const deviceObjectId = {
    type: OBJECT_TYPE_BY_ABBR.DEVICE,
    instance: deviceInstance,
  };

  if (spec.array) {
    if (spec.key === 'objectList') {
      return readDeviceObjectList(address, deviceObjectId);
    }
    if (spec.key === 'propertyList') {
      return readDevicePropertyList(address, deviceObjectId);
    }
  }

  const result = await readPropertyAsync(address, deviceObjectId, spec.propertyId);
  return normalizeReadPropertyValues(result?.values, {
    propertyKey: spec.key,
    propertyId: spec.propertyId,
  });
}

/**
 * Read standard DEVICE object identity and capability properties.
 * Individual property failures are captured in errors without failing the request.
 */
async function readDeviceProperties(params = {}) {
  const address = resolveAddress(params.address);
  const deviceInstance = resolveDeviceInstance(params.deviceInstance);

  const properties = {};
  const errors = {};

  for (const spec of DEVICE_IDENTITY_PROPERTY_SPECS) {
    try {
      properties[spec.key] = await readSingleDeviceProperty(address, deviceInstance, spec);
    } catch (err) {
      errors[spec.key] = err?.message || String(err);
    }
  }

  return {
    deviceInstance,
    address,
    properties,
    errors,
    readAt: new Date().toISOString(),
  };
}

module.exports = {
  readDeviceProperties,
};
