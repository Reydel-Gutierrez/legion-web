'use strict';

const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

function toDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    equipmentControllerId: row.equipmentControllerId,
    equipmentId: row.equipmentId,
    pointId: row.pointId,
    legionPointCode: row.legionPointCode,
    fieldPointKey: row.fieldPointKey,
    fieldPointName: row.fieldPointName,
    fieldObjectType: row.fieldObjectType,
    fieldObjectInstance: row.fieldObjectInstance,
    fieldDataType: row.fieldDataType,
    readEnabled: row.readEnabled,
    writeEnabled: row.writeEnabled,
    isBound: row.isBound,
    metadata: row.metadataJson ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function bind(body) {
  const {
    equipmentControllerId,
    equipmentId,
    pointId,
    fieldPointKey,
    fieldPointName,
    fieldObjectType,
    fieldObjectInstance,
    fieldDataType,
    readEnabled,
    writeEnabled,
    metadata,
  } = body || {};

  if (!equipmentControllerId || !equipmentId || !pointId || !fieldPointKey) {
    throw new HttpError(400, 'equipmentControllerId, equipmentId, pointId, and fieldPointKey are required');
  }

  const ecId = String(equipmentControllerId).trim();
  const eqId = String(equipmentId).trim();
  const ptId = String(pointId).trim();
  const fKey = String(fieldPointKey).trim();
  if (!fKey) throw new HttpError(400, 'fieldPointKey is required');

  const ctrl = await prisma.controllersMapped.findUnique({ where: { id: ecId } });
  if (!ctrl) {
    throw new HttpError(404, 'ControllersMapped row not found');
  }
  if (String(ctrl.equipmentId) !== eqId) {
    throw new HttpError(400, 'equipmentId does not match this controller assignment');
  }

  const point = await prisma.point.findUnique({ where: { id: ptId } });
  if (!point) {
    throw new HttpError(404, 'Point not found');
  }
  if (String(point.equipmentId) !== eqId) {
    throw new HttpError(400, 'Point does not belong to the specified equipment');
  }

  const meta = metadata !== undefined ? metadata : undefined;
  const legionCode = point.pointCode != null ? String(point.pointCode).trim() : null;

  const saved = await prisma.$transaction(async (tx) => {
    await tx.pointsMapped.deleteMany({
      where: {
        equipmentControllerId: ecId,
        OR: [{ fieldPointKey: fKey }, { pointId: ptId }],
      },
    });
    return tx.pointsMapped.create({
      data: {
        equipmentControllerId: ecId,
        equipmentId: eqId,
        pointId: ptId,
        legionPointCode: legionCode,
        fieldPointKey: fKey,
        fieldPointName: fieldPointName != null ? String(fieldPointName).trim() || null : null,
        fieldObjectType: fieldObjectType != null ? String(fieldObjectType).trim() || null : null,
        fieldObjectInstance: fieldObjectInstance != null ? String(fieldObjectInstance).trim() || null : null,
        fieldDataType: fieldDataType != null ? String(fieldDataType).trim() || null : null,
        readEnabled: readEnabled !== undefined ? Boolean(readEnabled) : true,
        writeEnabled: writeEnabled !== undefined ? Boolean(writeEnabled) : false,
        isBound: true,
        ...(meta !== undefined ? { metadataJson: meta } : {}),
      },
    });
  });

  // eslint-disable-next-line no-console
  console.log('[point-mappings] bound', {
    id: saved.id,
    equipmentControllerId: saved.equipmentControllerId,
    fieldPointKey: saved.fieldPointKey,
    pointId: saved.pointId,
  });

  return toDto(saved);
}

async function listByController(equipmentControllerId) {
  const rows = await prisma.pointsMapped.findMany({
    where: { equipmentControllerId: String(equipmentControllerId || '').trim() },
    orderBy: { fieldPointKey: 'asc' },
  });
  return rows.map(toDto);
}

/**
 * @param {string} equipmentId
 * @param {{ skipSelfHeal?: boolean }} [options] - when true, do not run simCatalogBindingSync (caller already did)
 */
async function listByEquipment(equipmentId, options = {}) {
  const eid = String(equipmentId || '').trim();
  const skipSelfHeal = options.skipSelfHeal === true;
  let rows = await prisma.pointsMapped.findMany({
    where: { equipmentId: eid },
    orderBy: { fieldPointKey: 'asc' },
  });
  if (rows.length === 0 && !skipSelfHeal) {
    const { syncSimCatalogBindingsForEquipmentId } = require('../../lib/simCatalogBindingSync');
    const synced = await syncSimCatalogBindingsForEquipmentId(eid).catch(() => null);
    if (synced?.ok) {
      rows = await prisma.pointsMapped.findMany({
        where: { equipmentId: eid },
        orderBy: { fieldPointKey: 'asc' },
      });
    }
  }
  return rows.map(toDto);
}

async function update(id, body) {
  const existing = await prisma.pointsMapped.findUnique({
    where: { id: String(id || '').trim() },
  });
  if (!existing) throw new HttpError(404, 'PointsMapped row not found');

  const data = {};
  if (body.fieldPointName !== undefined) {
    data.fieldPointName = body.fieldPointName != null ? String(body.fieldPointName).trim() || null : null;
  }
  if (body.fieldObjectType !== undefined) {
    data.fieldObjectType = body.fieldObjectType != null ? String(body.fieldObjectType).trim() || null : null;
  }
  if (body.fieldObjectInstance !== undefined) {
    data.fieldObjectInstance = body.fieldObjectInstance != null ? String(body.fieldObjectInstance).trim() || null : null;
  }
  if (body.fieldDataType !== undefined) {
    data.fieldDataType = body.fieldDataType != null ? String(body.fieldDataType).trim() || null : null;
  }
  if (body.readEnabled !== undefined) data.readEnabled = Boolean(body.readEnabled);
  if (body.writeEnabled !== undefined) data.writeEnabled = Boolean(body.writeEnabled);
  if (body.isBound !== undefined) data.isBound = Boolean(body.isBound);
  if (body.metadata !== undefined) data.metadataJson = body.metadata;

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'No fields to update');
  }

  const saved = await prisma.pointsMapped.update({
    where: { id: existing.id },
    data,
  });
  return toDto(saved);
}

async function remove(id) {
  const existing = await prisma.pointsMapped.findUnique({
    where: { id: String(id || '').trim() },
  });
  if (!existing) throw new HttpError(404, 'PointsMapped row not found');

  await prisma.pointsMapped.delete({ where: { id: existing.id } });
  return { ok: true };
}

module.exports = {
  bind,
  listByController,
  listByEquipment,
  update,
  remove,
  toDto,
};
