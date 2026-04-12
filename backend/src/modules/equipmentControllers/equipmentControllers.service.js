'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const runtimeService = require('../runtime/runtime.service');
const { syncSimCatalogBindingsForEquipmentId } = require('../../lib/simCatalogBindingSync');
const {
  getCatalogEntryByControllerCode,
  getCatalogEntryByDeviceInstance,
  isNumericOnlyString,
  simCatalogRepairPatchForNumericControllerCode,
} = require('../../lib/simulatedControllers/catalog');

const DEV_ASSIGN_SIM = process.env.NODE_ENV === 'development';

/**
 * Normalize SIM assign payload: catalog `controllerCode` (FCU-2) is canonical; discovery may send instance only.
 * @param {string} bodyControllerCode
 * @param {string|null|undefined} bodyDeviceInstance
 */
function resolveSimAssignIdentity(bodyControllerCode, bodyDeviceInstance) {
  const rawCode = String(bodyControllerCode || '').trim();
  const di =
    bodyDeviceInstance != null && String(bodyDeviceInstance).trim() !== ''
      ? String(bodyDeviceInstance).trim()
      : null;

  const byCode = getCatalogEntryByControllerCode(rawCode);
  if (byCode) {
    return {
      controllerCode: byCode.controllerCode,
      deviceInstance: di ?? String(byCode.deviceInstance),
    };
  }

  const instCandidate = di || (isNumericOnlyString(rawCode) ? rawCode : null);
  if (instCandidate) {
    const byInst = getCatalogEntryByDeviceInstance(instCandidate);
    if (byInst) {
      return {
        controllerCode: byInst.controllerCode,
        deviceInstance: String(byInst.deviceInstance),
      };
    }
  }

  return { controllerCode: rawCode, deviceInstance: di };
}

function toDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    controllerCode: row.controllerCode,
    displayName: row.displayName,
    protocol: row.protocol,
    deviceInstance: row.deviceInstance,
    ipAddress: row.ipAddress,
    networkAddress: row.networkAddress,
    siteId: row.siteId,
    buildingId: row.buildingId,
    floorId: row.floorId,
    pollRateMs: row.pollRateMs,
    isSimulated: row.isSimulated,
    isEnabled: row.isEnabled,
    status: row.status,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    metadata: row.metadataJson ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * DELETE /api/equipment-controllers/:id removes the assignment row only.
 * PointsMapped rows cascade-delete with the controller assignment (Prisma onDelete: Cascade).
 * Legion Point rows are never deleted by this module.
 */
async function assign(body) {
  const {
    equipmentId,
    controllerCode,
    displayName,
    protocol,
    deviceInstance,
    ipAddress,
    networkAddress,
    pollRateMs,
    isSimulated,
    metadata,
  } = body || {};

  if (!equipmentId || !controllerCode || !protocol) {
    throw new HttpError(400, 'equipmentId, controllerCode, and protocol are required');
  }

  const protocolNorm = String(protocol).trim();
  /** Omitted isSimulated + SIM protocol → true (matches runtime + catalog sync expectations). */
  const resolvedIsSimulated =
    isSimulated !== undefined ? Boolean(isSimulated) : protocolNorm.toUpperCase() === 'SIM';

  const rawControllerCode = String(controllerCode).trim();
  if (!rawControllerCode) throw new HttpError(400, 'controllerCode is required');

  const inputDeviceInstanceForLog =
    deviceInstance != null && String(deviceInstance).trim() !== '' ? String(deviceInstance).trim() : null;

  let finalCode = rawControllerCode;
  let finalDeviceInstance =
    deviceInstance != null && String(deviceInstance).trim() !== ''
      ? String(deviceInstance).trim()
      : null;

  if (protocolNorm.toUpperCase() === 'SIM') {
    const resolved = resolveSimAssignIdentity(rawControllerCode, deviceInstance);
    finalCode = resolved.controllerCode;
    finalDeviceInstance = resolved.deviceInstance;

    if (DEV_ASSIGN_SIM) {
      // eslint-disable-next-line no-console
      console.log('[DEV assign SIM controller]', {
        inputDeviceInstance: inputDeviceInstanceForLog,
        inputControllerCode: rawControllerCode,
        resolvedControllerCode: resolved.controllerCode,
        finalStoredControllerCode: finalCode,
        finalStoredDeviceInstance: finalDeviceInstance,
      });
    }
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: String(equipmentId).trim() },
  });
  if (!equipment) {
    throw new HttpError(404, 'Equipment not found');
  }

  const otherEquipment = await prisma.controllersMapped.findFirst({
    where: {
      siteId: equipment.siteId,
      controllerCode: { equals: finalCode, mode: 'insensitive' },
      NOT: { equipmentId: equipment.id },
    },
  });
  if (otherEquipment) {
    throw new HttpError(409, `controllerCode "${finalCode}" is already assigned to another equipment on this site`);
  }

  const existingForEquipment = await prisma.controllersMapped.findUnique({
    where: { equipmentId: equipment.id },
  });

  if (
    existingForEquipment &&
    String(existingForEquipment.controllerCode).toLowerCase() !== finalCode.toLowerCase()
  ) {
    await prisma.controllersMapped.delete({ where: { id: existingForEquipment.id } });
  }

  const meta = metadata !== undefined ? metadata : undefined;

  const saved = await prisma.controllersMapped.upsert({
    where: { equipmentId: equipment.id },
    create: {
      equipmentId: equipment.id,
      controllerCode: finalCode,
      displayName: displayName != null ? String(displayName).trim() || null : null,
      protocol: protocolNorm,
      deviceInstance: finalDeviceInstance,
      ipAddress: ipAddress != null ? String(ipAddress).trim() || null : null,
      networkAddress: networkAddress != null ? String(networkAddress).trim() || null : null,
      siteId: equipment.siteId,
      buildingId: equipment.buildingId,
      floorId: equipment.floorId,
      pollRateMs: pollRateMs != null ? Number(pollRateMs) : 5000,
      isSimulated: resolvedIsSimulated,
      isEnabled: true,
      status: 'ASSIGNED',
      metadataJson: meta === undefined ? undefined : meta,
    },
    update: {
      controllerCode: finalCode,
      displayName: displayName !== undefined ? (displayName != null ? String(displayName).trim() || null : null) : undefined,
      protocol: protocolNorm,
      deviceInstance:
        protocolNorm.toUpperCase() === 'SIM'
          ? finalDeviceInstance
          : deviceInstance !== undefined
            ? deviceInstance != null
              ? String(deviceInstance).trim() || null
              : null
            : undefined,
      ipAddress: ipAddress !== undefined ? (ipAddress != null ? String(ipAddress).trim() || null : null) : undefined,
      networkAddress:
        networkAddress !== undefined
          ? networkAddress != null
            ? String(networkAddress).trim() || null
            : null
          : undefined,
      siteId: equipment.siteId,
      buildingId: equipment.buildingId,
      floorId: equipment.floorId,
      ...(pollRateMs !== undefined ? { pollRateMs: pollRateMs != null ? Number(pollRateMs) : 5000 } : {}),
      ...(isSimulated !== undefined
        ? { isSimulated: Boolean(isSimulated) }
        : protocolNorm.toUpperCase() === 'SIM'
          ? { isSimulated: true }
          : {}),
      status: 'ASSIGNED',
      ...(meta !== undefined ? { metadataJson: meta } : {}),
    },
  });

  // eslint-disable-next-line no-console
  console.log('[equipment-controllers] assigned', {
    id: saved.id,
    equipmentId: saved.equipmentId,
    controllerCode: saved.controllerCode,
    protocol: saved.protocol,
  });

  try {
    await runtimeService.refreshInMemoryBindingForEquipmentId(saved.equipmentId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[equipment-controllers] runtime store sync skipped:', e?.message || e);
  }

  try {
    await syncSimCatalogBindingsForEquipmentId(saved.equipmentId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[equipment-controllers] SIM catalog binding sync skipped:', e?.message || e);
  }

  return toDto(saved);
}

async function getByEquipmentId(equipmentId) {
  const eid = String(equipmentId || '').trim();
  let row = await prisma.controllersMapped.findUnique({
    where: { equipmentId: eid },
  });
  if (!row) return null;
  const patch = simCatalogRepairPatchForNumericControllerCode(row);
  if (patch) {
    row = await prisma.controllersMapped.update({
      where: { id: row.id },
      data: patch,
    });
    try {
      await runtimeService.refreshInMemoryBindingForEquipmentId(row.equipmentId);
    } catch (_) {
      /* ignore */
    }
  }
  return toDto(row);
}

async function list() {
  const rows = await prisma.controllersMapped.findMany({
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(toDto);
}

async function update(id, body) {
  const existing = await prisma.controllersMapped.findUnique({
    where: { id: String(id || '').trim() },
  });
  if (!existing) throw new HttpError(404, 'ControllersMapped row not found');

  const allowed = [
    'displayName',
    'pollRateMs',
    'isEnabled',
    'status',
    'metadata',
    'deviceInstance',
    'ipAddress',
    'networkAddress',
    'lastSeenAt',
  ];
  const data = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (key === 'metadata') {
      data.metadataJson = body.metadata;
    } else if (key === 'lastSeenAt') {
      const v = body.lastSeenAt;
      data.lastSeenAt = v == null || v === '' ? null : new Date(v);
    } else if (key === 'isEnabled') {
      data.isEnabled = Boolean(body.isEnabled);
    } else if (key === 'pollRateMs') {
      data.pollRateMs = body.pollRateMs != null ? Number(body.pollRateMs) : null;
    } else if (key === 'displayName') {
      data.displayName = body.displayName != null ? String(body.displayName).trim() || null : null;
    } else if (key === 'status') {
      data.status = body.status != null ? String(body.status).trim() || null : null;
    } else if (key === 'deviceInstance') {
      data.deviceInstance = body.deviceInstance != null ? String(body.deviceInstance).trim() || null : null;
    } else if (key === 'ipAddress') {
      data.ipAddress = body.ipAddress != null ? String(body.ipAddress).trim() || null : null;
    } else if (key === 'networkAddress') {
      data.networkAddress = body.networkAddress != null ? String(body.networkAddress).trim() || null : null;
    }
  }
  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }

  const saved = await prisma.controllersMapped.update({
    where: { id: existing.id },
    data,
  });
  return toDto(saved);
}

async function remove(id) {
  const existing = await prisma.controllersMapped.findUnique({
    where: { id: String(id || '').trim() },
  });
  if (!existing) throw new HttpError(404, 'ControllersMapped row not found');

  const eqId = existing.equipmentId;

  await prisma.controllersMapped.delete({ where: { id: existing.id } });

  // eslint-disable-next-line no-console
  console.log('[equipment-controllers] unassigned (row deleted; point mappings cascaded)', {
    id: existing.id,
    equipmentId: existing.equipmentId,
    controllerCode: existing.controllerCode,
  });

  try {
    await runtimeService.refreshInMemoryBindingForEquipmentId(eqId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[equipment-controllers] runtime store sync after delete skipped:', e?.message || e);
  }

  return { ok: true };
}

async function findByControllerCode(controllerCode) {
  const code = String(controllerCode || '').trim();
  if (!code) return null;
  return prisma.controllersMapped.findFirst({
    where: { controllerCode: { equals: code, mode: 'insensitive' }, isEnabled: true },
  });
}

module.exports = {
  assign,
  getByEquipmentId,
  list,
  update,
  remove,
  toDto,
  findByControllerCode,
};
