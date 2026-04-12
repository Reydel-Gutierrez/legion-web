'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const runtimeService = require('../runtime/runtime.service');

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

  const code = String(controllerCode).trim();
  if (!code) throw new HttpError(400, 'controllerCode is required');

  const equipment = await prisma.equipment.findUnique({
    where: { id: String(equipmentId).trim() },
  });
  if (!equipment) {
    throw new HttpError(404, 'Equipment not found');
  }

  const otherEquipment = await prisma.controllersMapped.findFirst({
    where: {
      siteId: equipment.siteId,
      controllerCode: { equals: code, mode: 'insensitive' },
      NOT: { equipmentId: equipment.id },
    },
  });
  if (otherEquipment) {
    throw new HttpError(409, `controllerCode "${code}" is already assigned to another equipment on this site`);
  }

  const existingForEquipment = await prisma.controllersMapped.findUnique({
    where: { equipmentId: equipment.id },
  });

  if (
    existingForEquipment &&
    String(existingForEquipment.controllerCode).toLowerCase() !== code.toLowerCase()
  ) {
    await prisma.controllersMapped.delete({ where: { id: existingForEquipment.id } });
  }

  const meta = metadata !== undefined ? metadata : undefined;

  const saved = await prisma.controllersMapped.upsert({
    where: { equipmentId: equipment.id },
    create: {
      equipmentId: equipment.id,
      controllerCode: code,
      displayName: displayName != null ? String(displayName).trim() || null : null,
      protocol: String(protocol).trim(),
      deviceInstance: deviceInstance != null ? String(deviceInstance).trim() || null : null,
      ipAddress: ipAddress != null ? String(ipAddress).trim() || null : null,
      networkAddress: networkAddress != null ? String(networkAddress).trim() || null : null,
      siteId: equipment.siteId,
      buildingId: equipment.buildingId,
      floorId: equipment.floorId,
      pollRateMs: pollRateMs != null ? Number(pollRateMs) : 5000,
      isSimulated: Boolean(isSimulated),
      isEnabled: true,
      status: 'ASSIGNED',
      metadataJson: meta === undefined ? undefined : meta,
    },
    update: {
      controllerCode: code,
      displayName: displayName !== undefined ? (displayName != null ? String(displayName).trim() || null : null) : undefined,
      protocol: String(protocol).trim(),
      deviceInstance:
        deviceInstance !== undefined ? (deviceInstance != null ? String(deviceInstance).trim() || null : null) : undefined,
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
      ...(isSimulated !== undefined ? { isSimulated: Boolean(isSimulated) } : {}),
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

  return toDto(saved);
}

async function getByEquipmentId(equipmentId) {
  const row = await prisma.controllersMapped.findUnique({
    where: { equipmentId: String(equipmentId || '').trim() },
  });
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
