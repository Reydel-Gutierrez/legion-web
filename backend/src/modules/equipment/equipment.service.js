const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function getFloorWithContext(floorId) {
  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    include: { building: true },
  });
  if (!floor) {
    throw new HttpError(404, 'Floor not found');
  }
  return floor;
}

async function listEquipmentByFloor(floorId) {
  await getFloorWithContext(floorId);
  return prisma.equipment.findMany({
    where: { floorId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { points: true } } },
  });
}

async function createEquipment(floorId, data) {
  const floor = await getFloorWithContext(floorId);
  const siteId = floor.building.siteId;
  const buildingId = floor.buildingId;

  const { name, code, equipmentType, status } = data;
  if (!name || !code || !equipmentType) {
    throw new HttpError(400, 'name, code, and equipmentType are required');
  }

  return prisma.equipment.create({
    data: {
      siteId,
      buildingId,
      floorId,
      name: String(name).trim(),
      code: String(code).trim(),
      equipmentType: String(equipmentType).trim(),
      ...(status ? { status } : {}),
    },
  });
}

async function getEquipmentById(id) {
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      site: true,
      building: true,
      floor: true,
    },
  });
  if (!equipment) {
    throw new HttpError(404, 'Equipment not found');
  }
  return equipment;
}

async function updateEquipment(id, data) {
  await getEquipmentById(id);
  const allowed = ['name', 'code', 'equipmentType', 'status'];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      update[key] =
        typeof data[key] === 'string' ? data[key].trim() : data[key];
    }
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.equipment.update({
    where: { id },
    data: update,
  });
}

module.exports = {
  listEquipmentByFloor,
  createEquipment,
  getEquipmentById,
  updateEquipment,
};
