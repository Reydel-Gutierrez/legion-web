'use strict';

const { bacnetEnum } = require('./bacnet.constants');
const { objectTypeToAbbr } = require('./bacnetClient');

function normalizePresentValue(entry) {
  if (!entry) return null;

  if (entry.value !== undefined) {
    if (entry.type === bacnetEnum.ApplicationTag.ENUMERATED && typeof entry.value === 'number') {
      return entry.value;
    }
    if (entry.type === bacnetEnum.ApplicationTag.ENUMERATED && entry.value === 1) {
      return 'active';
    }
    if (entry.type === bacnetEnum.ApplicationTag.ENUMERATED && entry.value === 0) {
      return 'inactive';
    }
    if (entry.type === 9 && typeof entry.value === 'number') {
      return entry.value === 1 ? 'active' : entry.value === 0 ? 'inactive' : entry.value;
    }
    return entry.value;
  }

  return entry;
}

const OBJECT_IDENTIFIER_TAG = bacnetEnum.ApplicationTag.OBJECTIDENTIFIER;
const UNSIGNED_INTEGER_TAG = bacnetEnum.ApplicationTag.UNSIGNED_INTEGER;
const BOOLEAN_TAG = bacnetEnum.ApplicationTag.BOOLEAN;
const ENUMERATED_TAG = bacnetEnum.ApplicationTag.ENUMERATED;
const CHARACTER_STRING_TAG = bacnetEnum.ApplicationTag.CHARACTER_STRING;
const REAL_TAG = bacnetEnum.ApplicationTag.REAL;
const DOUBLE_TAG = bacnetEnum.ApplicationTag.DOUBLE;
const SIGNED_INTEGER_TAG = bacnetEnum.ApplicationTag.SIGNED_INTEGER;
const BIT_STRING_TAG = bacnetEnum.ApplicationTag.BIT_STRING;

const PROPERTY_NAME_BY_ID = Object.fromEntries(
  Object.entries(bacnetEnum.PropertyIdentifier).map(([name, id]) => [String(id), name])
);

function normalizePropertyKey(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

/**
 * Resolve BACnet property identifier from numeric id or name (objectName, OBJECT_NAME, 77).
 */
function resolvePropertyIdentifier(property) {
  const { HttpError } = require('../../lib/httpError');

  if (property == null || String(property).trim() === '') {
    throw new HttpError(400, 'property is required');
  }

  if (typeof property === 'number' && Number.isInteger(property)) {
    return property;
  }

  const raw = String(property).trim();
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const normalized = normalizePropertyKey(raw);
  const direct = bacnetEnum.PropertyIdentifier[normalized];
  if (direct != null) {
    return direct;
  }

  const camelKey = raw.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const camelMatch = Object.entries(bacnetEnum.PropertyIdentifier).find(
    ([name]) => name.toLowerCase() === normalized.toLowerCase() || name === camelKey.toUpperCase()
  );
  if (camelMatch) {
    return camelMatch[1];
  }

  throw new HttpError(400, `Unsupported BACnet property "${property}"`);
}

function propertyIdentifierToName(propertyId) {
  return PROPERTY_NAME_BY_ID[String(propertyId)] || String(propertyId);
}

function parseObjectIdentifier(entry) {
  if (!entry) {
    return null;
  }

  if (entry.type === OBJECT_IDENTIFIER_TAG && entry.value?.type != null && entry.value?.instance != null) {
    return {
      objectTypeId: entry.value.type,
      objectInstance: entry.value.instance,
      objectType: objectTypeToAbbr(entry.value.type),
    };
  }

  if (entry.value?.type != null && entry.value?.instance != null) {
    return {
      objectTypeId: entry.value.type,
      objectInstance: entry.value.instance,
      objectType: objectTypeToAbbr(entry.value.type),
    };
  }

  return null;
}

function parseObjectIdentifierList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(parseObjectIdentifier).filter(Boolean);
}

function parsePropertyIdentifierList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => {
      if (!entry) return null;
      if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
        return {
          propertyId: entry.value,
          propertyName: propertyIdentifierToName(entry.value),
        };
      }
      if (typeof entry.value === 'number') {
        return {
          propertyId: entry.value,
          propertyName: propertyIdentifierToName(entry.value),
        };
      }
      return null;
    })
    .filter(Boolean);
}

function decodeBitString(entry) {
  if (!entry) return null;

  if (entry.type === BIT_STRING_TAG) {
    if (Array.isArray(entry.value)) {
      return entry.value.map((bit) => !!bit);
    }
    if (typeof entry.value === 'string') {
      return entry.value;
    }
  }

  if (Array.isArray(entry.value)) {
    return entry.value.map((bit) => !!bit);
  }

  return entry.value ?? null;
}

function decodeBitStringFlags(entry, nameMap) {
  const bits = decodeBitString(entry);
  if (!Array.isArray(bits)) {
    return bits;
  }

  const flags = [];
  bits.forEach((enabled, index) => {
    if (enabled) {
      flags.push(nameMap?.[String(index)] || `bit-${index}`);
    }
  });
  return flags;
}

function normalizeEngineeringValue(entry) {
  if (!entry) return null;

  if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
    return entry.value;
  }

  if (entry.type === UNSIGNED_INTEGER_TAG || entry.type === SIGNED_INTEGER_TAG) {
    return entry.value;
  }

  if (entry.type === REAL_TAG || entry.type === DOUBLE_TAG) {
    return entry.value;
  }

  if (entry.type === BOOLEAN_TAG) {
    return !!entry.value;
  }

  if (entry.type === CHARACTER_STRING_TAG || typeof entry.value === 'string') {
    return entry.value != null ? String(entry.value) : null;
  }

  if (entry.type === OBJECT_IDENTIFIER_TAG) {
    return parseObjectIdentifier(entry);
  }

  if (entry.type === BIT_STRING_TAG) {
    return decodeBitString(entry);
  }

  return entry.value ?? null;
}

/**
 * Normalize a BACnet readProperty result entry for API responses.
 */
function normalizeBacnetValue(entry, context = {}) {
  if (!entry) return null;

  const { propertyKey, propertyId } = context;

  if (propertyKey === 'presentValue' || propertyId === bacnetEnum.PropertyIdentifier.PRESENT_VALUE) {
    return normalizePresentValue(entry);
  }

  if (propertyKey === 'objectName' || propertyKey === 'description') {
    return entry.value != null ? String(entry.value) : null;
  }

  if (propertyKey === 'outOfService') {
    if (entry.type === BOOLEAN_TAG) return !!entry.value;
    return entry.value;
  }

  if (propertyKey === 'units') {
    if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
      return bacnetEnum.EngineeringUnitsName[entry.value] || entry.value;
    }
    return entry.value;
  }

  if (propertyKey === 'reliability') {
    if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
      return bacnetEnum.ReliabilityName[entry.value] || entry.value;
    }
    return entry.value;
  }

  if (propertyKey === 'segmentationSupported') {
    if (entry.type === ENUMERATED_TAG && typeof entry.value === 'number') {
      return bacnetEnum.SegmentationName[entry.value] || entry.value;
    }
    return entry.value;
  }

  if (propertyKey === 'protocolServicesSupported') {
    return decodeBitStringFlags(entry, bacnetEnum.ServicesSupportedName);
  }

  if (propertyKey === 'protocolObjectTypesSupported') {
    return decodeBitStringFlags(entry, bacnetEnum.ObjectTypesSupportedName);
  }

  if (propertyKey === 'objectList') {
    return parseObjectIdentifierList(Array.isArray(entry) ? entry : [entry]);
  }

  if (propertyKey === 'propertyList') {
    return parsePropertyIdentifierList(Array.isArray(entry) ? entry : [entry]);
  }

  return normalizeEngineeringValue(entry);
}

/**
 * Normalize full readProperty response values array.
 */
function normalizeReadPropertyValues(values, context = {}) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (context.propertyKey === 'objectList' || context.propertyKey === 'propertyList') {
    if (values.length === 1) {
      const single = normalizeBacnetValue(values[0], context);
      if (Array.isArray(single)) {
        return single;
      }
    }
    return values.map((entry) => normalizeBacnetValue(entry, context)).filter((v) => v != null);
  }

  if (values.length === 1) {
    return normalizeBacnetValue(values[0], context);
  }

  return values.map((entry) => normalizeBacnetValue(entry, context));
}

module.exports = {
  resolvePropertyIdentifier,
  propertyIdentifierToName,
  parseObjectIdentifier,
  parseObjectIdentifierList,
  parsePropertyIdentifierList,
  normalizePresentValue,
  normalizeBacnetValue,
  normalizeReadPropertyValues,
  normalizeEngineeringValue,
  decodeBitString,
  decodeBitStringFlags,
};
