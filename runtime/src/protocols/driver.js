'use strict';

/**
 * LC-ARCH-004 Phase 2: the protocol driver boundary.
 *
 * This is documentation of the shape every driver should eventually converge on — not an enforced
 * base class. The point is to stop future runtime logic from being hardcoded directly against a
 * specific protocol library (`node-bacnet` today); it is NOT a rewrite of SIM or BACnet, both of
 * which keep their existing, working implementations underneath.
 *
 * @typedef {object} ProtocolDriver
 * @property {() => Promise<void>} initialize
 * @property {() => Promise<void>} shutdown
 * @property {(target: object) => Promise<object>} readPoints
 * @property {(target: object, value: unknown) => Promise<object>} writePoint
 * @property {() => object} getHealth
 */

module.exports = {};
