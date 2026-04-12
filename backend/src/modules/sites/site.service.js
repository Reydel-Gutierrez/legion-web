const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { sortBySortOrderThenName } = require('../../lib/hierarchySort');
const { normalizeEntityStatusForDb } = require('../siteHierarchy/siteHierarchy.service');
const { ensureSeedOwnerSiteAccess, ensureSeedOwnerSiteAccessBatch } = require('../../lib/siteAccess');

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

async function listSites() {
  const include = {
    _count: { select: { buildings: true, userSiteAccess: true } },
    createdByUser: { select: { id: true, email: true, name: true } },
  };

  let rows = await prisma.site.findMany({
    orderBy: { name: 'asc' },
    include,
  });

  const healed = await ensureSeedOwnerSiteAccessBatch(rows.map((r) => r.id));
  if (healed) {
    rows = await prisma.site.findMany({
      orderBy: { name: 'asc' },
      include,
    });
  }

  return rows.map((row) => {
    const { _count, ...rest } = row;
    return {
      ...rest,
      _count: { buildings: _count.buildings },
    };
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
  if (site.buildings) sortBySortOrderThenName(site.buildings);
  return site;
}

async function createSite(data) {
  const { name, status } = data;
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  const extra = {};
  const textFields = [
    'timezone',
    'siteType',
    'description',
    'displayLabel',
    'engineeringNotes',
    'icon',
  ];
  for (const key of textFields) {
    if (data[key] !== undefined) extra[key] = strOrNull(data[key]);
  }
  let entityStatus;
  if (data.status !== undefined) {
    entityStatus = normalizeEntityStatusForDb(data.status);
  }
  const created = await prisma.site.create({
    data: {
      name: name.trim(),
      ...(entityStatus ? { status: entityStatus } : {}),
      ...extra,
    },
  });
  await ensureSeedOwnerSiteAccess(created.id);
  return prisma.site.findUnique({
    where: { id: created.id },
    include: {
      _count: { select: { buildings: true } },
      createdByUser: { select: { id: true, email: true, name: true } },
    },
  });
}

async function updateSite(id, data) {
  await getSiteById(id);
  const allowedScalar = [
    'name',
    'timezone',
    'siteType',
    'description',
    'displayLabel',
    'engineeringNotes',
    'icon',
  ];
  const update = {};
  for (const key of allowedScalar) {
    if (data[key] !== undefined) {
      update[key] = strOrNull(data[key]);
    }
  }
  if (data.status !== undefined) {
    update.status = normalizeEntityStatusForDb(data.status);
  }
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
