const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function assertBuildingExists(buildingId) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
  });
  if (!building) {
    throw new HttpError(404, 'Building not found');
  }
}

async function listFloorsByBuilding(buildingId) {
  await assertBuildingExists(buildingId);
  return prisma.floor.findMany({
    where: { buildingId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { equipment: true } } },
  });
}

async function createFloor(buildingId, data) {
  await assertBuildingExists(buildingId);
  const { name, status } = data;
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  return prisma.floor.create({
    data: {
      buildingId,
      name: name.trim(),
      ...(status ? { status } : {}),
    },
    include: { building: true },
  });
}

async function updateFloor(id, data) {
  const existing = await prisma.floor.findUnique({
    where: { id },
    include: { building: true },
  });
  if (!existing) {
    throw new HttpError(404, 'Floor not found');
  }
  const allowed = ['name', 'status'];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      update[key] =
        key === 'name' ? String(data[key]).trim() : data[key];
    }
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.floor.update({
    where: { id },
    data: update,
    include: { building: true },
  });
}

async function deleteFloor(id) {
  const existing = await prisma.floor.findUnique({
    where: { id },
    include: { building: true },
  });
  if (!existing) {
    throw new HttpError(404, 'Floor not found');
  }
  await prisma.floor.delete({ where: { id } });
  return existing;
}

module.exports = {
  listFloorsByBuilding,
  createFloor,
  updateFloor,
  deleteFloor,
};
