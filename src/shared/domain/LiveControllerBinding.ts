// A controller binding materialized from a deployed release (backend Prisma
// `LiveControllerBinding` model, populated by materializeLiveConfigForSite()). This is what
// Runtime actually polls — never read `ControllersMapped` (the pre-deploy Engineering editing
// table) from Runtime or from live Operator views.
export interface LiveControllerBinding {
  id: string;
  siteId: string;
  equipmentId: string;
  controllerCode: string;
  displayName?: string | null;
  protocol: string;
  deviceInstance?: number | null;
  ipAddress?: string | null;
  networkAddress?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  pollRateMs: number;
  isSimulated: boolean;
  isEnabled: boolean;
  status?: string | null;
  lastSeenAt?: string | null;
  releaseVersionId: string;
  createdAt: string;
  updatedAt: string;
}
