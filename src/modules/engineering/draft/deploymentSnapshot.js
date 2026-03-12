/**
 * Builds the full deployment snapshot (payload + metadata) from a draft.
 * Used when deploying: engineeringDraft -> activeDeployment.
 * Operator reads from this shape.
 */

/**
 * @param {object} draft - Current engineering draft
 * @param {{ version?: string, lastDeployedAt?: string, deployedBy?: string, systemStatus?: string }} overrides - Optional metadata overrides
 * @returns {object} Full deployment snapshot for a site
 */
export function buildFullDeploymentSnapshot(draft, overrides = {}) {
  const now = new Date();
  const currentVersion = draft?.activeDeploymentSnapshot?.version || "v0";
  const versionNum = parseInt(String(currentVersion).replace(/\D/g, ""), 10) + 1;
  const newVersion = overrides.version || `v${versionNum}`;
  return {
    version: newVersion,
    lastDeployedAt: overrides.lastDeployedAt || now.toISOString(),
    deployedBy: overrides.deployedBy ?? "Reydel Gutierrez",
    systemStatus: overrides.systemStatus ?? "Running",
    site: draft?.site ? { ...draft.site } : null,
    equipment: Array.isArray(draft?.equipment) ? draft.equipment.map((e) => ({ ...e })) : [],
    templates: draft?.templates
      ? {
          equipmentTemplates: (draft.templates.equipmentTemplates || []).map((t) => ({ ...t })),
          graphicTemplates: (draft.templates.graphicTemplates || []).map((g) => ({ ...g })),
        }
      : { equipmentTemplates: [], graphicTemplates: [] },
    mappings: draft?.mappings && typeof draft.mappings === "object" ? { ...draft.mappings } : {},
    graphics: draft?.graphics && typeof draft.graphics === "object" ? { ...draft.graphics } : {},
  };
}
