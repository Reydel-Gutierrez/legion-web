const { PrismaClient } = require('@prisma/client');
const {
  getGlobalStarterTemplateSeedRows,
  mergeStarterEquipmentTemplatesIfEmpty,
} = require('../src/lib/legionStarterEquipmentTemplates');

const prisma = new PrismaClient();

/** Stable id so frontend mocks / User Manager can match API site selection (UUID). */
const DEMO_CAMPUS_SITE_ID =
  process.env.DEMO_CAMPUS_SITE_ID || 'cafe0000-0000-4000-8000-00000000babe';

/** Your account: granted site access + set as Demo Campus creator. Override in .env when seeding. */
const SEED_OWNER_EMAIL = (process.env.SEED_OWNER_EMAIL || 'reydel@legion.local').trim().toLowerCase();
const SEED_OWNER_NAME = process.env.SEED_OWNER_NAME || 'Reydel Gutierrez';

function pointToWorkspaceRow(equipmentId, equipmentName, pt) {
  const units = pt.unit || '';
  const val = pt.presentValue != null && pt.presentValue !== '' ? String(pt.presentValue) : '—';
  const valueStr = units ? `${val} ${units}`.trim() : val;
  const pointCode = pt.pointCode || pt.id;
  return {
    id: `${equipmentId}-${pointCode}`,
    equipmentId,
    equipmentName,
    pointId: pointCode,
    pointKey: pointCode,
    pointDescription: pt.pointName,
    pointName: pt.pointName,
    pointReferenceId: pointCode,
    value: valueStr,
    units,
    status: pt.status === 'ACTIVE' ? 'OK' : 'Warn',
    writable: pt.writable !== false,
  };
}

/** Operator deployment snapshot shape (matches frontend `buildOperatorDeploymentSnapshot`). */
async function buildDemoDeploymentSnapshot(siteId) {
  const siteRow = await prisma.site.findUnique({ where: { id: siteId } });
  if (!siteRow) return null;
  const buildings = await prisma.building.findMany({
    where: { siteId },
    orderBy: { name: 'asc' },
  });
  const siteBuildings = [];
  const allEquipment = [];

  for (const b of buildings) {
    const floors = await prisma.floor.findMany({
      where: { buildingId: b.id },
      orderBy: { name: 'asc' },
    });
    const layoutStatus = b.status === 'ACTIVE' ? 'normal' : 'warning';
    const floorNodes = [];
    for (const f of floors) {
      const equipmentList = await prisma.equipment.findMany({
        where: { floorId: f.id },
        orderBy: { name: 'asc' },
      });
      for (const eq of equipmentList) {
        const points = await prisma.point.findMany({
          where: { equipmentId: eq.id },
          orderBy: { pointCode: 'asc' },
        });
        const livePoints = points.map((p) => pointToWorkspaceRow(eq.id, eq.name, p));
        const engStatus =
          eq.status === 'ACTIVE' ? 'MISSING_CONTROLLER' : 'DRAFT';
        allEquipment.push({
          id: eq.id,
          floorId: eq.floorId,
          siteId: eq.siteId,
          buildingId: eq.buildingId,
          name: eq.name,
          displayLabel: eq.name,
          type: eq.equipmentType,
          instanceNumber: eq.instanceNumber ?? null,
          equipmentType: eq.equipmentType,
          locationLabel: '',
          controllerRef: null,
          protocol: 'API',
          templateName: eq.templateName ?? null,
          pointsDefined: points.length,
          status: engStatus,
          notes: '',
          livePoints,
        });
      }
      floorNodes.push({
        id: f.id,
        name: f.name,
        sortOrder: 0,
        floorType: 'Standard Floor',
      });
    }
    siteBuildings.push({
      id: b.id,
      name: b.name,
      buildingType: 'Building',
      buildingCode: '',
      address: b.addressLine1,
      city: b.city,
      state: b.state,
      lat: b.latitude,
      lng: b.longitude,
      status: layoutStatus,
      hasFloors: floorNodes.length > 0,
      floors: floorNodes,
    });
  }

  return {
    version: 'v1',
    lastDeployedAt: new Date().toISOString(),
    deployedBy: 'Seed',
    systemStatus: 'Running',
    site: {
      id: siteRow.id,
      name: siteRow.name,
      siteType: 'Site',
      address: '',
      timezone: '',
      buildings: siteBuildings,
    },
    equipment: allEquipment,
    templates: {
      equipmentTemplates: mergeStarterEquipmentTemplatesIfEmpty([]),
      graphicTemplates: [],
    },
    mappings: {},
    graphics: {},
    siteLayoutGraphics: {},
  };
}

async function main() {
  const starterGlobalRows = getGlobalStarterTemplateSeedRows();
  for (const row of starterGlobalRows) {
    await prisma.globalEquipmentTemplate.upsert({
      where: { id: row.id },
      update: {
        name: row.name,
        equipmentType: row.equipmentType,
        description: row.description,
        defaultGraphicName: row.defaultGraphicName,
        pointsJson: row.pointsJson,
        status: row.status,
      },
      create: {
        id: row.id,
        name: row.name,
        equipmentType: row.equipmentType,
        description: row.description,
        defaultGraphicName: row.defaultGraphicName,
        pointsJson: row.pointsJson,
        status: row.status,
      },
    });
  }

  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: { name: 'super_admin' },
    }),
    prisma.role.upsert({
      where: { name: 'site_admin' },
      update: {},
      create: { name: 'site_admin' },
    }),
    prisma.role.upsert({
      where: { name: 'operator' },
      update: {},
      create: { name: 'operator' },
    }),
    prisma.role.upsert({
      where: { name: 'engineer' },
      update: {},
      create: { name: 'engineer' },
    }),
  ]);

  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));

  const ownerUser = await prisma.user.upsert({
    where: { email: SEED_OWNER_EMAIL },
    update: { name: SEED_OWNER_NAME },
    create: { email: SEED_OWNER_EMAIL, name: SEED_OWNER_NAME },
  });

  const site = await prisma.site.upsert({
    where: { id: DEMO_CAMPUS_SITE_ID },
    update: {
      name: 'Demo Campus',
      status: 'ACTIVE',
      createdByUserId: ownerUser.id,
    },
    create: {
      id: DEMO_CAMPUS_SITE_ID,
      name: 'Demo Campus',
      status: 'ACTIVE',
      createdByUserId: ownerUser.id,
    },
  });

  await prisma.userSiteAccess.upsert({
    where: {
      userId_siteId: { userId: ownerUser.id, siteId: site.id },
    },
    update: { roleId: roleByName.site_admin.id },
    create: {
      userId: ownerUser.id,
      siteId: site.id,
      roleId: roleByName.site_admin.id,
    },
  });

  const buildingA = await prisma.building.upsert({
    where: { siteId_name: { siteId: site.id, name: 'North Tower' } },
    update: {
      addressLine1: '100 Industrial Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      latitude: 30.2672,
      longitude: -97.7431,
      status: 'ACTIVE',
    },
    create: {
      siteId: site.id,
      name: 'North Tower',
      addressLine1: '100 Industrial Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      latitude: 30.2672,
      longitude: -97.7431,
    },
  });

  const buildingB = await prisma.building.upsert({
    where: { siteId_name: { siteId: site.id, name: 'South Annex' } },
    update: {
      addressLine1: '200 Commerce Blvd',
      city: 'Austin',
      state: 'TX',
      postalCode: '78702',
      country: 'US',
      latitude: 30.25,
      longitude: -97.72,
      status: 'ACTIVE',
    },
    create: {
      siteId: site.id,
      name: 'South Annex',
      addressLine1: '200 Commerce Blvd',
      city: 'Austin',
      state: 'TX',
      postalCode: '78702',
      country: 'US',
      latitude: 30.25,
      longitude: -97.72,
    },
  });

  const [a1, a2] = await Promise.all([
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildingA.id, name: 'Level 1' } },
      update: { status: 'ACTIVE' },
      create: { buildingId: buildingA.id, name: 'Level 1' },
    }),
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildingA.id, name: 'Level 2' } },
      update: { status: 'ACTIVE' },
      create: { buildingId: buildingA.id, name: 'Level 2' },
    }),
  ]);

  const floorsB = await Promise.all([
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildingB.id, name: 'Ground' } },
      update: { status: 'ACTIVE' },
      create: { buildingId: buildingB.id, name: 'Ground' },
    }),
    prisma.floor.upsert({
      where: { buildingId_name: { buildingId: buildingB.id, name: 'Roof' } },
      update: { status: 'ACTIVE' },
      create: { buildingId: buildingB.id, name: 'Roof' },
    }),
  ]);
  const b1 = floorsB[0];

  const equip1 = await prisma.equipment.upsert({
    where: { siteId_code: { siteId: site.id, code: 'AHU-01' } },
    update: {
      buildingId: buildingA.id,
      floorId: a1.id,
      name: 'AHU-01',
      equipmentType: 'AHU',
      templateName: 'AHU',
      status: 'ACTIVE',
    },
    create: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a1.id,
      name: 'AHU-01',
      code: 'AHU-01',
      equipmentType: 'AHU',
      templateName: 'AHU',
    },
  });

  const equip2 = await prisma.equipment.upsert({
    where: { siteId_code: { siteId: site.id, code: 'VAV-12' } },
    update: {
      buildingId: buildingA.id,
      floorId: a2.id,
      name: 'VAV-12',
      equipmentType: 'VAV',
      templateName: 'VAV-CLG-ONLY',
      status: 'ACTIVE',
    },
    create: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a2.id,
      name: 'VAV-12',
      code: 'VAV-12',
      equipmentType: 'VAV',
      templateName: 'VAV-CLG-ONLY',
    },
  });

  const equip3 = await prisma.equipment.upsert({
    where: { siteId_code: { siteId: site.id, code: 'CH-01' } },
    update: {
      buildingId: buildingB.id,
      floorId: b1.id,
      name: 'CH-01',
      equipmentType: 'Chiller',
      status: 'ACTIVE',
    },
    create: {
      siteId: site.id,
      buildingId: buildingB.id,
      floorId: b1.id,
      name: 'CH-01',
      code: 'CH-01',
      equipmentType: 'Chiller',
    },
  });

  await prisma.point.upsert({
    where: { equipmentId_pointCode: { equipmentId: equip1.id, pointCode: 'SAT' } },
    update: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a1.id,
      pointName: 'Supply Air Temperature',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '55.2',
      status: 'ACTIVE',
    },
    create: {
      equipmentId: equip1.id,
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a1.id,
      pointName: 'Supply Air Temperature',
      pointCode: 'SAT',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '55.2',
    },
  });

  await prisma.point.upsert({
    where: { equipmentId_pointCode: { equipmentId: equip1.id, pointCode: 'FAN_CMD' } },
    update: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a1.id,
      pointName: 'Supply Fan Speed Command',
      pointType: 'Analog Output',
      unit: '%',
      writable: true,
      presentValue: '65',
      status: 'ACTIVE',
    },
    create: {
      equipmentId: equip1.id,
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a1.id,
      pointName: 'Supply Fan Speed Command',
      pointCode: 'FAN_CMD',
      pointType: 'Analog Output',
      unit: '%',
      writable: true,
      presentValue: '65',
    },
  });

  await prisma.point.upsert({
    where: { equipmentId_pointCode: { equipmentId: equip2.id, pointCode: 'ZT' } },
    update: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a2.id,
      pointName: 'Zone Temperature',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '72.0',
      status: 'ACTIVE',
    },
    create: {
      equipmentId: equip2.id,
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a2.id,
      pointName: 'Zone Temperature',
      pointCode: 'ZT',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '72.0',
    },
  });

  await prisma.point.upsert({
    where: { equipmentId_pointCode: { equipmentId: equip2.id, pointCode: 'CLG_SP' } },
    update: {
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a2.id,
      pointName: 'Cooling Setpoint',
      pointType: 'Analog Value',
      unit: '°F',
      writable: true,
      presentValue: '74',
      status: 'ACTIVE',
    },
    create: {
      equipmentId: equip2.id,
      siteId: site.id,
      buildingId: buildingA.id,
      floorId: a2.id,
      pointName: 'Cooling Setpoint',
      pointCode: 'CLG_SP',
      pointType: 'Analog Value',
      unit: '°F',
      writable: true,
      presentValue: '74',
    },
  });

  await prisma.point.upsert({
    where: { equipmentId_pointCode: { equipmentId: equip3.id, pointCode: 'LWT' } },
    update: {
      siteId: site.id,
      buildingId: buildingB.id,
      floorId: b1.id,
      pointName: 'Leaving Water Temperature',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '44.5',
      status: 'ACTIVE',
    },
    create: {
      equipmentId: equip3.id,
      siteId: site.id,
      buildingId: buildingB.id,
      floorId: b1.id,
      pointName: 'Leaving Water Temperature',
      pointCode: 'LWT',
      pointType: 'Analog Input',
      unit: '°F',
      writable: false,
      presentValue: '44.5',
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      name: 'Demo Admin',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'operator@demo.local' },
    update: {},
    create: {
      email: 'operator@demo.local',
      name: 'Demo Operator',
    },
  });

  await prisma.userSiteAccess.upsert({
    where: {
      userId_siteId: { userId: user1.id, siteId: site.id },
    },
    update: { roleId: roleByName.site_admin.id },
    create: {
      userId: user1.id,
      siteId: site.id,
      roleId: roleByName.site_admin.id,
    },
  });

  await prisma.userSiteAccess.upsert({
    where: {
      userId_siteId: { userId: user2.id, siteId: site.id },
    },
    update: { roleId: roleByName.operator.id },
    create: {
      userId: user2.id,
      siteId: site.id,
      roleId: roleByName.operator.id,
    },
  });

  const deploymentSnapshot = await buildDemoDeploymentSnapshot(site.id);
  const releasedAt = new Date();

  const siteVersion = await prisma.siteVersion.upsert({
    where: { siteId_versionNumber: { siteId: site.id, versionNumber: 1 } },
    update: {
      status: 'RELEASED',
      deployedAt: releasedAt,
      notes: 'Seed demo active release',
    },
    create: {
      siteId: site.id,
      versionNumber: 1,
      status: 'RELEASED',
      deployedAt: releasedAt,
      notes: 'Seed demo active release',
    },
  });

  await prisma.siteVersionPayload.upsert({
    where: { siteVersionId: siteVersion.id },
    update: { payloadJson: deploymentSnapshot },
    create: {
      siteVersionId: siteVersion.id,
      payloadJson: deploymentSnapshot,
    },
  });

  await prisma.site.update({
    where: { id: site.id },
    data: { activeReleaseVersionId: siteVersion.id },
  });

  const usersForLog = await prisma.user.findMany({
    select: { email: true },
    orderBy: { email: 'asc' },
  });

  console.log('Seed complete:', {
    siteId: site.id,
    ownerEmail: SEED_OWNER_EMAIL,
    createdByUserId: ownerUser.id,
    activeReleaseVersionId: siteVersion.id,
    roles: roles.map((r) => r.name).sort(),
    users: usersForLog.map((u) => u.email),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
