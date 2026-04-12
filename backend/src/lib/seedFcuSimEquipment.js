'use strict';

/**
 * Ensures Demo Campus–scoped FCU-1 exists and has the 10 SIM point rows used by the runtime simulator.
 * Idempotent: safe to run on every `prisma db seed`.
 */

const FCU_SIM_CODE = 'FCU-1';

/** Discovery / controller presentation (SIM FCU lab device). */
const FCU_SIM_DEVICE_LABEL = 'LC-CGC';
const FCU_SIM_VENDOR = 'Legion Controls';
const FCU_SIM_BACNET_DEVICE_INSTANCE = '10004';
/** Discovery method label for Network column (matches how this device is surfaced: runtime SIM scan). */
const FCU_SIM_DISCOVERY_NETWORK = 'SIM';
/** MSTP / link address shown as Device Address in Network Discovery. */
const FCU_SIM_DEVICE_ADDRESS = '4';
/** Legion equipment.instanceNumber (site-unique tag). */
const FCU_SIM_EQUIPMENT_INSTANCE_NUMBER = '4';

/** @typedef {{ pointCode: string, pointName: string, pointType: string, unit: string | null, writable: boolean, presentValue: string }} FcuSimPointDef */

/** Defaults aligned with runtime simulator expectations (presentValue stored as string). */
const FCU_SIM_POINT_DEFINITIONS = /** @type {FcuSimPointDef[]} */ ([
  { pointCode: 'SPACE_TEMP', pointName: 'Space Temperature', pointType: 'Analog Input', unit: '°F', writable: false, presentValue: '72' },
  { pointCode: 'DISCHARGE_AIR_TEMP', pointName: 'Discharge Air Temperature', pointType: 'Analog Input', unit: '°F', writable: false, presentValue: '58' },
  { pointCode: 'SPACE_TEMP_SP', pointName: 'Space Temperature Setpoint', pointType: 'Analog Value', unit: '°F', writable: true, presentValue: '72' },
  { pointCode: 'FAN_STATUS', pointName: 'Fan Status', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'UNIT_STATUS', pointName: 'Unit Status', pointType: 'Character String Value', unit: null, writable: false, presentValue: 'IDLE' },
  { pointCode: 'OCCUPIED', pointName: 'Occupied', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'true' },
  { pointCode: 'COOL_CALL', pointName: 'Cooling Call', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'HEAT_CALL', pointName: 'Heating Call', pointType: 'Binary Value', unit: null, writable: false, presentValue: 'false' },
  { pointCode: 'VALVE_CMD', pointName: 'Valve Command', pointType: 'Analog Output', unit: '%', writable: true, presentValue: '0' },
  { pointCode: 'FAN_CMD', pointName: 'Fan Command', pointType: 'Binary Value', unit: null, writable: true, presentValue: 'false' },
  { pointCode: 'ALARM_STATUS', pointName: 'Alarm Status', pointType: 'Character String Value', unit: null, writable: false, presentValue: 'false' },
]);

/**
 * Find FCU-1 on this site: match `code` first, then `name` (case-insensitive).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} siteId
 */
async function findFcuEquipmentForSite(prisma, siteId) {
  let eq = await prisma.equipment.findFirst({
    where: {
      siteId,
      code: { equals: FCU_SIM_CODE, mode: 'insensitive' },
    },
  });
  if (!eq) {
    eq = await prisma.equipment.findFirst({
      where: {
        siteId,
        name: { equals: FCU_SIM_CODE, mode: 'insensitive' },
      },
    });
  }
  return eq;
}

/**
 * Create default FCU-1 on the given floor when none exists on the site.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ siteId: string, buildingId: string, floorId: string }} ctx
 */
async function createDefaultFcuEquipment(prisma, ctx) {
  return prisma.equipment.create({
    data: {
      siteId: ctx.siteId,
      buildingId: ctx.buildingId,
      floorId: ctx.floorId,
      name: FCU_SIM_DEVICE_LABEL,
      code: FCU_SIM_CODE,
      equipmentType: 'FCU',
      templateName: 'FCU',
      instanceNumber: FCU_SIM_EQUIPMENT_INSTANCE_NUMBER,
      status: 'ACTIVE',
    },
  });
}

/**
 * Upsert all SIM points on the equipment row. Counts rows that existed before upsert vs newly created.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('@prisma/client').Equipment} equipment
 */
async function upsertFcuSimPoints(prisma, equipment) {
  let pointsCreated = 0;
  let pointsAlreadyPresent = 0;

  for (const def of FCU_SIM_POINT_DEFINITIONS) {
    const whereUnique = {
      equipmentId_pointCode: { equipmentId: equipment.id, pointCode: def.pointCode },
    };
    const before = await prisma.point.findUnique({ where: whereUnique });

    await prisma.point.upsert({
      where: whereUnique,
      update: {
        siteId: equipment.siteId,
        buildingId: equipment.buildingId,
        floorId: equipment.floorId,
        pointName: def.pointName,
        pointType: def.pointType,
        unit: def.unit,
        writable: def.writable,
        presentValue: def.presentValue,
        status: 'ACTIVE',
      },
      create: {
        equipmentId: equipment.id,
        siteId: equipment.siteId,
        buildingId: equipment.buildingId,
        floorId: equipment.floorId,
        pointName: def.pointName,
        pointCode: def.pointCode,
        pointType: def.pointType,
        unit: def.unit,
        writable: def.writable,
        presentValue: def.presentValue,
      },
    });

    if (before) {
      pointsAlreadyPresent += 1;
    } else {
      pointsCreated += 1;
    }
  }

  return {
    pointsCreated,
    pointsAlreadyPresent,
    totalDefinitions: FCU_SIM_POINT_DEFINITIONS.length,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ siteId: string, defaultBuildingId: string, defaultFloorId: string }} options
 * @returns {Promise<{
 *   equipment: import('@prisma/client').Equipment,
 *   equipmentCreated: boolean,
 *   pointsCreated: number,
 *   pointsAlreadyPresent: number,
 *   totalPointDefinitions: number
 * }>}
 */
async function ensureFcuSimEquipmentAndPoints(prisma, options) {
  const { siteId, defaultBuildingId, defaultFloorId } = options;

  let equipment = await findFcuEquipmentForSite(prisma, siteId);
  let equipmentCreated = false;

  if (!equipment) {
    equipment = await createDefaultFcuEquipment(prisma, {
      siteId,
      buildingId: defaultBuildingId,
      floorId: defaultFloorId,
    });
    equipmentCreated = true;
    // eslint-disable-next-line no-console
    console.log(`[seed] FCU-1 sim: created new equipment id=${equipment.id} code=${equipment.code} name=${equipment.name}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[seed] FCU-1 sim: reused existing equipment id=${equipment.id} code=${equipment.code} name=${equipment.name}`
    );
  }

  const pointStats = await upsertFcuSimPoints(prisma, equipment);

  // eslint-disable-next-line no-console
  console.log('[seed] FCU-1 sim points:', {
    created: pointStats.pointsCreated,
    alreadyExisted: pointStats.pointsAlreadyPresent,
    total: pointStats.totalDefinitions,
  });

  return {
    equipment,
    equipmentCreated,
    pointsCreated: pointStats.pointsCreated,
    pointsAlreadyPresent: pointStats.pointsAlreadyPresent,
    totalPointDefinitions: pointStats.totalDefinitions,
  };
}

function inferFieldDataTypeForSeed(def) {
  const t = String(def.pointType || '').toLowerCase();
  if (t.includes('binary')) return 'boolean';
  if (t.includes('analog') || t.includes('integer')) return 'number';
  return 'string';
}

/**
 * Phase 2 demo: persist ControllersMapped + PointsMapped for FCU-1 per site.
 * Idempotent; `controllerCode` is unique per site (not globally).
 */
async function ensureFcuPhase2Bindings(prisma, equipment) {
  let ec = await prisma.controllersMapped.findUnique({
    where: { equipmentId: equipment.id },
  });

  if (!ec) {
    ec = await prisma.controllersMapped.create({
      data: {
        equipmentId: equipment.id,
        controllerCode: FCU_SIM_CODE,
        displayName: FCU_SIM_DEVICE_LABEL,
        protocol: 'SIM',
        deviceInstance: FCU_SIM_BACNET_DEVICE_INSTANCE,
        networkAddress: FCU_SIM_DEVICE_ADDRESS,
        siteId: equipment.siteId,
        buildingId: equipment.buildingId,
        floorId: equipment.floorId,
        pollRateMs: 20000,
        isSimulated: true,
        isEnabled: true,
        status: 'ASSIGNED',
        metadataJson: { vendor: FCU_SIM_VENDOR },
      },
    });
    // eslint-disable-next-line no-console
    console.log('[seed] Phase 2: created ControllersMapped for FCU-1', ec.id);
  }

  const points = await prisma.point.findMany({
    where: { equipmentId: equipment.id },
  });
  let mappingsCreated = 0;

  for (const def of FCU_SIM_POINT_DEFINITIONS) {
    const pt = points.find((p) => p.pointCode === def.pointCode);
    if (!pt) continue;

    const existing = await prisma.pointsMapped.findFirst({
      where: {
        equipmentControllerId: ec.id,
        fieldPointKey: def.pointCode,
      },
    });
    if (existing) continue;

    await prisma.pointsMapped.create({
      data: {
        equipmentControllerId: ec.id,
        equipmentId: equipment.id,
        pointId: pt.id,
        legionPointCode: pt.pointCode,
        fieldPointKey: def.pointCode,
        fieldPointName: def.pointName,
        fieldObjectType: def.pointType,
        fieldObjectInstance: def.pointCode,
        fieldDataType: inferFieldDataTypeForSeed(def),
        readEnabled: true,
        writeEnabled: Boolean(def.writable),
        isBound: true,
      },
    });
    mappingsCreated += 1;
  }

  if (mappingsCreated > 0) {
    // eslint-disable-next-line no-console
    console.log('[seed] Phase 2: created PointsMapped row(s)', mappingsCreated);
  }

  return { equipmentController: ec, mappingsCreated, skipped: null };
}

module.exports = {
  FCU_SIM_CODE,
  FCU_SIM_DEVICE_LABEL,
  FCU_SIM_VENDOR,
  FCU_SIM_BACNET_DEVICE_INSTANCE,
  FCU_SIM_DISCOVERY_NETWORK,
  FCU_SIM_DEVICE_ADDRESS,
  FCU_SIM_EQUIPMENT_INSTANCE_NUMBER,
  FCU_SIM_POINT_DEFINITIONS,
  findFcuEquipmentForSite,
  createDefaultFcuEquipment,
  upsertFcuSimPoints,
  ensureFcuSimEquipmentAndPoints,
  ensureFcuPhase2Bindings,
};
