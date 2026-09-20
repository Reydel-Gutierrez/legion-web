import type { EntityStatus } from "./EntityStatus";

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  status: EntityStatus;
  displayLabel?: string | null;
  floorType?: string | null;
  occupancyType?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
