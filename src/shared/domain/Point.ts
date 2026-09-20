import type { EntityStatus } from "./EntityStatus";

// The Point row as served today by the hierarchy API (normalizePoint() in
// hierarchyApiAdapter.jsx) — still mirrors Runtime-written presentValue/commState/lastSeenAt
// directly on the Point row for legacy consumers. Prefer PointRuntimeState (see
// PointRuntimeState.ts) for new code that only needs live value/quality; this shape remains for
// callers that need the point's identity + engineering fields together with its last-known value.
export interface Point {
  id: string;
  equipmentId: string;
  siteId: string;
  buildingId: string;
  floorId: string;
  pointName: string;
  pointCode: string;
  pointType: string;
  status: EntityStatus;
  unit?: string | null;
  writable: boolean;
  presentValue?: string | null;
  commState?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
