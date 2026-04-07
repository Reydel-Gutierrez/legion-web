const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { sortBySortOrderThenName } = require('../../lib/hierarchySort');
const { normalizeEntityStatusForDb } = require('../siteHierarchy/siteHierarchy.service');

async function assertSiteExists(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
}

async function listBuildingsBySite(siteId) {
  await assertSiteExists(siteId);
  return sortBySortOrderThenName(
    await prisma.building.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { floors: true } } },
    })
  );
}

async function getBuildingById(id) {
  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      site: true,
      floors: { orderBy: { name: 'asc' } },
    },
  });
  if (!building) {
    throw new HttpError(404, 'Building not found');
  }
  if (building.floors) sortBySortOrderThenName(building.floors);
  return building;
}

async function createBuilding(siteId, data) {
  await assertSiteExists(siteId);
  const {
    name,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    latitude,
    longitude,
  } = data;

  if (!name || !addressLine1 || !city || !state || !postalCode || !country) {
    throw new HttpError(
      400,
      'name, addressLine1, city, state, postalCode, and country are required'
    );
  }

  const sortOrder =
    data.sortOrder !== undefined && data.sortOrder !== null && data.sortOrder !== ''
      ? Number(data.sortOrder)
      : 0;
  return prisma.building.create({
    data: {
      siteId,
      name: String(name).trim(),
      addressLine1: String(addressLine1).trim(),
      addressLine2: addressLine2 != null ? String(addressLine2).trim() : null,
      city: String(city).trim(),
      state: String(state).trim(),
      postalCode: String(postalCode).trim(),
      country: String(country).trim(),
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      ...(data.status !== undefined ? { status: normalizeEntityStatusForDb(data.status) } : {}),
      ...(data.buildingType != null && String(data.buildingType).trim()
        ? { buildingType: String(data.buildingType).trim() }
        : {}),
      ...(data.buildingCode != null && String(data.buildingCode).trim()
        ? { buildingCode: String(data.buildingCode).trim() }
        : {}),
      ...(data.description != null && String(data.description).trim()
        ? { description: String(data.description).trim() }
        : {}),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  });
}

async function updateBuilding(id, data) {
  await getBuildingById(id);
  const allowed = [
    'name',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
    'country',
    'latitude',
    'longitude',
    'buildingType',
    'buildingCode',
    'description',
    'sortOrder',
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'latitude' || key === 'longitude') {
        update[key] = data[key] == null ? null : Number(data[key]);
      } else if (key === 'sortOrder') {
        const n = Number(data[key]);
        update[key] = Number.isFinite(n) ? n : 0;
      } else if (key === 'addressLine2') {
        update[key] = data[key] == null ? null : String(data[key]).trim();
      } else if (key === 'buildingType' || key === 'buildingCode') {
        const s = data[key] == null ? '' : String(data[key]).trim();
        update[key] = s.length ? s : null;
      } else if (key === 'description') {
        const s = data[key] == null ? '' : String(data[key]).trim();
        update[key] = s.length ? s : null;
      } else {
        update[key] =
          typeof data[key] === 'string' ? data[key].trim() : data[key];
      }
    }
  }
  if (data.status !== undefined) {
    update.status = normalizeEntityStatusForDb(data.status);
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.building.update({
    where: { id },
    data: update,
  });
}

async function deleteBuilding(id) {
  await getBuildingById(id);
  return prisma.building.delete({
    where: { id },
  });
}

module.exports = {
  listBuildingsBySite,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
};
