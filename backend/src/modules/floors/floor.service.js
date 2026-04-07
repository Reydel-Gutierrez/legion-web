const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { sortBySortOrderThenName } = require('../../lib/hierarchySort');
const { normalizeEntityStatusForDb } = require('../siteHierarchy/siteHierarchy.service');

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
  return sortBySortOrderThenName(
    await prisma.floor.findMany({
      where: { buildingId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { equipment: true } } },
    })
  );
}

async function createFloor(buildingId, data) {
  await assertBuildingExists(buildingId);
  const { name } = data;
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  const sortOrder =
    data.sortOrder !== undefined && data.sortOrder !== null && data.sortOrder !== ''
      ? Number(data.sortOrder)
      : 0;
  return prisma.floor.create({
    data: {
      buildingId,
      name: name.trim(),
      ...(data.status !== undefined ? { status: normalizeEntityStatusForDb(data.status) } : {}),
      ...(data.floorType != null && String(data.floorType).trim()
        ? { floorType: String(data.floorType).trim() }
        : {}),
      ...(data.occupancyType != null && String(data.occupancyType).trim()
        ? { occupancyType: String(data.occupancyType).trim() }
        : {}),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
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
  const update = {};
  if (data.name !== undefined) {
    update.name = String(data.name).trim();
  }
  if (data.status !== undefined) {
    update.status = normalizeEntityStatusForDb(data.status);
  }
  if (data.floorType !== undefined) {
    const s = data.floorType == null ? '' : String(data.floorType).trim();
    update.floorType = s.length ? s : null;
  }
  if (data.occupancyType !== undefined) {
    const s = data.occupancyType == null ? '' : String(data.occupancyType).trim();
    update.occupancyType = s.length ? s : null;
  }
  if (data.sortOrder !== undefined) {
    const n = Number(data.sortOrder);
    update.sortOrder = Number.isFinite(n) ? n : 0;
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
