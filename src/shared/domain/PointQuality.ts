// Canonical point-quality vocabulary, mirroring the backend Prisma `PointQuality` enum
// (backend/prisma/schema.prisma). Only GOOD / STALE / COMM_FAILURE / UNKNOWN are produced by the
// Runtime today; OUT_OF_SERVICE / OVERRIDDEN / UNRELIABLE are reserved for future use but modeled
// here so the frontend and backend never drift on the string set.
export type PointQuality =
  | "GOOD"
  | "STALE"
  | "COMM_FAILURE"
  | "OUT_OF_SERVICE"
  | "OVERRIDDEN"
  | "UNRELIABLE"
  | "UNKNOWN";

export const POINT_QUALITIES: readonly PointQuality[] = [
  "GOOD",
  "STALE",
  "COMM_FAILURE",
  "OUT_OF_SERVICE",
  "OVERRIDDEN",
  "UNRELIABLE",
  "UNKNOWN",
];

export function isPointQuality(value: unknown): value is PointQuality {
  return typeof value === "string" && (POINT_QUALITIES as readonly string[]).includes(value);
}

// Frontend-only display status, computed client-side from comm freshness (see
// src/lib/operator/statusUtils.jsx). This is NOT persisted anywhere and is a distinct vocabulary
// from PointQuality — kept as its own named type so the two are never confused or compared
// directly against each other.
export type CommDisplayStatus = "LIVE" | "STALE" | "OFFLINE" | "UNKNOWN";
