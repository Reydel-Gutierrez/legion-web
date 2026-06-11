'use strict';

const { readPropertyAsync } = require('./bacnetClient');
const {
  parseObjectIdentifier,
  parseObjectIdentifierList,
  parsePropertyIdentifierList,
  normalizeEngineeringValue,
} = require('./propertyValue.util');

function extractUnsigned(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry.value === 'number') {
    return entry.value;
  }

  return null;
}

/**
 * Read a BACnet array property (object-list, property-list, etc.).
 * Tries a full-array read first, then indexed reads (0 = count, 1..n = elements).
 */
async function readArrayProperty(address, objectId, propertyId, elementParser) {
  try {
    const fullResult = await readPropertyAsync(address, objectId, propertyId);
    const parsed = elementParser(fullResult?.values);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch (_err) {
    // Fall back to indexed reads below.
  }

  const countResult = await readPropertyAsync(address, objectId, propertyId, {
    arrayIndex: 0,
  });
  const count = extractUnsigned(countResult?.values?.[0]);
  if (!count || count < 1) {
    return [];
  }

  const elements = [];
  for (let index = 1; index <= count; index += 1) {
    try {
      const itemResult = await readPropertyAsync(address, objectId, propertyId, {
        arrayIndex: index,
      });
      const entry = itemResult?.values?.[0];
      if (!entry) continue;

      if (elementParser === parseObjectIdentifierList) {
        const identifier = parseObjectIdentifier(entry);
        if (identifier) elements.push(identifier);
      } else if (elementParser === parsePropertyIdentifierList) {
        const propertyEntry = parsePropertyIdentifierList([entry])[0];
        if (propertyEntry) elements.push(propertyEntry);
      } else {
        const normalized = normalizeEngineeringValue(entry);
        if (normalized != null) elements.push(normalized);
      }
    } catch (_err) {
      // Skip missing indices; continue scanning the rest of the array.
    }
  }

  return elements;
}

async function readDeviceObjectList(address, deviceObjectId) {
  return readArrayProperty(address, deviceObjectId, require('./bacnet.constants').OBJECT_LIST_PROPERTY_ID, parseObjectIdentifierList);
}

async function readDevicePropertyList(address, deviceObjectId) {
  return readArrayProperty(
    address,
    deviceObjectId,
    require('./bacnet.constants').PROPERTY_LIST_PROPERTY_ID,
    parsePropertyIdentifierList
  );
}

module.exports = {
  readArrayProperty,
  readDeviceObjectList,
  readDevicePropertyList,
};
