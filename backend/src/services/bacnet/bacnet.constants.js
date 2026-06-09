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

/** BACnet property identifier for presentValue. */
const PRESENT_VALUE_PROPERTY_ID = bacnet.enum.PropertyIdentifier.PRESENT_VALUE;

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
};

const OBJECT_TYPE_ABBR_BY_NUM = Object.fromEntries(
  Object.entries(OBJECT_TYPE_BY_ABBR).map(([abbr, num]) => [String(num), abbr])
);

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

module.exports = {
  bacnetEnum: bacnet.enum,
  DEFAULT_BACNET_PORT,
  DEFAULT_APDU_TIMEOUT_MS,
  DEFAULT_DISCOVERY_TIMEOUT_MS,
  DEFAULT_WRITE_PRIORITY,
  MIN_WRITE_PRIORITY,
  MAX_WRITE_PRIORITY,
  PRESENT_VALUE_PROPERTY_ID,
  OBJECT_TYPE_BY_ABBR,
  OBJECT_TYPE_ABBR_BY_NUM,
  BINARY_OBJECT_TYPES,
  MULTI_STATE_OBJECT_TYPES,
};
