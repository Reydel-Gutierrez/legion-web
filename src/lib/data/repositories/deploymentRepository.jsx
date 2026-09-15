/**
 * Deployment repository — facade over deployment data access.
 * Pages use this instead of importing mockDeploymentData / API adapters directly.
 *
 * Two generations live here side by side:
 *  - The original mock-backed "current deployment / pending changes / history" helpers (used by
 *    the legacy Engineering DeploymentPage same-database deploy flow — unchanged).
 *  - The LC-ARCH-002 package/LS-100 pipeline (`deploymentApiAdapter.js`): Save/Validate/Build/
 *    Export/Deploy-direct on the Engineering side, and stage/validate/preview/activate/rollback on
 *    the LS-100 side (Ls100ConsolePanel).
 */
import { USE_MOCK_DATA } from "../config";
import {
  getMockCurrentDeployment,
  getMockPendingWorkingVersionChanges,
  getMockDeploymentHistory,
  getEmptyPendingChanges as getEmptyPendingChangesFromMock,
  hasPendingChanges as hasPendingChangesMock,
} from "../../../modules/engineering/deployment/data/mockDeploymentData";
import * as packageApi from "../adapters/api/deploymentApiAdapter";

export function getCurrentDeployment() {
  if (USE_MOCK_DATA) return getMockCurrentDeployment();
  throw new Error("Deployment API not implemented");
}

export function getPendingWorkingVersionChanges() {
  if (USE_MOCK_DATA) return getMockPendingWorkingVersionChanges();
  throw new Error("Deployment API not implemented");
}

export function getDeploymentHistory() {
  if (USE_MOCK_DATA) return getMockDeploymentHistory();
  throw new Error("Deployment API not implemented");
}

export function getEmptyPendingChanges() {
  return getEmptyPendingChangesFromMock();
}

export function hasPendingChanges(pending) {
  return hasPendingChangesMock(pending);
}

// ---- LC-ARCH-002 package / LS-100 pipeline ----

export const getLs100Status = packageApi.getLs100Status;
export const getLs100History = packageApi.getLs100History;
export const importPackage = packageApi.importPackage;
export const validatePackageRecord = packageApi.validatePackageRecord;
export const previewPackageRecord = packageApi.previewPackageRecord;
export const activatePackageRecord = packageApi.activatePackageRecord;
export const discardPackageRecord = packageApi.discardPackageRecord;
export const rollbackSite = packageApi.rollbackSite;
export const recommission = packageApi.recommission;

export const validateProjectForPackage = packageApi.validateProjectForPackage;
export const buildSitePackage = packageApi.buildSitePackage;
export const deployPackageDirect = packageApi.deployPackageDirect;
export const exportSitePackage = packageApi.exportSitePackage;
export const downloadBackup = packageApi.downloadBackup;
export const saveBlob = packageApi.saveBlob;
