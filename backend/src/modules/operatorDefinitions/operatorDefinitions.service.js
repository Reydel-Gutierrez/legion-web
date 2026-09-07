const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

async function siteOr404(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new HttpError(404, 'Site not found');
}

function model(kind) {
  if (kind === 'trend') return { definition: prisma.trendDefinition, assignment: prisma.trendAssignment };
  if (kind === 'schedule') return { definition: prisma.scheduleDefinition, assignment: prisma.scheduleAssignment };
  throw new HttpError(400, 'Unknown definition kind');
}

function validate(kind, body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Definition must be an object');
  if ((!partial || body.name !== undefined) && (typeof body.name !== 'string' || !body.name.trim())) throw new HttpError(400, 'name is required');
  for (const key of ['enabled', 'isTemplate']) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new HttpError(400, `${key} must be a boolean`);
  }
  if (kind === 'trend') {
    if (body.sampleInterval != null && (!Number.isInteger(body.sampleInterval) || body.sampleInterval <= 0)) throw new HttpError(400, 'sampleInterval must be a positive integer');
    if (body.pointRequirements !== undefined && (!Array.isArray(body.pointRequirements) || body.pointRequirements.some((point) => !point || typeof point.pointKey !== 'string' || !point.pointKey.trim()))) throw new HttpError(400, 'pointRequirements must contain logical point keys');
  } else if (body.weeklyWindows !== undefined) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!Array.isArray(body.weeklyWindows) || body.weeklyWindows.some((window) => !window || !Array.isArray(window.days) || !window.days.length || window.days.some((day) => !days.includes(day)) || !time.test(window.startTime) || !time.test(window.endTime) || !['Occupied', 'Unoccupied'].includes(window.action))) throw new HttpError(400, 'weeklyWindows must contain valid days, times and occupancy actions');
  }
}

async function list(siteId, kind, query = {}) {
  await siteOr404(siteId); const m = model(kind);
  return m.definition.findMany({ where: { siteId, ...(query.templates === 'true' ? { isTemplate: true } : {}), ...(query.templates === 'false' ? { isTemplate: false } : {}) }, include: { assignments: true }, orderBy: { updatedAt: 'desc' } });
}

async function create(siteId, kind, body) {
  validate(kind, body);
  await siteOr404(siteId); const m = model(kind);
  const data = kind === 'trend'
    ? { siteId, name: String(body.name || '').trim(), enabled: body.enabled !== false, isTemplate: Boolean(body.isTemplate), equipmentType: body.equipmentType || null, sampleInterval: body.sampleInterval == null ? null : Number(body.sampleInterval), pointRequirements: body.pointRequirements || [] }
    : { siteId, name: String(body.name || '').trim(), enabled: body.enabled !== false, isTemplate: Boolean(body.isTemplate), weeklyWindows: body.weeklyWindows || [] };
  if (!data.name) throw new HttpError(400, 'name is required');
  if (body.equipmentIds !== undefined) {
    if (!Array.isArray(body.equipmentIds) || !body.equipmentIds.length) throw new HttpError(400, 'equipmentIds must be a nonempty array');
    const ids = [...new Set(body.equipmentIds.map(String))];
    const equipment = await prisma.equipment.findMany({ where: { siteId, id: { in: ids } }, select: { id: true } });
    if (equipment.length !== ids.length) throw new HttpError(400, 'Every assignment must reference equipment in this site');
    data.assignments = { create: ids.map((equipmentId) => ({ siteId, equipmentId, ...(kind === 'trend' ? { resolvedMappings: body.resolvedMappings?.[equipmentId] || {} } : {}) })) };
  }
  return m.definition.create({ data, include: { assignments: true } });
}

async function update(siteId, kind, id, body) {
  validate(kind, body, true);
  const m = model(kind); const existing = await m.definition.findFirst({ where: { id, siteId } });
  if (!existing) throw new HttpError(404, 'Definition not found');
  const data = { ...(body.name !== undefined ? { name: String(body.name).trim() } : {}), ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}), ...(kind === 'trend' ? { ...(body.pointRequirements !== undefined ? { pointRequirements: body.pointRequirements } : {}), ...(body.sampleInterval !== undefined ? { sampleInterval: body.sampleInterval == null ? null : Number(body.sampleInterval) } : {}) } : { ...(body.weeklyWindows !== undefined ? { weeklyWindows: body.weeklyWindows } : {}) }), version: { increment: 1 } };
  if (body.isTemplate !== undefined) data.isTemplate = body.isTemplate;
  if (kind === 'trend' && body.equipmentType !== undefined) data.equipmentType = body.equipmentType || null;
  return m.definition.update({ where: { id }, data, include: { assignments: true } });
}

async function remove(siteId, kind, id) { const m = model(kind); const existing = await m.definition.findFirst({ where: { id, siteId } }); if (!existing) throw new HttpError(404, 'Definition not found'); await m.definition.delete({ where: { id } }); return { ok: true }; }

async function assign(siteId, kind, id, body) {
  if (!body || (body.equipmentIds !== undefined && !Array.isArray(body.equipmentIds))) throw new HttpError(400, 'equipmentIds must be an array');
  const m = model(kind); const definition = await m.definition.findFirst({ where: { id, siteId } }); if (!definition) throw new HttpError(404, 'Definition not found');
  const equipmentIds = [...new Set((body.equipmentIds || (body.equipmentId ? [body.equipmentId] : [])).map(String))];
  if (!equipmentIds.length) throw new HttpError(400, 'equipmentIds are required');
  const equipment = await prisma.equipment.findMany({ where: { id: { in: equipmentIds }, siteId }, select: { id: true } });
  if (equipment.length !== equipmentIds.length) throw new HttpError(400, 'Every assignment must reference equipment in this site');
  const operations = [];
  for (const equipmentId of equipmentIds) {
    const data = { enabled: body.enabled !== false, ...(kind === 'trend' ? { resolvedMappings: body.resolvedMappings?.[equipmentId] || {} } : {}) };
    operations.push(m.assignment.upsert({ where: { definitionId_equipmentId: { definitionId: id, equipmentId } }, create: { definitionId: id, siteId, equipmentId, ...data }, update: data }));
  }
  return prisma.$transaction(operations);
}

async function unassign(siteId, kind, id, equipmentId) { const m = model(kind); await m.assignment.deleteMany({ where: { definitionId: id, siteId, equipmentId } }); return { ok: true }; }

module.exports = { list, create, update, remove, assign, unassign };
