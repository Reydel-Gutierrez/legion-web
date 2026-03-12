/**
 * Deployment API adapter (placeholder).
 * When USE_MOCK_DATA is false, deployment repository will use this.
 * Not implemented yet — backend integration upcoming.
 */

function notImplemented(name) {
  return function () {
    throw new Error(`Deployment API not implemented: ${name}`);
  };
}

export const getCurrentDeployment = notImplemented("getCurrentDeployment");
export const getDeploymentHistory = notImplemented("getDeploymentHistory");
