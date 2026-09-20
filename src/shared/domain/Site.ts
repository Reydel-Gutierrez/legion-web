import type { EntityStatus } from "./EntityStatus";

// Frontend-facing Site contract. Intentionally a subset/reshape of the backend `Site` Prisma
// model (backend/prisma/schema.prisma) — relation arrays (buildings, equipment, points,
// siteVersions, etc.) are fetched separately via their own endpoints/contracts, never embedded
// wholesale here.
export interface Site {
  id: string;
  name: string;
  status: EntityStatus;
  timezone?: string | null;
  siteType?: string | null;
  description?: string | null;
  displayLabel?: string | null;
  icon?: string | null;
  activeReleaseVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}
