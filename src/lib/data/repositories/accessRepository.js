/**
 * Access management repository: users, roles, site memberships.
 * Frontend uses this; later swap to real API (GET/POST/PATCH /users, /roles, /site-memberships).
 */

import { USE_MOCK_DATA } from "../config";
import {
  getUsersMock,
  getRolesMock,
  getSiteMembershipsMock,
  getCurrentUserForAccessMock,
  getSitesForAccessMock,
  createUserMock,
  updateUserMock,
  createSiteMembershipMock,
  updateSiteMembershipMock,
  deleteSiteMembershipMock,
} from "../../../modules/engineering/user-manager/data/mockUserManagerData";

export function getUsers() {
  if (USE_MOCK_DATA) return getUsersMock();
  throw new Error("Access API not implemented");
}

export function getRoles() {
  if (USE_MOCK_DATA) return getRolesMock();
  throw new Error("Access API not implemented");
}

export function getSiteMemberships() {
  if (USE_MOCK_DATA) return getSiteMembershipsMock();
  throw new Error("Access API not implemented");
}

export function getSitesForAccess() {
  if (USE_MOCK_DATA) return getSitesForAccessMock();
  throw new Error("Access API not implemented");
}

export function getCurrentUserForAccess() {
  if (USE_MOCK_DATA) return getCurrentUserForAccessMock();
  throw new Error("Access API not implemented");
}

export function createUser(payload) {
  if (USE_MOCK_DATA) return createUserMock(payload);
  throw new Error("Access API not implemented");
}

export function updateUser(id, payload) {
  if (USE_MOCK_DATA) return updateUserMock(id, payload);
  throw new Error("Access API not implemented");
}

export function createSiteMembership(payload) {
  if (USE_MOCK_DATA) return createSiteMembershipMock(payload);
  throw new Error("Access API not implemented");
}

export function updateSiteMembership(id, payload) {
  if (USE_MOCK_DATA) return updateSiteMembershipMock(id, payload);
  throw new Error("Access API not implemented");
}

export function deleteSiteMembership(id) {
  if (USE_MOCK_DATA) return deleteSiteMembershipMock(id);
  throw new Error("Access API not implemented");
}
