// Row-lifecycle status shared by Site/Building/Floor/Equipment/Point (backend Prisma `EntityStatus`
// enum). Distinct from PointQuality (comm/data freshness) and from the frontend-only engineering
// "assignment stage" strings (e.g. "MISSING_CONTROLLER") — those are computed client-side and are
// not part of this vocabulary.
export type EntityStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
