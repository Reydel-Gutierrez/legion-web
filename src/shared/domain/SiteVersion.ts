// A Site's Engineering working/released version (backend Prisma `SiteVersion` model), as served
// by serializeVersionRow() in backend/src/modules/siteVersions/siteVersion.service.js. This is
// the canonical "Release" contract — prefer it over the informal, mock-only shapes that have
// grown up in src/lib/data/contracts.jsx (DeploymentSummary/DeployedSiteVersion) and
// workingVersionModel.jsx (createReleaseHistoryEntry) for any new code that talks to the real API.
export type SiteVersionStatus = "WORKING" | "RELEASED" | "ARCHIVED";

export interface SiteVersion {
  id: string;
  siteId: string;
  versionNumber: number;
  status: SiteVersionStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  deployedAt?: string | null;
  deployedBy?: string | null;
  parentVersionId?: string | null;
  sourceWorkingVersionId?: string | null;
  notes?: string | null;
  // Present only when the caller explicitly asked for the full working-version payload
  // (site/equipment/templates/mappings/graphics) alongside the version row.
  payload?: unknown;
}
