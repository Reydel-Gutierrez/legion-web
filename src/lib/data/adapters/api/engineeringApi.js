/**
 * Engineering API adapter (placeholder).
 * When USE_MOCK_ENGINEERING_DATA is false, repositories will call these instead of mock.
 * Not implemented yet — backend integration upcoming.
 */

function notImplemented(name) {
  return function () {
    throw new Error(`Engineering API not implemented: ${name}`);
  };
}

export const getInitialEngineeringSeed = notImplemented("getInitialEngineeringSeed");
export const getEngineeringSiteTree = notImplemented("getEngineeringSiteTree");
export const getEngineeringEquipmentForSite = notImplemented("getEngineeringEquipmentForSite");
export const getEngineeringDiscoveryDevices = notImplemented("getEngineeringDiscoveryDevices");
// Point mapping / template library / graphics helpers would be added here when API exists.
