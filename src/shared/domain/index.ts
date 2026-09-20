// Shared frontend domain contracts for Legion Web. These are intentional, hand-designed shapes —
// never raw Prisma models — informed by (but not copied verbatim from) backend/prisma/schema.prisma
// and the Runtime HTTP contract. Import via `@shared/domain` (see vite.config.js / tsconfig.json
// path alias) rather than deep-importing individual files.
export * from "./PointQuality";
export * from "./EntityStatus";
export * from "./Site";
export * from "./Building";
export * from "./Floor";
export * from "./Equipment";
export * from "./Point";
export * from "./PointRuntimeState";
export * from "./ControllerRuntimeState";
export * from "./LiveControllerBinding";
export * from "./LivePointBinding";
export * from "./SiteVersion";
export * from "./DeploymentEvent";
export * from "./RuntimeStatus";
