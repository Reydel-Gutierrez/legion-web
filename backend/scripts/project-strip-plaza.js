'use strict';

/**
 * `npm run project:strip-plaza` — creates/updates the Strip Plaza reference project in the
 * *Engineering* database only (LC-ARCH-002 §10: "Create a repeatable Strip Plaza engineering
 * project fixture/export for development, clearly labeled non-production"). This is deliberately
 * NOT `SEED_DEMO_SITES` and NOT how an LS-100 (simulation or production) ever gets a Site — an
 * LS-100 receives Strip Plaza only by importing/deploying the `.lspkg` this project can build,
 * never by running this script against its own database.
 *
 * Idempotent: every row uses a fixed, well-known id (like `DEMO_CAMPUS_SITE_ID`), so re-running
 * this script updates the same rows rather than duplicating them.
 */

if ((process.env.LEGION_PROFILE || 'engineering').startsWith('ls100')) {
  console.error(
    `[project:strip-plaza] Refusing to run: LEGION_PROFILE=${process.env.LEGION_PROFILE}. ` +
    'The LS-100 simulation/production database must receive Strip Plaza only through package deployment/import ' +
    '(build a .lspkg from the engineering profile, then deploy or import it) — never through this command.'
  );
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const equipmentControllersService = require('../src/modules/equipmentControllers/equipmentControllers.service');
const { syncSimCatalogBindingsForEquipmentId } = require('../src/lib/simCatalogBindingSync');
const globalTemplateLibraryService = require('../src/modules/globalTemplateLibrary/globalTemplateLibrary.service');
const { getOrCreateWorkingVersion, syncWorkingPayloadFromDb } = require('../src/modules/siteVersions/siteVersion.service');

const STRIP_PLAZA_SITE_ID = process.env.STRIP_PLAZA_SITE_ID || 'strip0000-0000-4000-8000-000000000001';
const STRIP_PLAZA_BUILDING_ID = 'strip0000-0000-4000-8000-000000000002';
const STRIP_PLAZA_FLOOR_ID = 'strip0000-0000-4000-8000-000000000003';
const STRIP_PLAZA_FCU1_ID = 'strip0000-0000-4000-8000-000000000004';
const STRIP_PLAZA_FCU2_ID = 'strip0000-0000-4000-8000-000000000005';
const STRIP_PLAZA_ALARM_ID = 'strip0000-0000-4000-8000-000000000006';
const STRIP_PLAZA_TREND_ID = 'strip0000-0000-4000-8000-000000000007';
const STRIP_PLAZA_TREND_ASSIGNMENT_ID = 'strip0000-0000-4000-8000-000000000008';

async function ensureFcuTemplateExists() {
  const templates = await globalTemplateLibraryService.listEquipmentTemplates();
  const fcu = templates.find((t) => t.equipmentType === 'FCU');
  if (!fcu) {
    console.warn('[project:strip-plaza] No existing FCU equipment template found — equipment will be created without templateName.');
  }
  return fcu ? fcu.name : null;
}

async function ensureEquipment(id, code, siteId, buildingId, floorId, templateName) {
  return prisma.equipment.upsert({
    where: { id },
    create: { id, siteId, buildingId, floorId, name: code, code, equipmentType: 'FCU', templateName, status: 'ACTIVE' },
    update: { name: code, code, equipmentType: 'FCU', templateName, status: 'ACTIVE', buildingId, floorId },
  });
}

async function ensureSimController(equipmentId, controllerCode) {
  const existing = await prisma.controllersMapped.findUnique({ where: { equipmentId } });
  if (existing && existing.controllerCode === controllerCode && existing.protocol === 'SIM') return existing;
  return equipmentControllersService.assign({ equipmentId, controllerCode, protocol: 'SIM' });
}

async function main() {
  console.log('[project:strip-plaza] Building the Strip Plaza engineering reference project…');

  const templateName = await ensureFcuTemplateExists();

  const site = await prisma.site.upsert({
    where: { id: STRIP_PLAZA_SITE_ID },
    create: { id: STRIP_PLAZA_SITE_ID, name: 'Strip Plaza', status: 'ACTIVE', siteType: 'Commercial', description: 'Legion Engineering reference project for local development and testing (non-production).' },
    update: { name: 'Strip Plaza', status: 'ACTIVE' },
  });

  await prisma.building.upsert({
    where: { id: STRIP_PLAZA_BUILDING_ID },
    create: { id: STRIP_PLAZA_BUILDING_ID, siteId: site.id, name: 'Strip Plaza Building', addressLine1: '100 Strip Plaza Way', city: 'Sample City', state: 'FL', postalCode: '32801', country: 'US', status: 'ACTIVE' },
    update: { name: 'Strip Plaza Building' },
  });

  await prisma.floor.upsert({
    where: { id: STRIP_PLAZA_FLOOR_ID },
    create: { id: STRIP_PLAZA_FLOOR_ID, buildingId: STRIP_PLAZA_BUILDING_ID, name: 'Main Floor', status: 'ACTIVE', floorType: 'Standard Floor' },
    update: { name: 'Main Floor' },
  });

  await ensureEquipment(STRIP_PLAZA_FCU1_ID, 'FCU-1', site.id, STRIP_PLAZA_BUILDING_ID, STRIP_PLAZA_FLOOR_ID, templateName);
  await ensureEquipment(STRIP_PLAZA_FCU2_ID, 'FCU-2', site.id, STRIP_PLAZA_BUILDING_ID, STRIP_PLAZA_FLOOR_ID, templateName);

  await ensureSimController(STRIP_PLAZA_FCU1_ID, 'FCU-1');
  await ensureSimController(STRIP_PLAZA_FCU2_ID, 'FCU-2');
  const sync1 = await syncSimCatalogBindingsForEquipmentId(STRIP_PLAZA_FCU1_ID);
  const sync2 = await syncSimCatalogBindingsForEquipmentId(STRIP_PLAZA_FCU2_ID);
  if (!sync1.ok || !sync2.ok) {
    console.warn('[project:strip-plaza] SIM catalog binding sync did not fully complete:', { sync1, sync2 });
  }

  const spaceTempPoint = await prisma.point.findFirst({ where: { equipmentId: STRIP_PLAZA_FCU1_ID, pointCode: 'SPACE_TEMP' } });

  await prisma.alarmDefinition.upsert({
    where: { id: STRIP_PLAZA_ALARM_ID },
    create: {
      id: STRIP_PLAZA_ALARM_ID,
      siteId: site.id,
      equipmentId: STRIP_PLAZA_FCU1_ID,
      pointKey: 'SPACE_TEMP',
      pointId: spaceTempPoint?.id ?? null,
      name: 'FCU-1 High Space Temperature',
      enabled: true,
      severity: 'WARNING',
      category: 'THRESHOLD',
      operator: 'GT',
      targetValue: 85,
      deadband: 1,
      delaySeconds: 60,
    },
    update: { pointId: spaceTempPoint?.id ?? null, name: 'FCU-1 High Space Temperature' },
  });

  await prisma.trendDefinition.upsert({
    where: { id: STRIP_PLAZA_TREND_ID },
    create: {
      id: STRIP_PLAZA_TREND_ID,
      siteId: site.id,
      name: 'Strip Plaza FCU Space Temperature Trend',
      enabled: true,
      sampleInterval: 60,
      retentionDays: 30,
      pointRequirements: [{ pointKey: 'SPACE_TEMP' }],
    },
    update: { name: 'Strip Plaza FCU Space Temperature Trend' },
  });
  await prisma.trendAssignment.upsert({
    where: { id: STRIP_PLAZA_TREND_ASSIGNMENT_ID },
    create: {
      id: STRIP_PLAZA_TREND_ASSIGNMENT_ID,
      definitionId: STRIP_PLAZA_TREND_ID,
      siteId: site.id,
      equipmentId: STRIP_PLAZA_FCU1_ID,
      enabled: true,
      resolvedMappings: { SPACE_TEMP: spaceTempPoint?.id ?? null },
    },
    update: { resolvedMappings: { SPACE_TEMP: spaceTempPoint?.id ?? null } },
  });

  // Leaves a current WORKING SiteVersion in place so `POST /api/sites/:id/package/validate` and
  // `/package/build` work immediately without any other manual step.
  await getOrCreateWorkingVersion(site.id);
  await syncWorkingPayloadFromDb(site.id);

  console.log('[project:strip-plaza] Done. Strip Plaza is ready in the Engineering project only:');
  console.log(`  Site:        ${site.id} (${site.name})`);
  console.log('  Equipment:   FCU-1, FCU-2 (LPC0810 SIM identity, per backend/src/lib/simulatedControllers/catalog.js)');
  console.log('  Alarm:       FCU-1 High Space Temperature (THRESHOLD/GT 85°F)');
  console.log('  Trend:       Strip Plaza FCU Space Temperature Trend (60s interval, 30d retention)');
  console.log('  Next:        POST /api/sites/' + site.id + '/package/validate, then /package/build, then deploy/export.');
  console.log('  This project is NOT in any LS-100 database — it exists only here until explicitly deployed or imported.');
}

main()
  .catch((err) => {
    console.error('[project:strip-plaza] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
