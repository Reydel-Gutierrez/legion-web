/**
 * Frontend-only permission checks for User Manager and access-related UI.
 * Uses mock current user from accessRepository. Replace with real auth context later.
 */

import { ROLE_KEYS } from "./roles";

/**
 * @param {{ roleKey: string }} currentUser - from getCurrentUserForAccess()
 * @returns {boolean} - can open User Manager and see Users/Roles/Site Access
 */
export function canViewUserManager(currentUser) {
  if (!currentUser?.roleKey) return false;
  const key = currentUser.roleKey;
  return key === ROLE_KEYS.SUPER_ADMIN || key === ROLE_KEYS.ORG_ADMIN || key === ROLE_KEYS.ENGINEER;
}

/**
 * @param {{ roleKey: string }} currentUser
 * @returns {boolean} - can add/edit/disable users and manage roles
 */
export function canManageUsers(currentUser) {
  if (!currentUser?.roleKey) return false;
  const key = currentUser.roleKey;
  return key === ROLE_KEYS.SUPER_ADMIN || key === ROLE_KEYS.ORG_ADMIN;
}

/**
 * @param {{ roleKey: string }} currentUser
 * @returns {boolean} - can edit site memberships / site access
 */
export function canEditSiteMemberships(currentUser) {
  if (!currentUser?.roleKey) return false;
  const key = currentUser.roleKey;
  return key === ROLE_KEYS.SUPER_ADMIN || key === ROLE_KEYS.ORG_ADMIN;
}

/**
 * @param {{ roleKey: string }} currentUser
 * @returns {boolean} - true if User Manager is view-only (e.g. Engineer)
 */
export function isUserManagerViewOnly(currentUser) {
  return canViewUserManager(currentUser) && !canManageUsers(currentUser);
}
