const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function assertSiteExists(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
}

async function listUsers() {
  return prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: {
      userSiteAccess: {
        include: { site: true, role: true },
      },
    },
  });
}

async function createUser(data) {
  const { email, name, status } = data;
  if (!email || typeof email !== 'string') {
    throw new HttpError(400, 'email is required');
  }
  const normalized = email.trim().toLowerCase();
  return prisma.user.create({
    data: {
      email: normalized,
      ...(name != null ? { name: String(name).trim() } : {}),
      ...(status ? { status } : {}),
    },
  });
}

async function listUsersBySite(siteId) {
  await assertSiteExists(siteId);
  const rows = await prisma.userSiteAccess.findMany({
    where: { siteId },
    include: {
      user: true,
      role: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows;
}

module.exports = {
  listUsers,
  createUser,
  listUsersBySite,
};
