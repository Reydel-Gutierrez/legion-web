/**
 * Canonical site/building/floor/equipment hierarchy from Prisma.
 * Used to sync engineering working-version payload with relational data.
 */

const prisma = require('../../lib/prisma');
const { sortBySortOrderThenName } = require('../../lib/hierarchySort');

/** Site Builder form labels (or API enum strings) → Prisma EntityStatus */
function entityStatusFromFormLabel(label) {
  const u = String(label || '')
    .trim()
    .toUpperCase();
  if (u === 'INACTIVE' || u === 'DRAFT') return 'INACTIVE';
  if (u === 'ARCHIVED') return 'ARCHIVED';
  if (u === 'ACTIVE') return 'ACTIVE';
  const lower = String(label || '')
    .trim()
    .toLowerCase();
  if (lower === 'draft' || lower === 'inactive') return 'INACTIVE';
  if (lower === 'archived') return 'ARCHIVED';
  if (lower === 'active') return 'ACTIVE';
  return 'ACTIVE';
}

/** Any client input → Prisma EntityStatus (handles title case, already-enums, etc.) */
function normalizeEntityStatusForDb(value) {
  if (value === undefined || value === null) return undefined;
  const u = String(value).trim().toUpperCase();
  if (u === 'ACTIVE' || u === 'INACTIVE' || u === 'ARCHIVED') return u;
  return entityStatusFromFormLabel(value);
}

/** Prisma EntityStatus → Site Builder form labels */
function formLabelFromEntityStatus(st) {
  const u = String(st || '').toUpperCase();
  if (u === 'INACTIVE') return 'Draft';
  if (u === 'ARCHIVED') return 'Archived';
  return 'Active';
}

function pointToWorkspaceRow(equipmentId, equipmentName, pt) {
  const units = pt.unit || '';
  const val = pt.presentValue != null && pt.presentValue !== '' ? String(pt.presentValue) : '—';
  const valueStr = units ? `${val} ${units}`.trim() : val;
  return {
    id: `${equipmentId}-${pt.pointCode || pt.id}`,
    databasePointId: pt.id,
    equipmentId,
    equipmentName,
    pointId: pt.pointCode,
    pointKey: pt.pointCode,
    pointDescription: pt.pointName,
    pointName: pt.pointName,
    pointReferenceId: pt.pointCode,
    value: valueStr,
    units,
    status: pt.status === 'ACTIVE' ? 'OK' : 'Warn',
    writable: pt.writable,
  };
}

/**
 * @returns {{ site: object, equipment: object[] }}
 */
async function buildWorkingSiteEquipmentFromDb(siteId) {
  const siteRow = await prisma.site.findUnique({ where: { id: siteId } });
  if (!siteRow) {
    return { site: null, equipment: [] };
  }

  const buildings = sortBySortOrderThenName(
    await prisma.building.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
    })
  );

  const siteBuildings = [];
  const allEquipment = [];

  for (const b of buildings) {
    const floors = sortBySortOrderThenName(
      await prisma.floor.findMany({
        where: { buildingId: b.id },
        orderBy: { name: 'asc' },
      })
    );
    const layoutStatus = b.status === 'ACTIVE' ? 'normal' : 'warning';
    const floorNodes = floors.map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder ?? 0,
      floorType: f.floorType || 'Standard Floor',
      occupancyType: f.occupancyType || '',
    }));

    siteBuildings.push({
      id: b.id,
      name: b.name,
      /** Empty when unset so Site Builder dropdown matches an option (no fake "Building" value). */
      buildingType: b.buildingType != null && String(b.buildingType).trim() ? String(b.buildingType).trim() : '',
      buildingCode: b.buildingCode || '',
      description: b.description != null && String(b.description).trim() ? String(b.description).trim() : '',
      address: b.addressLine1,
      city: b.city,
      state: b.state,
      lat: b.latitude,
      lng: b.longitude,
      status: formLabelFromEntityStatus(b.status),
      layoutStatus,
      sortOrder: b.sortOrder ?? 0,
      hasFloors: floorNodes.length > 0,
      floors: floorNodes,
    });

    for (const f of floors) {
      const equipmentList = await prisma.equipment.findMany({
        where: { floorId: f.id },
        orderBy: { name: 'asc' },
        include: { controllersMapped: true },
      });
      for (const eq of equipmentList) {
        const points = await prisma.point.findMany({
          where: { equipmentId: eq.id },
          orderBy: { pointCode: 'asc' },
        });
        const livePoints = points.map((p) => pointToWorkspaceRow(eq.id, eq.name, p));
        const ec = eq.controllersMapped;
        const engStatus = ec
          ? 'CONTROLLER_ASSIGNED'
          : eq.status === 'ACTIVE'
            ? 'MISSING_CONTROLLER'
            : 'DRAFT';
        allEquipment.push({
          id: eq.id,
          floorId: eq.floorId,
          siteId: eq.siteId,
          buildingId: eq.buildingId,
          name: eq.name,
          displayLabel: eq.name,
          type: eq.equipmentType,
          instanceNumber: eq.instanceNumber ?? null,
          equipmentType: eq.equipmentType,
          address: eq.address || '',
          locationLabel: '',
          controllerRef: ec ? ec.controllerCode : null,
          deviceInstance: ec?.deviceInstance ?? null,
          protocol: ec ? ec.protocol || 'BACnet/IP' : 'API',
          templateName: eq.templateName ?? null,
          pointsDefined: points.length,
          status: engStatus,
          notes: '',
          livePoints,
        });
      }
    }
  }

  const workingSite = {
    id: siteRow.id,
    name: siteRow.name,
    mode: 'api',
    status: 'editing',
    /** Site Builder "Status" dropdown (maps to Site.status in DB) */
    nodeStatus: formLabelFromEntityStatus(siteRow.status),
    siteType: siteRow.siteType || '',
    timezone: siteRow.timezone || '',
    displayLabel: siteRow.displayLabel || siteRow.name,
    description: siteRow.description || '',
    engineeringNotes: siteRow.engineeringNotes || '',
    icon: siteRow.icon || '',
    buildings: siteBuildings,
  };

  return { site: workingSite, equipment: allEquipment };
}

module.exports = {
  buildWorkingSiteEquipmentFromDb,
  entityStatusFromFormLabel,
  formLabelFromEntityStatus,
  normalizeEntityStatusForDb,
};
