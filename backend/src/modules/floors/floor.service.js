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
  });
}

module.exports = {
  listFloorsByBuilding,
  createFloor,
};
