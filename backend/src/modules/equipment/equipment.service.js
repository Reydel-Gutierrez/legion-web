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

async function listEquipmentBySite(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  return prisma.equipment.findMany({
    where: { siteId },
    include: {
      building: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true } },
      _count: { select: { points: true } },
    },
    orderBy: [{ buildingId: 'asc' }, { floorId: 'asc' }, { name: 'asc' }],
  });
}

async function createEquipment(floorId, data) {
  const floor = await getFloorWithContext(floorId);
  const siteId = floor.building.siteId;
  const buildingId = floor.buildingId;

  const { name, code, equipmentType, status, templateName, address, instanceNumber } = data;
  if (!name || !code || !equipmentType) {
    throw new HttpError(400, 'name, code, and equipmentType are required');
  }

  const template =
    templateName != null && String(templateName).trim() !== ''
      ? String(templateName).trim()
      : null;

  const inst =
    instanceNumber != null && String(instanceNumber).trim() !== ''
      ? String(instanceNumber).trim()
      : null;

  return prisma.equipment.create({
    data: {
      siteId,
      buildingId,
      floorId,
      name: String(name).trim(),
      code: String(code).trim(),
      equipmentType: String(equipmentType).trim(),
      ...(template ? { templateName: template } : {}),
      ...(status ? { status } : {}),
      ...(address != null && String(address).trim() !== ''
        ? { address: String(address).trim() }
        : {}),
      ...(inst ? { instanceNumber: inst } : {}),
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
  const allowed = ['name', 'code', 'equipmentType', 'status', 'templateName', 'address', 'instanceNumber'];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'templateName' || key === 'address' || key === 'instanceNumber') {
        const v = data[key];
        update[key] =
          v === null || v === '' ? null : typeof v === 'string' ? v.trim() : v;
      } else {
        update[key] =
          typeof data[key] === 'string' ? data[key].trim() : data[key];
      }
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

async function deleteEquipment(id) {
  const existing = await getEquipmentById(id);
  await prisma.equipment.delete({
    where: { id },
  });
  return existing;
}

module.exports = {
  listEquipmentByFloor,
  listEquipmentBySite,
  createEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
};
