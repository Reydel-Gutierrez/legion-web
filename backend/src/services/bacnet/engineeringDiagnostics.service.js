'use strict';

const {
  OBJECT_TYPE_BY_ABBR,
  EXPLORER_GROUP_BY_OBJECT_ABBR,
  EXPLORER_TREE_GROUP_KEYS,
  PROPRIETARY_OBJECT_TYPE_THRESHOLD,
  SIEMENS_VENDOR_ID,
} = require('./bacnet.constants');

function createEmptyExplorerGroups() {
  return EXPLORER_TREE_GROUP_KEYS.reduce((groups, key) => {
    groups[key] = [];
    return groups;
  }, {});
}

function resolveExplorerGroupKey(objectTypeAbbr, objectTypeId) {
  if (objectTypeId >= PROPRIETARY_OBJECT_TYPE_THRESHOLD) {
    return 'proprietary';
  }

  return EXPLORER_GROUP_BY_OBJECT_ABBR[objectTypeAbbr] || 'unknown';
}

function toExplorerTreeNode(row) {
  return {
    id: row.id,
    objectType: row.objectType,
    objectTypeId: row.objectTypeId,
    objectInstance: row.objectInstance,
    objectName: row.objectName,
    description: row.description,
    presentValue: row.presentValue ?? null,
    units: row.units,
    reliability: row.reliability,
    outOfService: row.outOfService,
    lastReadAt: row.lastReadAt ? row.lastReadAt.toISOString() : null,
  };
}

function classifyDiscoveredObjects(objectRows) {
  const groups = createEmptyExplorerGroups();

  for (const row of objectRows) {
    const groupKey = resolveExplorerGroupKey(row.objectType, row.objectTypeId);
    groups[groupKey].push(toExplorerTreeNode(row));
  }

  for (const key of EXPLORER_TREE_GROUP_KEYS) {
    groups[key].sort((a, b) => {
      if (a.objectTypeId !== b.objectTypeId) {
        return a.objectTypeId - b.objectTypeId;
      }
      return a.objectInstance - b.objectInstance;
    });
  }

  return groups;
}

function objectIdentifierKey(objectTypeId, objectInstance) {
  return `${objectTypeId}:${objectInstance}`;
}

function buildDeviceExposureFindings({
  device,
  cachedObjects,
  liveObjectList,
  livePropertyList,
}) {
  const findings = [];
  const cachedKeys = new Set(
    cachedObjects.map((object) => objectIdentifierKey(object.objectTypeId, object.objectInstance))
  );

  if (Array.isArray(liveObjectList)) {
    const liveKeys = liveObjectList.map((entry) =>
      objectIdentifierKey(entry.objectTypeId, entry.objectInstance)
    );
    const liveKeySet = new Set(liveKeys);
    const missingFromCache = liveObjectList.filter(
      (entry) => !cachedKeys.has(objectIdentifierKey(entry.objectTypeId, entry.objectInstance))
    );

    if (liveObjectList.length > cachedObjects.length) {
      findings.push({
        code: 'MORE_OBJECTS_ON_WIRE_THAN_CACHE',
        message: `Device exposes ${liveObjectList.length} objects on object-list but only ${cachedObjects.length} are cached.`,
        liveObjectCount: liveObjectList.length,
        cachedObjectCount: cachedObjects.length,
        missingFromCacheCount: missingFromCache.length,
        missingFromCacheSample: missingFromCache.slice(0, 25).map((entry) => ({
          objectType: entry.objectType,
          objectTypeId: entry.objectTypeId,
          objectInstance: entry.objectInstance,
        })),
      });
    }

    const cachedNotOnWire = cachedObjects.filter(
      (object) => !liveKeySet.has(objectIdentifierKey(object.objectTypeId, object.objectInstance))
    );
    if (cachedNotOnWire.length > 0) {
      findings.push({
        code: 'CACHED_OBJECTS_NOT_ON_WIRE',
        message: `${cachedNotOnWire.length} cached object(s) are absent from the live object-list.`,
        count: cachedNotOnWire.length,
        sample: cachedNotOnWire.slice(0, 25).map((object) => ({
          id: object.id,
          objectType: object.objectType,
          objectInstance: object.objectInstance,
        })),
      });
    }

    const downstreamDevices = liveObjectList.filter(
      (entry) =>
        entry.objectTypeId === OBJECT_TYPE_BY_ABBR.DEVICE &&
        Number(entry.objectInstance) !== Number(device.deviceInstance)
    );
    if (downstreamDevices.length > 0) {
      findings.push({
        code: 'DOWNSTREAM_DEVICES_EXPOSED',
        message: `${downstreamDevices.length} downstream DEVICE object(s) appear on object-list.`,
        devices: downstreamDevices.map((entry) => ({
          deviceInstance: entry.objectInstance,
          objectType: entry.objectType,
        })),
      });
    }
  }

  const proprietaryObjects = cachedObjects.filter(
    (object) => object.objectTypeId >= PROPRIETARY_OBJECT_TYPE_THRESHOLD
  );
  if (proprietaryObjects.length > 0) {
    findings.push({
      code: 'PROPRIETARY_OBJECT_TYPES_PRESENT',
      message: `${proprietaryObjects.length} cached object(s) use vendor-proprietary BACnet object types.`,
      count: proprietaryObjects.length,
      sample: proprietaryObjects.slice(0, 25).map((object) => ({
        id: object.id,
        objectType: object.objectType,
        objectTypeId: object.objectTypeId,
        objectInstance: object.objectInstance,
        objectName: object.objectName,
      })),
    });
  }

  if (Number(device.vendorId) === SIEMENS_VENDOR_ID && proprietaryObjects.length > 0) {
    findings.push({
      code: 'SIEMENS_PROPRIETARY_OBJECTS',
      message: 'Siemens controller exposes proprietary BACnet object types.',
      vendorId: device.vendorId,
      count: proprietaryObjects.length,
      sample: proprietaryObjects.slice(0, 25).map((object) => ({
        objectType: object.objectType,
        objectTypeId: object.objectTypeId,
        objectInstance: object.objectInstance,
        objectName: object.objectName,
      })),
    });
  }

  if (Array.isArray(livePropertyList) && livePropertyList.length > 0) {
    const cachedPropertyKeys = new Set([
      'objectName',
      'description',
      'presentValue',
      'units',
      'reliability',
      'outOfService',
    ]);
    const unreadProperties = livePropertyList.filter(
      (entry) => !cachedPropertyKeys.has(entry.propertyName?.toLowerCase?.() || '')
    );
    if (unreadProperties.length > 0) {
      findings.push({
        code: 'ADDITIONAL_PROPERTIES_ON_DEVICE',
        message: 'Device property-list exposes properties beyond the standard discovery scan.',
        count: unreadProperties.length,
        sample: unreadProperties.slice(0, 25),
      });
    }
  }

  const liveTypeIds = new Set(
    (liveObjectList || []).map((entry) => entry.objectTypeId)
  );
  const cachedTypeIds = new Set(cachedObjects.map((object) => object.objectTypeId));
  const liveOnlyTypes = [...liveTypeIds].filter((typeId) => !cachedTypeIds.has(typeId));
  if (liveOnlyTypes.length > 0) {
    findings.push({
      code: 'ADDITIONAL_OBJECT_TYPES_ON_WIRE',
      message: 'Live object-list includes BACnet object types not present in the discovery cache.',
      objectTypeIds: liveOnlyTypes,
    });
  }

  return findings;
}

function logEngineeringDiagnostics(context, findings) {
  if (!findings || findings.length === 0) {
    return;
  }

  // eslint-disable-next-line no-console
  console.info(
    '[bacnet-diagnostics]',
    JSON.stringify({
      at: new Date().toISOString(),
      context,
      findings,
    })
  );
}

module.exports = {
  createEmptyExplorerGroups,
  resolveExplorerGroupKey,
  toExplorerTreeNode,
  classifyDiscoveredObjects,
  buildDeviceExposureFindings,
  logEngineeringDiagnostics,
};
