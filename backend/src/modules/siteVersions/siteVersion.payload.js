/**
 * Working-version flat state ↔ deployment snapshot (active release) transforms.
 * Mirrors frontend `deploymentSnapshot.js` / `workingVersionModel.js` shapes.
 */

function createDefaultNetworkConfig() {
  return {
    bacnetIpNetworks: [],
    mstpTrunks: [],
    scanDefaults: {
      defaultScanMode: 'all',
      scanTimeoutSec: 15,
      retries: 2,
      includeUnconfiguredProtocols: false,
      autoScanOnOpen: false,
    },
    routingNotes: '',
    networkInterfaces: [
      {
        id: 'if-default',
        label: 'Primary interface',
        bindAddress: '',
        listenUdp: 47808,
        enabled: true,
        notes: '',
      },
    ],
  };
}

function createDefaultWorkingPayload() {
  return {
    site: null,
    templates: {
      equipmentTemplates: [],
      graphicTemplates: [],
    },
    equipment: [],
    discoveredDevices: [],
    discoveredObjects: {},
    mappings: {},
    graphics: {},
    siteLayoutGraphics: {},
    networkConfig: createDefaultNetworkConfig(),
    validation: null,
    deploymentHistory: [],
    activeDeploymentSnapshot: null,
  };
}

function cloneJson(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Build operator deployment snapshot from working flat payload (same as frontend buildFullDeploymentSnapshot).
 * @param {object} workingData
 * @param {{ version?: string, lastDeployedAt?: string, deployedBy?: string, systemStatus?: string }} overrides
 */
function buildDeploymentSnapshotFromWorking(workingData, overrides = {}) {
  const now = new Date();
  const currentVersion = workingData?.activeDeploymentSnapshot?.version || 'v0';
  const versionNum = parseInt(String(currentVersion).replace(/\D/g, ''), 10) + 1;
  const newVersion = overrides.version || `v${versionNum}`;
  return {
    version: newVersion,
    lastDeployedAt: overrides.lastDeployedAt || now.toISOString(),
    deployedBy: overrides.deployedBy ?? 'Reydel Gutierrez',
    systemStatus: overrides.systemStatus ?? 'Running',
    site: workingData?.site ? { ...workingData.site } : null,
    equipment: Array.isArray(workingData?.equipment)
      ? workingData.equipment.map((e) => ({ ...e }))
      : [],
    templates: workingData?.templates
      ? {
          equipmentTemplates: (workingData.templates.equipmentTemplates || []).map((t) => ({ ...t })),
          graphicTemplates: (workingData.templates.graphicTemplates || []).map((g) => ({ ...g })),
        }
      : { equipmentTemplates: [], graphicTemplates: [] },
    mappings:
      workingData?.mappings && typeof workingData.mappings === 'object' ? { ...workingData.mappings } : {},
    graphics:
      workingData?.graphics && typeof workingData.graphics === 'object' ? { ...workingData.graphics } : {},
    siteLayoutGraphics:
      workingData?.siteLayoutGraphics && typeof workingData.siteLayoutGraphics === 'object'
        ? { ...workingData.siteLayoutGraphics }
        : {},
  };
}

/**
 * Convert stored active-release deployment snapshot into editable working flat state (for lazy new working).
 * @param {object|null} snap
 */
function deploymentSnapshotToWorkingPayload(snap) {
  if (!snap || typeof snap !== 'object') return createDefaultWorkingPayload();
  return {
    site: snap.site ?? null,
    templates: snap.templates || { equipmentTemplates: [], graphicTemplates: [] },
    equipment: Array.isArray(snap.equipment) ? snap.equipment.map((e) => ({ ...e })) : [],
    discoveredDevices: [],
    discoveredObjects: {},
    mappings: snap.mappings && typeof snap.mappings === 'object' ? { ...snap.mappings } : {},
    graphics: snap.graphics && typeof snap.graphics === 'object' ? { ...snap.graphics } : {},
    siteLayoutGraphics:
      snap.siteLayoutGraphics && typeof snap.siteLayoutGraphics === 'object'
        ? { ...snap.siteLayoutGraphics }
        : {},
    networkConfig: createDefaultNetworkConfig(),
    validation: null,
    deploymentHistory: [],
    activeDeploymentSnapshot:
      snap.version != null
        ? {
            version: snap.version,
            lastDeployedAt: snap.lastDeployedAt,
            deployedBy: snap.deployedBy,
            systemStatus: snap.systemStatus,
          }
        : null,
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validateWorkingPayloadForDeploy(payloadJson) {
  if (payloadJson === null || payloadJson === undefined) {
    return 'Working version has no payload';
  }
  if (!isPlainObject(payloadJson)) {
    return 'Working version payload must be a JSON object';
  }
  return null;
}

module.exports = {
  createDefaultWorkingPayload,
  createDefaultNetworkConfig,
  cloneJson,
  buildDeploymentSnapshotFromWorking,
  deploymentSnapshotToWorkingPayload,
  validateWorkingPayloadForDeploy,
  isPlainObject,
};
