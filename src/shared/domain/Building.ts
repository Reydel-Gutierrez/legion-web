import type { EntityStatus } from "./EntityStatus";

export interface Building {
  id: string;
  siteId: string;
  name: string;
  status: EntityStatus;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  buildingType?: string | null;
  buildingCode?: string | null;
  description?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
