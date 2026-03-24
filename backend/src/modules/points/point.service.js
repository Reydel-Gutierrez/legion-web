const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function getEquipmentContext(equipmentId) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: { floor: true, building: true, site: true },
  });
  if (!equipment) {
    throw new HttpError(404, 'Equipment not found');
  }
  return equipment;
}

async function listPointsByEquipment(equipmentId) {
  await getEquipmentContext(equipmentId);
  return prisma.point.findMany({
    where: { equipmentId },
    orderBy: { pointName: 'asc' },
  });
}

async function createPoint(equipmentId, data) {
  const equipment = await getEquipmentContext(equipmentId);
  const siteId = equipment.siteId;
  const buildingId = equipment.buildingId;
  const floorId = equipment.floorId;

  const {
    pointName,
    pointCode,
    pointType,
    unit,
    writable,
    presentValue,
    status,
  } = data;

  if (!pointName || !pointCode || !pointType) {
    throw new HttpError(400, 'pointName, pointCode, and pointType are required');
  }

  return prisma.point.create({
    data: {
      equipmentId,
      siteId,
      buildingId,
      floorId,
      pointName: String(pointName).trim(),
      pointCode: String(pointCode).trim(),
      pointType: String(pointType).trim(),
      unit: unit != null ? String(unit).trim() : null,
      writable: Boolean(writable),
      presentValue:
        presentValue != null ? String(presentValue) : null,
      ...(status ? { status } : {}),
    },
  });
}

async function getPointById(id) {
  const point = await prisma.point.findUnique({
    where: { id },
    include: {
      equipment: true,
      site: true,
      building: true,
      floor: true,
    },
  });
  if (!point) {
    throw new HttpError(404, 'Point not found');
  }
  return point;
}

async function updatePoint(id, data) {
  await getPointById(id);
  const allowed = [
    'pointName',
    'pointCode',
    'pointType',
    'unit',
    'writable',
    'presentValue',
    'status',
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'writable') {
        update[key] = Boolean(data[key]);
      } else if (key === 'presentValue' || key === 'unit') {
        update[key] =
          data[key] == null ? null : String(data[key]);
      } else {
        update[key] =
          typeof data[key] === 'string' ? data[key].trim() : data[key];
      }
    }
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.point.update({
    where: { id },
    data: update,
  });
}

module.exports = {
  listPointsByEquipment,
  createPoint,
  getPointById,
  updatePoint,
};
