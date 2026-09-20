import type { PointQuality } from "./PointQuality";

// Authoritative live heartbeat for a controller, written only by Legion Runtime (backend Prisma
// `ControllerRuntimeState` model). `status` is a free-form runtime heartbeat string ("ONLINE" /
// "OFFLINE" in practice) — kept as `string` rather than a union here because Runtime is the only
// writer and may introduce new values; `quality` is the canonical PointQuality vocabulary.
export interface ControllerRuntimeState {
  id: string;
  liveControllerBindingId: string;
  status?: string | null;
  quality: PointQuality;
  lastSeenAt?: string | null;
  lastPollAt?: string | null;
  failureCount: number;
  updatedAt: string;
  createdAt: string;
}
