const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function assertSiteExists(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
}

async function listBuildingsBySite(siteId) {
  await assertSiteExists(siteId);
  return prisma.building.findMany({
    where: { siteId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { floors: true } } },
  });
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
    status,
  } = data;

  if (!name || !addressLine1 || !city || !state || !postalCode || !country) {
    throw new HttpError(
      400,
      'name, addressLine1, city, state, postalCode, and country are required'
    );
  }

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
      ...(status ? { status } : {}),
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
    'status',
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'latitude' || key === 'longitude') {
        update[key] = data[key] == null ? null : Number(data[key]);
      } else if (key === 'addressLine2') {
        update[key] = data[key] == null ? null : String(data[key]).trim();
      } else {
        update[key] =
          typeof data[key] === 'string' ? data[key].trim() : data[key];
      }
    }
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.building.update({
    where: { id },
    data: update,
  });
}

module.exports = {
  listBuildingsBySite,
  getBuildingById,
  createBuilding,
  updateBuilding,
};
