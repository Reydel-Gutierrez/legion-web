const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function listSites() {
  return prisma.site.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { buildings: true } },
      createdByUser: { select: { id: true, email: true, name: true } },
    },
  });
}

async function getSiteById(id) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      createdByUser: { select: { id: true, email: true, name: true } },
      buildings: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { floors: true } } },
      },
    },
  });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  return site;
}

async function createSite(data) {
  const { name, status } = data;
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  return prisma.site.create({
    data: {
      name: name.trim(),
      ...(status ? { status } : {}),
    },
  });
}

async function updateSite(id, data) {
  await getSiteById(id);
  const { name, status } = data;
  const update = {};
  if (name !== undefined) update.name = String(name).trim();
  if (status !== undefined) update.status = status;
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }
  return prisma.site.update({
    where: { id },
    data: update,
  });
}

module.exports = {
  listSites,
  getSiteById,
  createSite,
  updateSite,
};
