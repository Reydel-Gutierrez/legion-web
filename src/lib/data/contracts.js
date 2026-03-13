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
 * @property {string} [pointReferenceId] - Stable reference for addressing and commands (e.g. DA-T, damper_pos). Used in Address and API.
 * @property {string|number} value
 * @property {string} [units]
 * @property {string} [status]
 * @property {boolean} [writable]
 */

/**
 * @typedef {Object} Alarm
 * @property {string} id
 * @property {string} siteId
 * @property {string} [source] // equipment or system source
 * @property {string} [priority] // alias or same as severity for API
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

/**
 * @typedef {Object} DeploymentSummary
 * @property {string} version
 * @property {string|null} lastDeployedAt
 * @property {string|null} deployedBy
 * @property {string} systemStatus
 */

/**
 * Logical point: template-defined or resolved point on equipment. Graphics bind to logical point id.
 * @typedef {Object} LogicalPoint
 * @property {string} id
 * @property {string} siteId
 * @property {string} equipmentId
 * @property {string} name
 * @property {string} [code]
 * @property {string} [units]
 * @property {string} [valueType]
 * @property {boolean} [writable]
 * @property {string} [bindingStatus] - "unbound" | "mapped" | "simulated" | "live"
 * @property {*} [runtimeSource]
 */

/**
 * Graphic binding: links a graphic object to a logical point.
 * @typedef {Object} GraphicBinding
 * @property {string} id
 * @property {string} graphicId
 * @property {string} equipmentId
 * @property {string} logicalPointId
 * @property {string} [bindingType]
 */

/**
 * Deployed site version snapshot (operator reads from this).
 * @typedef {Object} DeployedSiteVersion
 * @property {string} version
 * @property {string} lastDeployedAt
 * @property {string} deployedBy
 * @property {string} systemStatus
 * @property {Object|null} site
 * @property {Object[]} equipment
 * @property {Object} templates
 * @property {Object} mappings
 * @property {Object} graphics
 */

export {};

