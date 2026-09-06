import { ROLE_KEYS } from "./roles";

function roleKeyOf(currentUser) {
  return currentUser?.roleKey || "";
}

/** Operator workspace (including viewers). */
export function canAccessOperatorDashboard(currentUser) {
  if (!currentUser?.roleKey) return true;
  return true;
}

/** Engineering tools / Engineering Dashboard. */
export function canAccessEngineeringDashboard(currentUser) {
  const key = roleKeyOf(currentUser);
  return key === ROLE_KEYS.SUPER_ADMIN || key === ROLE_KEYS.ORG_ADMIN || key === ROLE_KEYS.ENGINEER;
}

/**
 * Commissioning is not a separate product surface yet.
 * Same gate as Engineering so operators/viewers never see it.
 */
export function canAccessCommissioningDashboard(currentUser) {
  return canAccessEngineeringDashboard(currentUser);
}

/** Add / remove / reorder facility hierarchy. */
export function canMutateFacilityHierarchy(currentUser) {
  return canAccessEngineeringDashboard(currentUser);
}

/** Point commands and out-of-service overlays. */
export function canCommandPoints(currentUser) {
  const key = roleKeyOf(currentUser);
  if (!key) return true;
  return key !== ROLE_KEYS.VIEWER;
}

export function canConfigureAlarms(currentUser) {
  return canCommandPoints(currentUser);
}

export function canEditSchedules(currentUser) {
  return canCommandPoints(currentUser);
}

export function isViewerRole(currentUser) {
  return roleKeyOf(currentUser) === ROLE_KEYS.VIEWER;
}

export function getDashboardModeOptions(currentUser) {
  const options = [{ id: "operator", label: "Operator Dashboard" }];
  if (canAccessCommissioningDashboard(currentUser)) {
    options.push({ id: "commissioning", label: "Commissioning Dashboard" });
  }
  if (canAccessEngineeringDashboard(currentUser)) {
    options.push({ id: "engineering", label: "Engineering Dashboard" });
  }
  return options;
}
