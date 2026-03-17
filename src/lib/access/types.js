/**
 * Data shapes for users, roles, and site access.
 * Backend-ready field names for future API alignment.
 */

// User status for list and filters
export const USER_STATUS = {
  ACTIVE: "active",
  INVITED: "invited",
  DISABLED: "disabled",
};

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} fullName
 * @property {string} email
 * @property {string} status - USER_STATUS value
 * @property {string} roleKey
 * @property {string} roleName - display name
 * @property {number} siteCount
 * @property {string|null} lastSeenAt - ISO date
 * @property {string} createdAt - ISO date
 * @property {string} updatedAt - ISO date
 */

/**
 * @typedef {Object} Role
 * @property {string} id
 * @property {string} key
 * @property {string} name
 * @property {string} description
 * @property {boolean} isSystemRole
 */

/**
 * @typedef {Object} SiteMembership
 * @property {string} id
 * @property {string} userId
 * @property {string} siteId
 * @property {string} siteName
 * @property {boolean} canAccessEngineering
 * @property {boolean} canAccessOperator
 * @property {string|null} roleOverrideKey - optional per-site role override
 * @property {string} membershipStatus - e.g. active, revoked
 * @property {string} createdAt - ISO date
 * @property {string} updatedAt - ISO date
 */

export default { USER_STATUS };
