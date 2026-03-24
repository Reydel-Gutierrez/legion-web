/**
 * Mock data for User Manager (users, site memberships).
 * In-memory store; repository exposes get/create/update. Roles come from lib/access/roles.
 */

import { ROLES, getRoleName, ROLE_KEYS } from "../../../../lib/access/roles";
import { USER_STATUS } from "../../../../lib/access/types";
import { SITE_IDS, DEMO_CAMPUS_SITE_ID } from "../../../../lib/sites";

/** Sites available for site membership assignment */
export function getSitesForAccessMock() {
  return [
    { siteId: "miami-hq", siteName: SITE_IDS.MIAMI_HQ },
    { siteId: "new-site", siteName: SITE_IDS.NEW_SITE },
    { siteId: DEMO_CAMPUS_SITE_ID, siteName: "Demo Campus" },
  ];
}

const now = () => new Date().toISOString();

// Mutable in-memory stores (repository mutations update these)
let users = [
  {
    id: "usr-1",
    fullName: "Reydel Gutierrez",
    email: "reydel@legion.local",
    status: USER_STATUS.ACTIVE,
    roleKey: ROLE_KEYS.SUPER_ADMIN,
    roleName: "Super Admin",
    siteCount: 4,
    lastSeenAt: "2026-03-14T14:00:00.000Z",
    createdAt: "2026-02-01T09:12:00.000Z",
    updatedAt: now(),
  },
  {
    id: "usr-2",
    fullName: "Jorge M.",
    email: "jorge@legion.local",
    status: USER_STATUS.ACTIVE,
    roleKey: ROLE_KEYS.ENGINEER,
    roleName: "Engineer",
    siteCount: 1,
    lastSeenAt: "2026-03-14T12:55:00.000Z",
    createdAt: "2026-02-10T15:41:00.000Z",
    updatedAt: now(),
  },
  {
    id: "usr-3",
    fullName: "Site Admin",
    email: "admin@legion.local",
    status: USER_STATUS.ACTIVE,
    roleKey: ROLE_KEYS.ORG_ADMIN,
    roleName: "Org Admin",
    siteCount: 2,
    lastSeenAt: "2026-03-14T08:04:00.000Z",
    createdAt: "2026-01-18T10:00:00.000Z",
    updatedAt: now(),
  },
  {
    id: "usr-4",
    fullName: "Nina R.",
    email: "nina@legion.local",
    status: USER_STATUS.ACTIVE,
    roleKey: ROLE_KEYS.VIEWER,
    roleName: "Viewer",
    siteCount: 1,
    lastSeenAt: "2026-03-13T19:16:00.000Z",
    createdAt: "2026-02-15T11:20:00.000Z",
    updatedAt: now(),
  },
];

let siteMemberships = [
  { id: "mem-1", userId: "usr-1", siteId: "miami-hq", siteName: SITE_IDS.MIAMI_HQ, canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-02-01T09:12:00.000Z", updatedAt: now() },
  { id: "mem-2", userId: "usr-1", siteId: "new-site", siteName: SITE_IDS.NEW_SITE, canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-02-01T09:12:00.000Z", updatedAt: now() },
  { id: "mem-7", userId: "usr-1", siteId: "home-lab-3", siteName: "Home Lab 3", canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: now(), updatedAt: now() },
  { id: "mem-8", userId: "usr-1", siteId: DEMO_CAMPUS_SITE_ID, siteName: "Demo Campus", canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: now(), updatedAt: now() },
  { id: "mem-3", userId: "usr-2", siteId: "miami-hq", siteName: SITE_IDS.MIAMI_HQ, canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-02-10T15:41:00.000Z", updatedAt: now() },
  { id: "mem-4", userId: "usr-3", siteId: "miami-hq", siteName: SITE_IDS.MIAMI_HQ, canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-01-18T10:00:00.000Z", updatedAt: now() },
  { id: "mem-5", userId: "usr-3", siteId: "new-site", siteName: SITE_IDS.NEW_SITE, canAccessEngineering: true, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-01-18T10:00:00.000Z", updatedAt: now() },
  { id: "mem-6", userId: "usr-4", siteId: "miami-hq", siteName: SITE_IDS.MIAMI_HQ, canAccessEngineering: false, canAccessOperator: true, roleOverrideKey: null, membershipStatus: "active", createdAt: "2026-02-15T11:20:00.000Z", updatedAt: now() },
];

// Current user for permission checks (mock: who is "logged in" in engineering)
let currentUserForAccess = {
  id: "usr-1",
  fullName: "Reydel Gutierrez",
  email: "reydel@legion.local",
  roleKey: ROLE_KEYS.SUPER_ADMIN,
  roleName: "Super Admin",
};

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getUsersMock() {
  return users.map((u) => ({ ...u }));
}

export function getRolesMock() {
  return ROLES.map((r) => ({ ...r, id: r.key }));
}

export function getSiteMembershipsMock() {
  return siteMemberships.map((m) => ({ ...m }));
}

export function getCurrentUserForAccessMock() {
  return { ...currentUserForAccess };
}

/** For tests/demo: set who the current user is (roleKey) */
export function setCurrentUserForAccessMock(userId) {
  const u = users.find((x) => x.id === userId);
  if (u) currentUserForAccess = { id: u.id, fullName: u.fullName, email: u.email, roleKey: u.roleKey, roleName: u.roleName };
}

export function createUserMock(payload) {
  const roleName = getRoleName(payload.roleKey);
  const count = siteMemberships.filter((m) => m.userId === payload.id).length;
  const user = {
    id: payload.id || nextId("usr"),
    fullName: payload.fullName || "",
    email: payload.email || "",
    status: payload.status || USER_STATUS.ACTIVE,
    roleKey: payload.roleKey || ROLE_KEYS.VIEWER,
    roleName: roleName,
    siteCount: payload.siteCount ?? count,
    lastSeenAt: payload.lastSeenAt || null,
    createdAt: payload.createdAt || now(),
    updatedAt: now(),
  };
  users.push(user);
  return { ...user };
}

export function updateUserMock(id, payload) {
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const existing = users[idx];
  const siteCount = payload.siteCount !== undefined ? payload.siteCount : (siteMemberships.filter((m) => m.userId === id).length);
  users[idx] = {
    ...existing,
    ...payload,
    roleName: payload.roleKey !== undefined ? getRoleName(payload.roleKey) : existing.roleName,
    siteCount,
    updatedAt: now(),
  };
  if (payload.roleKey !== undefined) users[idx].roleKey = payload.roleKey;
  return { ...users[idx] };
}

export function createSiteMembershipMock(payload) {
  const mem = {
    id: payload.id || nextId("mem"),
    userId: payload.userId,
    siteId: payload.siteId,
    siteName: payload.siteName || payload.siteId,
    canAccessEngineering: payload.canAccessEngineering ?? false,
    canAccessOperator: payload.canAccessOperator ?? true,
    roleOverrideKey: payload.roleOverrideKey ?? null,
    membershipStatus: payload.membershipStatus || "active",
    createdAt: payload.createdAt || now(),
    updatedAt: now(),
  };
  siteMemberships.push(mem);
  // Bump user siteCount
  const uIdx = users.findIndex((u) => u.id === payload.userId);
  if (uIdx !== -1) users[uIdx].siteCount = siteMemberships.filter((m) => m.userId === payload.userId).length;
  return { ...mem };
}

export function updateSiteMembershipMock(id, payload) {
  const idx = siteMemberships.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  siteMemberships[idx] = { ...siteMemberships[idx], ...payload, updatedAt: now() };
  return { ...siteMemberships[idx] };
}

export function deleteSiteMembershipMock(id) {
  const mem = siteMemberships.find((m) => m.id === id);
  if (!mem) return false;
  siteMemberships = siteMemberships.filter((m) => m.id !== id);
  const uIdx = users.findIndex((u) => u.id === mem.userId);
  if (uIdx !== -1) users[uIdx].siteCount = siteMemberships.filter((m) => m.userId === mem.userId).length;
  return true;
}
