import type { EntityStatus } from "./EntityStatus";

// Engineering-only "how far along is this equipment's setup" status. This is computed
// client-side (see src/lib/data/adapters/api/hierarchyApiAdapter.jsx) from whether a controller/
// template is assigned yet — it is never persisted as such in Postgres, and must not be confused
// with EntityStatus (row lifecycle) below.
export type EquipmentAssignmentStage =
  | "DRAFT"
  | "MISSING_CONTROLLER"
  | "READY_FOR_MAPPING"
  | "CONTROLLER_ASSIGNED";

export interface Equipment {
  id: string;
  siteId: string;
  buildingId: string;
  floorId: string;
  name: string;
  code: string;
  equipmentType: string;
  status: EntityStatus;
  templateName?: string | null;
  address?: string | null;
  instanceNumber?: number | null;
  createdAt: string;
  updatedAt: string;
}
