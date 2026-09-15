/**
 * Builds a full active-release payload (operator snapshot) from the working-version flat state.
 */

/**
 * @param {object} workingData - Current engineering working-version flat state
 * @param {{ version?: string, lastDeployedAt?: string, deployedBy?: string, systemStatus?: string }} overrides
 */
export function buildFullDeploymentSnapshot(workingData, overrides = {}) {
  const now = new Date();
  const currentVersion = workingData?.activeDeploymentSnapshot?.version || "v0";
  const versionNum = parseInt(String(currentVersion).replace(/\D/g, ""), 10) + 1;
  const newVersion = overrides.version || `v${versionNum}`;
  return {
    version: newVersion,
    lastDeployedAt: overrides.lastDeployedAt || now.toISOString(),
    deployedBy: overrides.deployedBy ?? "Reydel Gutierrez",
    systemStatus: overrides.systemStatus ?? "Running",
    site: workingData?.site ? { ...workingData.site } : null,
    equipment: Array.isArray(workingData?.equipment) ? workingData.equipment.map((e) => ({ ...e })) : [],
    templates: workingData?.templates
      ? {
          equipmentTemplates: (workingData.templates.equipmentTemplates || []).map((t) => ({ ...t })),
          graphicTemplates: (workingData.templates.graphicTemplates || []).map((g) => ({ ...g })),
        }
      : { equipmentTemplates: [], graphicTemplates: [] },
    mappings: workingData?.mappings && typeof workingData.mappings === "object" ? { ...workingData.mappings } : {},
    graphics: workingData?.graphics && typeof workingData.graphics === "object" ? { ...workingData.graphics } : {},
    siteLayoutGraphics:
      workingData?.siteLayoutGraphics && typeof workingData.siteLayoutGraphics === "object"
        ? { ...workingData.siteLayoutGraphics }
        : {},
  };
}
