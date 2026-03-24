const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function grantUserSiteAccess(siteId, data) {
  const { userId, roleId } = data;
  if (!userId || !roleId) {
    throw new HttpError(400, 'userId and roleId are required');
  }

  const [site, user, role] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.role.findUnique({ where: { id: roleId } }),
  ]);

  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  if (!role) {
    throw new HttpError(404, 'Role not found');
  }

  return prisma.userSiteAccess.upsert({
    where: {
      userId_siteId: { userId, siteId },
    },
    create: {
      userId,
      siteId,
      roleId,
    },
    update: {
      roleId,
    },
    include: {
      user: true,
      site: true,
      role: true,
    },
  });
}

module.exports = {
  grantUserSiteAccess,
};
