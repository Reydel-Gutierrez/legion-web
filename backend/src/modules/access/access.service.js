const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

/** Map UI / mock role keys to seeded Role.name values (Prisma seed has no org_admin / viewer). */
function resolveDbRoleName(roleId, roleName) {
  if (roleId && typeof roleId === 'string') {
    return { byId: roleId.trim(), byName: null };
  }
  const raw = roleName != null && String(roleName).trim() ? String(roleName).trim().toLowerCase() : '';
  const alias = {
    org_admin: 'super_admin',
    viewer: 'operator',
  };
  const name = alias[raw] || raw || 'site_admin';
  return { byId: null, byName: name };
}

async function grantUserSiteAccess(siteId, data) {
  const { userId, roleId, roleName } = data || {};
  if (!userId) {
    throw new HttpError(400, 'userId is required');
  }

  const { byId, byName } = resolveDbRoleName(roleId, roleName);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  let role = byId
    ? await prisma.role.findUnique({ where: { id: byId } })
    : await prisma.role.findFirst({ where: { name: byName } });
  if (!role && byName) {
    role = await prisma.role.findFirst({ where: { name: 'site_admin' } });
  }
  if (!role) {
    role = await prisma.role.create({ data: { name: 'site_admin' } });
  }

  return prisma.userSiteAccess.upsert({
    where: {
      userId_siteId: { userId, siteId },
    },
    create: {
      userId,
      siteId,
      roleId: role.id,
    },
    update: {
      roleId: role.id,
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
