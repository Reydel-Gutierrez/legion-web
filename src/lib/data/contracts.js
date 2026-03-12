// Canonical frontend data contracts for Legion Web.
// These shapes are intended to stay stable as we move from mock data
// to real backend APIs, so pages should depend on these structures.

/**
 * @typedef {Object} Site
 * @property {string} id
 * @property {string} name
 * @property {string} [timezone]
 * @property {string} [status] // e.g. "Active"
 */

/**
 * @typedef {Object} EquipmentTreeNode
 * @property {string|number} id
 * @property {string} name
 * @property {string} type // e.g. "group" | "floor" | "equip"
 * @property {string} [status]
 * @property {EquipmentTreeNode[]} [children]
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} WorkspaceRow
 * @property {string} id
 * @property {string|number} equipmentId
 * @property {string} equipmentName
 * @property {string} pointId
 * @property {string} pointName
 * @property {string|number} value
 * @property {string} [units]
 * @property {string} [status]
 * @property {boolean} [writable]
 */

/**
 * @typedef {Object} Alarm
 * @property {string} id
 * @property {string} siteId
 * @property {string} equipmentName
 * @property {string} equipmentType
 * @property {string} point
 * @property {string} message
 * @property {string} severity // "Critical" | "Major" | "Minor" | "Warning"
 * @property {string} state // "Active" | "History"
 * @property {boolean} ack
 * @property {string} occurredAt
 * @property {string|null} clearedAt
 * @property {number|null} durationMin
 */

/**
 * @typedef {Object} OperatorSummary
 * @property {number} activeAlarms
 * @property {number} unackedAlarms
 * @property {number} devicesOffline
 * @property {number} openTasks
 * @property {number|null} energyRuntime
 */

/**
 * @typedef {Object} EngineeringDraftSummary
 * @property {string} siteId
 * @property {number} equipmentCount
 * @property {number} controllerCount
 * @property {number} graphicsCount
 * @property {number} unmappedRequiredPoints
 */

export {};

