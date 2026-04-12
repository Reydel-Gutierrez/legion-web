'use strict';

const prisma = require('./prisma');

const DEFAULT_OWNER_EMAIL = 'reydel.gutierrez@legioncontrol.com';
const DEFAULT_OWNER_NAME = 'Reydel Gutierrez';

/**
 * Resolve the lab owner user: match env / primary / legacy seed emails, or create the primary.
 */
async function findOrCreateOwnerUser() {
  const primaryEmail = (process.env.SEED_OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  const displayName = (process.env.SEED_OWNER_NAME || DEFAULT_OWNER_NAME).trim();
  const tryEmails = [...new Set([primaryEmail, DEFAULT_OWNER_EMAIL, 'reydel@legion.local'].filter(Boolean))];

  for (const email of tryEmails) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (displayName && existing.name !== displayName) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: displayName },
        });
      }
      if (
        existing.email === 'reydel@legion.local' &&
        primaryEmail === DEFAULT_OWNER_EMAIL &&
        primaryEmail !== existing.email
      ) {
        const taken = await prisma.user.findUnique({ where: { email: primaryEmail } });
        if (!taken) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { email: primaryEmail },
          });
          return prisma.user.findUnique({ where: { id: existing.id } });
        }
      }
      return existing;
    }
  }

  return prisma.user.create({
    data: {
      email: primaryEmail,
      name: displayName || DEFAULT_OWNER_NAME,
    },
  });
}

/**
 * Ensures the lab owner user has UserSiteAccess to the site and is set as createdBy when missing.
 */
async function ensureSeedOwnerSiteAccess(siteId) {
  let role = await prisma.role.findFirst({ where: { name: 'site_admin' } });
  if (!role) {
    role = await prisma.role.create({ data: { name: 'site_admin' } });
  }

  const owner = await findOrCreateOwnerUser();
  if (!owner) return;

  await prisma.site.updateMany({
    where: { id: siteId, createdByUserId: null },
    data: { createdByUserId: owner.id },
  });

  await prisma.userSiteAccess.upsert({
    where: { userId_siteId: { userId: owner.id, siteId } },
    update: { roleId: role.id },
    create: {
      userId: owner.id,
      siteId,
      roleId: role.id,
    },
  });
}

/**
 * Ensures the lab owner has UserSiteAccess for every listed site id where they are missing a row.
 * Sites with other users but no owner (e.g. created before createSite granted access) are fixed here.
 * @param {string[]} siteIds
 * @returns {Promise<boolean>} true if any row was created or site creator was set
 */
async function ensureSeedOwnerSiteAccessBatch(siteIds) {
  const uniq = [...new Set((siteIds || []).filter(Boolean))];
  if (!uniq.length) return false;

  const owner = await findOrCreateOwnerUser();
  if (!owner) return false;

  let role = await prisma.role.findFirst({ where: { name: 'site_admin' } });
  if (!role) {
    role = await prisma.role.create({ data: { name: 'site_admin' } });
  }

  const existing = await prisma.userSiteAccess.findMany({
    where: { userId: owner.id, siteId: { in: uniq } },
    select: { siteId: true },
  });
  const have = new Set(existing.map((e) => e.siteId));

  let madeChanges = false;
  for (const siteId of uniq) {
    if (have.has(siteId)) continue;

    const siteUpd = await prisma.site.updateMany({
      where: { id: siteId, createdByUserId: null },
      data: { createdByUserId: owner.id },
    });
    if (siteUpd.count > 0) madeChanges = true;

    await prisma.userSiteAccess.create({
      data: {
        userId: owner.id,
        siteId,
        roleId: role.id,
      },
    });
    madeChanges = true;
    have.add(siteId);
  }

  return madeChanges;
}

module.exports = {
  ensureSeedOwnerSiteAccess,
  ensureSeedOwnerSiteAccessBatch,
  findOrCreateOwnerUser,
};
