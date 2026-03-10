/**
 * Mock deployment data for Deployment page (MVP).
 * Replace with API/store later.
 */

export function getMockCurrentDeployment() {
  return {
    version: "v12",
    lastDeployedAt: "2026-03-09T21:45:00.000Z",
    deployedBy: "Reydel Gutierrez",
    systemStatus: "Running",
  };
}

export function getMockPendingDraftChanges() {
  return {
    equipment: 3,
    pointMappings: 5,
    graphics: 1,
    templates: 2,
  };
}

export function getMockDeploymentHistory() {
  return [
    { version: "v12", date: "2026-03-09", user: "Reydel", result: "Success", notes: "" },
    { version: "v11", date: "2026-03-08", user: "Reydel", result: "Success", notes: "" },
    { version: "v10", date: "2026-03-07", user: "Reydel", result: "Success", notes: "" },
  ];
}

export function getEmptyPendingChanges() {
  return {
    equipment: 0,
    pointMappings: 0,
    graphics: 0,
    templates: 0,
  };
}

/** Returns true if there are any pending changes */
export function hasPendingChanges(pending) {
  return (
    (pending?.equipment ?? 0) > 0 ||
    (pending?.pointMappings ?? 0) > 0 ||
    (pending?.graphics ?? 0) > 0 ||
    (pending?.templates ?? 0) > 0
  );
}
