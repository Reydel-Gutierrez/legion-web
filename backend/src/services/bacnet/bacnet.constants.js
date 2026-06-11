'use strict';

const bacnet = require('node-bacnet');

/** Default BACnet/IP UDP port (ASHRAE 135). */
const DEFAULT_BACNET_PORT = 47808;

/** Default APDU timeout for confirmed requests (ms). */
const DEFAULT_APDU_TIMEOUT_MS = 6000;

/** How long to collect I-Am responses after a Who-Is (ms). */
const DEFAULT_DISCOVERY_TIMEOUT_MS = 5000;

/** Default write priority for operator-level overrides (BACnet priority 8). */
const DEFAULT_WRITE_PRIORITY = 8;

const MIN_WRITE_PRIORITY = 1;
const MAX_WRITE_PRIORITY = 16;

/** BACnet property identifiers used by discovery and point reads. */
const PRESENT_VALUE_PROPERTY_ID = bacnet.enum.PropertyIdentifier.PRESENT_VALUE;
const OBJECT_LIST_PROPERTY_ID = bacnet.enum.PropertyIdentifier.OBJECT_LIST;
const PROPERTY_LIST_PROPERTY_ID = bacnet.enum.PropertyIdentifier.PROPERTY_LIST;
const OBJECT_NAME_PROPERTY_ID = bacnet.enum.PropertyIdentifier.OBJECT_NAME;
const DESCRIPTION_PROPERTY_ID = bacnet.enum.PropertyIdentifier.DESCRIPTION;
const UNITS_PROPERTY_ID = bacnet.enum.PropertyIdentifier.UNITS;
const OUT_OF_SERVICE_PROPERTY_ID = bacnet.enum.PropertyIdentifier.OUT_OF_SERVICE;
const RELIABILITY_PROPERTY_ID = bacnet.enum.PropertyIdentifier.RELIABILITY;

/** Siemens BACnet vendor identifier (ASHRAE vendor ID 7). */
const SIEMENS_VENDOR_ID = 7;

/** BACnet object types at or above this id are vendor-proprietary. */
const PROPRIETARY_OBJECT_TYPE_THRESHOLD = 128;

/**
 * Short BACnet object-type abbreviations used in PointsMapped.fieldObjectType
 * and manual API payloads (e.g. "AV", "AI-1" style refs).
 */
const OBJECT_TYPE_BY_ABBR = {
  AI: bacnet.enum.ObjectType.ANALOG_INPUT,
  AO: bacnet.enum.ObjectType.ANALOG_OUTPUT,
  AV: bacnet.enum.ObjectType.ANALOG_VALUE,
  BI: bacnet.enum.ObjectType.BINARY_INPUT,
  BO: bacnet.enum.ObjectType.BINARY_OUTPUT,
  BV: bacnet.enum.ObjectType.BINARY_VALUE,
  MI: bacnet.enum.ObjectType.MULTI_STATE_INPUT,
  MO: bacnet.enum.ObjectType.MULTI_STATE_OUTPUT,
  MV: bacnet.enum.ObjectType.MULTI_STATE_VALUE,
  DEVICE: bacnet.enum.ObjectType.DEVICE,
  SCHEDULE: bacnet.enum.ObjectType.SCHEDULE,
  CALENDAR: bacnet.enum.ObjectType.CALENDAR,
  TRENDLOG: bacnet.enum.ObjectType.TREND_LOG,
  TREND_LOG: bacnet.enum.ObjectType.TREND_LOG,
  FILE: bacnet.enum.ObjectType.FILE,
  LOOP: bacnet.enum.ObjectType.LOOP,
  PROGRAM: bacnet.enum.ObjectType.PROGRAM,
  NOTIFICATION_CLASS: bacnet.enum.ObjectType.NOTIFICATION_CLASS,
  EVENT_ENROLLMENT: bacnet.enum.ObjectType.EVENT_ENROLLMENT,
  TREND_LOG_MULTIPLE: bacnet.enum.ObjectType.TREND_LOG_MULTIPLE,
};

const OBJECT_TYPE_ABBR_OVERRIDES = {
  [bacnet.enum.ObjectType.ANALOG_INPUT]: 'AI',
  [bacnet.enum.ObjectType.ANALOG_OUTPUT]: 'AO',
  [bacnet.enum.ObjectType.ANALOG_VALUE]: 'AV',
  [bacnet.enum.ObjectType.BINARY_INPUT]: 'BI',
  [bacnet.enum.ObjectType.BINARY_OUTPUT]: 'BO',
  [bacnet.enum.ObjectType.BINARY_VALUE]: 'BV',
  [bacnet.enum.ObjectType.MULTI_STATE_INPUT]: 'MI',
  [bacnet.enum.ObjectType.MULTI_STATE_OUTPUT]: 'MO',
  [bacnet.enum.ObjectType.MULTI_STATE_VALUE]: 'MV',
  [bacnet.enum.ObjectType.DEVICE]: 'DEVICE',
  [bacnet.enum.ObjectType.SCHEDULE]: 'SCHEDULE',
  [bacnet.enum.ObjectType.CALENDAR]: 'CALENDAR',
  [bacnet.enum.ObjectType.TREND_LOG]: 'TRENDLOG',
  [bacnet.enum.ObjectType.FILE]: 'FILE',
};

const OBJECT_TYPE_ABBR_BY_NUM = Object.fromEntries(
  Object.entries(bacnet.enum.ObjectType).map(([name, num]) => [
    String(num),
    OBJECT_TYPE_ABBR_OVERRIDES[num] || name,
  ])
);

/** Explorer tree group keys mapped to BACnet object-type abbreviations. */
const EXPLORER_GROUP_BY_OBJECT_ABBR = {
  DEVICE: 'deviceObjects',
  AI: 'analogInputs',
  AO: 'analogOutputs',
  AV: 'analogValues',
  BI: 'binaryInputs',
  BO: 'binaryOutputs',
  BV: 'binaryValues',
  MI: 'multistateInputs',
  MO: 'multistateOutputs',
  MV: 'multistateValues',
  SCHEDULE: 'schedules',
  CALENDAR: 'schedules',
  TRENDLOG: 'trendLogs',
  TREND_LOG: 'trendLogs',
  FILE: 'files',
};

/** Empty explorer tree scaffold for API responses. */
const EXPLORER_TREE_GROUP_KEYS = [
  'deviceObjects',
  'analogInputs',
  'analogOutputs',
  'analogValues',
  'binaryInputs',
  'binaryOutputs',
  'binaryValues',
  'multistateInputs',
  'multistateOutputs',
  'multistateValues',
  'schedules',
  'trendLogs',
  'files',
  'proprietary',
  'unknown',
];

/** Device identity properties read by read-device-properties. */
const DEVICE_IDENTITY_PROPERTY_SPECS = [
  { key: 'objectName', propertyId: bacnet.enum.PropertyIdentifier.OBJECT_NAME },
  { key: 'description', propertyId: bacnet.enum.PropertyIdentifier.DESCRIPTION },
  { key: 'modelName', propertyId: bacnet.enum.PropertyIdentifier.MODEL_NAME },
  { key: 'vendorName', propertyId: bacnet.enum.PropertyIdentifier.VENDOR_NAME },
  { key: 'firmwareRevision', propertyId: bacnet.enum.PropertyIdentifier.FIRMWARE_REVISION },
  {
    key: 'applicationSoftwareVersion',
    propertyId: bacnet.enum.PropertyIdentifier.APPLICATION_SOFTWARE_VERSION,
  },
  { key: 'protocolVersion', propertyId: bacnet.enum.PropertyIdentifier.PROTOCOL_VERSION },
  { key: 'protocolRevision', propertyId: bacnet.enum.PropertyIdentifier.PROTOCOL_REVISION },
  {
    key: 'maxApduLengthAccepted',
    propertyId: bacnet.enum.PropertyIdentifier.MAX_APDU_LENGTH_ACCEPTED,
  },
  {
    key: 'segmentationSupported',
    propertyId: bacnet.enum.PropertyIdentifier.SEGMENTATION_SUPPORTED,
  },
  {
    key: 'protocolServicesSupported',
    propertyId: bacnet.enum.PropertyIdentifier.PROTOCOL_SERVICES_SUPPORTED,
  },
  {
    key: 'protocolObjectTypesSupported',
    propertyId: bacnet.enum.PropertyIdentifier.PROTOCOL_OBJECT_TYPES_SUPPORTED,
  },
  { key: 'propertyList', propertyId: PROPERTY_LIST_PROPERTY_ID, array: true },
  { key: 'objectList', propertyId: OBJECT_LIST_PROPERTY_ID, array: true },
];

const BINARY_OBJECT_TYPES = new Set([
  bacnet.enum.ObjectType.BINARY_INPUT,
  bacnet.enum.ObjectType.BINARY_OUTPUT,
  bacnet.enum.ObjectType.BINARY_VALUE,
]);

const MULTI_STATE_OBJECT_TYPES = new Set([
  bacnet.enum.ObjectType.MULTI_STATE_INPUT,
  bacnet.enum.ObjectType.MULTI_STATE_OUTPUT,
  bacnet.enum.ObjectType.MULTI_STATE_VALUE,
]);

/** BACnet object types that typically support presentValue writes (outputs + values). */
const COMMANDABLE_OBJECT_TYPE_ABBRS = ['AO', 'BO', 'AV', 'BV', 'MO', 'MV'];

/** BACnet object types that typically expose a readable presentValue. */
const READABLE_OBJECT_TYPE_ABBRS = ['AI', 'AO', 'AV', 'BI', 'BO', 'BV', 'MI', 'MO', 'MV'];

module.exports = {
  bacnetEnum: bacnet.enum,
  DEFAULT_BACNET_PORT,
  DEFAULT_APDU_TIMEOUT_MS,
  DEFAULT_DISCOVERY_TIMEOUT_MS,
  DEFAULT_WRITE_PRIORITY,
  MIN_WRITE_PRIORITY,
  MAX_WRITE_PRIORITY,
  PRESENT_VALUE_PROPERTY_ID,
  OBJECT_LIST_PROPERTY_ID,
  PROPERTY_LIST_PROPERTY_ID,
  OBJECT_NAME_PROPERTY_ID,
  DESCRIPTION_PROPERTY_ID,
  UNITS_PROPERTY_ID,
  OUT_OF_SERVICE_PROPERTY_ID,
  RELIABILITY_PROPERTY_ID,
  SIEMENS_VENDOR_ID,
  PROPRIETARY_OBJECT_TYPE_THRESHOLD,
  OBJECT_TYPE_BY_ABBR,
  OBJECT_TYPE_ABBR_BY_NUM,
  EXPLORER_GROUP_BY_OBJECT_ABBR,
  EXPLORER_TREE_GROUP_KEYS,
  DEVICE_IDENTITY_PROPERTY_SPECS,
  BINARY_OBJECT_TYPES,
  MULTI_STATE_OBJECT_TYPES,
  COMMANDABLE_OBJECT_TYPE_ABBRS,
  READABLE_OBJECT_TYPE_ABBRS,
};
