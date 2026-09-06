import { ROLE_KEYS } from "./roles";
import {
  canAccessCommissioningDashboard,
  canAccessEngineeringDashboard,
  canCommandPoints,
  canEditSchedules,
  canMutateFacilityHierarchy,
  getDashboardModeOptions,
} from "./operatorPermissions";

describe("operatorPermissions", () => {
  const viewer = { roleKey: ROLE_KEYS.VIEWER };
  const operator = { roleKey: ROLE_KEYS.OPERATOR };
  const engineer = { roleKey: ROLE_KEYS.ENGINEER };

  it("hides engineering and commissioning from operators and viewers", () => {
    expect(canAccessEngineeringDashboard(operator)).toBe(false);
    expect(canAccessCommissioningDashboard(viewer)).toBe(false);
    expect(getDashboardModeOptions(operator)).toEqual([{ id: "operator", label: "Operator Dashboard" }]);
    expect(getDashboardModeOptions(engineer).map((o) => o.id)).toEqual([
      "operator",
      "commissioning",
      "engineering",
    ]);
  });

  it("blocks viewers from commands and hierarchy mutation", () => {
    expect(canCommandPoints(viewer)).toBe(false);
    expect(canEditSchedules(viewer)).toBe(false);
    expect(canCommandPoints(operator)).toBe(true);
    expect(canEditSchedules(operator)).toBe(true);
    expect(canMutateFacilityHierarchy(operator)).toBe(false);
    expect(canMutateFacilityHierarchy(engineer)).toBe(true);
  });
});
