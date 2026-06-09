'use strict';

/**
 * Removes retired Legion SIM lab equipment (FCU/VAV demo rows) and cascaded points/mappings.
 * Safe to run idempotently during seed.
 */

const LEGACY_SIM_EQUIPMENT_CODES = ['FCU-1', 'FCU-2', 'VAV-1'];
const LEGACY_SIM_EQUIPMENT_NAMES = ['LC-CGC', 'LC-CVC'];

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} siteId
 * @returns {Promise<{ removed: number, equipmentIds: string[] }>}
 */
async function removeLegacySimDemoData(prisma, siteId) {
  const sid = String(siteId || '').trim();
  if (!sid) return { removed: 0, equipmentIds: [] };

  const rows = await prisma.equipment.findMany({
    where: {
      siteId: sid,
      OR: [
        ...LEGACY_SIM_EQUIPMENT_CODES.map((code) => ({
          code: { equals: code, mode: 'insensitive' },
        })),
        ...LEGACY_SIM_EQUIPMENT_NAMES.map((name) => ({
          name: { equals: name, mode: 'insensitive' },
        })),
      ],
    },
    select: { id: true, code: true, name: true },
  });

  for (const row of rows) {
    await prisma.equipment.delete({ where: { id: row.id } });
  }

  if (rows.length > 0) {
    // eslint-disable-next-line no-console
    console.log('[seed] Removed legacy SIM demo equipment', {
      siteId: sid,
      count: rows.length,
      rows: rows.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    });
  }

  return {
    removed: rows.length,
    equipmentIds: rows.map((r) => r.id),
  };
}

module.exports = {
  removeLegacySimDemoData,
  LEGACY_SIM_EQUIPMENT_CODES,
  LEGACY_SIM_EQUIPMENT_NAMES,
};
