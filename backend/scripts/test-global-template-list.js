/**
 * Quick check: DB + Prisma client can list global equipment templates (and lazy-seed if empty).
 * Usage: node scripts/test-global-template-list.js
 */
const svc = require('../src/modules/globalTemplateLibrary/globalTemplateLibrary.service');
const prisma = require('../src/lib/prisma');

svc
  .listEquipmentTemplates()
  .then((rows) => {
    console.log('OK, rows:', rows.length);
    rows.forEach((r) => console.log(' -', r.name, r.pointCount));
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  });
