/**
 * Canonical site/building/floor/equipment hierarchy from Prisma.
 * Used to sync engineering working-version payload with relational data.
 */

const prisma = require('../../lib/prisma');

function pointToWorkspaceRow(equipmentId, equipmentName, pt) {
  const units = pt.unit || '';
  const val = pt.presentValue != null && pt.presentValue !== '' ? String(pt.presentValue) : '—';
  const valueStr = units ? `${val} ${units}`.trim() : val;
  return {
    id: `${equipmentId}-${pt.pointCode || pt.id}`,
    equipmentId,
    equipmentName,
    pointId: pt.pointCode,
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

  const buildings = await prisma.building.findMany({
    where: { siteId },
    orderBy: { name: 'asc' },
  });

  const siteBuildings = [];
  const allEquipment = [];

  for (const b of buildings) {
    const floors = await prisma.floor.findMany({
      where: { buildingId: b.id },
      orderBy: { name: 'asc' },
    });
    const layoutStatus = b.status === 'ACTIVE' ? 'normal' : 'warning';
    const floorNodes = floors.map((f, fi) => ({
      id: f.id,
      name: f.name,
      sortOrder: fi,
      floorType: 'Standard Floor',
    }));

    siteBuildings.push({
      id: b.id,
      name: b.name,
      buildingType: 'Building',
      buildingCode: '',
      address: b.addressLine1,
      city: b.city,
      state: b.state,
      lat: b.latitude,
      lng: b.longitude,
      status: layoutStatus,
      hasFloors: floorNodes.length > 0,
      floors: floorNodes,
    });

    for (const f of floors) {
      const equipmentList = await prisma.equipment.findMany({
        where: { floorId: f.id },
        orderBy: { name: 'asc' },
      });
      for (const eq of equipmentList) {
        const points = await prisma.point.findMany({
          where: { equipmentId: eq.id },
          orderBy: { pointCode: 'asc' },
        });
        const livePoints = points.map((p) => pointToWorkspaceRow(eq.id, eq.name, p));
        const engStatus = eq.status === 'ACTIVE' ? 'CONTROLLER_ASSIGNED' : 'DRAFT';
        allEquipment.push({
          id: eq.id,
          floorId: eq.floorId,
          siteId: eq.siteId,
          buildingId: eq.buildingId,
          name: eq.name,
          displayLabel: eq.name,
          type: eq.equipmentType,
          instanceNumber: null,
          equipmentType: eq.equipmentType,
          address: eq.address || '',
          locationLabel: '',
          controllerRef: null,
          protocol: 'API',
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
    siteType: 'Site',
    address: '',
    timezone: '',
    buildings: siteBuildings,
  };

  return { site: workingSite, equipment: allEquipment };
}

module.exports = {
  buildWorkingSiteEquipmentFromDb,
};
