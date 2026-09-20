/**
 * Canonical role definitions for Legion Web access control.
 * Used by User Manager and future backend RBAC. Keys are stable for API contracts.
 */

export const ROLE_KEYS = {
  SUPER_ADMIN: "super_admin",
  ORG_ADMIN: "org_admin",
  ENGINEER: "engineer",
  OPERATOR: "operator",
  VIEWER: "viewer",
};

/** @type {{ key: string; name: string; description: string; isSystemRole: boolean }[]} */
export const ROLES = [
  {
    key: ROLE_KEYS.SUPER_ADMIN,
    name: "Super Admin",
    description: "Full platform access; can manage all users, roles, and org settings.",
    isSystemRole: true,
  },
  {
    key: ROLE_KEYS.ORG_ADMIN,
    name: "Org Admin",
    description: "Organization-level admin; can manage users and site access within the org.",
    isSystemRole: true,
  },
  {
    key: ROLE_KEYS.ENGINEER,
    name: "Engineer",
    description: "Engineering mode access; configure sites, graphics, points, and deploy.",
    isSystemRole: true,
  },
  {
    key: ROLE_KEYS.OPERATOR,
    name: "Operator",
    description: "Operator mode access; view and operate deployed sites.",
    isSystemRole: true,
  },
  {
    key: ROLE_KEYS.VIEWER,
    name: "Viewer",
    description: "Read-only access to operator views.",
    isSystemRole: true,
  },
];

export function getRoleByKey(key) {
  return ROLES.find((r) => r.key === key) || null;
}

export function getRoleName(key) {
  const r = getRoleByKey(key);
  return r ? r.name : key || "—";
}
