const prisma = require('../../lib/prisma');

/**
 * Phase 1: roles are created via seed and referenced by UserSiteAccess.
 * Exposed for future admin endpoints.
 */
async function listRoles() {
  return prisma.role.findMany({ orderBy: { name: 'asc' } });
}

module.exports = {
  listRoles,
};
