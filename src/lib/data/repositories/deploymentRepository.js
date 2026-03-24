/**
 * Deployment data: current deployment, pending changes, history.
 * Pages use this instead of importing mockDeploymentData directly.
 */
import { USE_MOCK_DATA } from "../config";
import {
  getMockCurrentDeployment,
  getMockPendingWorkingVersionChanges,
  getMockDeploymentHistory,
  getEmptyPendingChanges as getEmptyPendingChangesFromMock,
  hasPendingChanges as hasPendingChangesMock,
} from "../../../modules/engineering/deployment/data/mockDeploymentData";

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
