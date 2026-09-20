// A point binding materialized from a deployed release (backend Prisma `LivePointBinding`
// model) — the field-side (BACnet object) counterpart to a Point, scoped under a
// LiveControllerBinding.
export interface LivePointBinding {
  id: string;
  liveControllerBindingId: string;
  equipmentId: string;
  pointId: string;
  legionPointCode?: string | null;
  fieldPointKey: string;
  fieldPointName?: string | null;
  fieldObjectType?: string | null;
  fieldObjectInstance?: number | null;
  fieldDataType?: string | null;
  readEnabled: boolean;
  writeEnabled: boolean;
  isBound: boolean;
  createdAt: string;
  updatedAt: string;
}
