// A single deploy/rollback activation record (backend Prisma `SiteDeploymentEvent` model).
// `sequence` is the authoritative ordering — always sort/compare by it, never by `activatedAt`
// alone (clock skew/backfill could otherwise misorder history).
export type SiteDeploymentAction = "DEPLOY" | "ROLLBACK";

export interface DeploymentEvent {
  id: string;
  sequence: number;
  siteId: string;
  releaseVersionId: string;
  previousReleaseVersionId?: string | null;
  action: SiteDeploymentAction;
  activatedAt: string;
  activatedBy?: string | null;
}
