import type { PointQuality } from "./PointQuality";

// Authoritative live value for a point, written only by Legion Runtime (backend Prisma
// `PointRuntimeState` model). Prefer this over the legacy Point.presentValue/commState mirror
// fields (see Point.ts) in any newly-written code — see Phase 3 requirement to favor
// PointRuntimeState/ControllerRuntimeState over legacy mirrors.
export interface PointRuntimeState {
  id: string;
  pointId: string;
  presentValue?: string | null;
  quality: PointQuality;
  source?: "SIM" | "BACNET_IP" | null;
  lastSeenAt?: string | null;
  updatedAt: string;
  createdAt: string;
}
