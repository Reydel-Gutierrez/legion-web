const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const { getGlobalStarterTemplateSeedRows } = require('../../lib/legionStarterEquipmentTemplates');

/** Serialize concurrent first-load seeding (Import modal fetches equipment + graphic lists in parallel). */
let ensureEquipmentStartersInFlight = null;

/** One-time style cleanup: legacy rows were named "Legion AHU", etc. */
async function stripLegacyLegionPrefixFromGlobalEquipmentNames() {
  await prisma.$executeRaw`
    UPDATE "GlobalEquipmentTemplate"
    SET name = TRIM(BOTH ' ' FROM REPLACE(name, 'Legion ', ''))
    WHERE name LIKE 'Legion %'
  `;
}

/**
 * If GlobalEquipmentTemplate has no rows, upsert starter templates (same data as prisma seed).
 * Avoids empty library when db seed was never run.
 */
async function ensureGlobalEquipmentStartersInDb() {
  if (ensureEquipmentStartersInFlight) {
    return ensureEquipmentStartersInFlight;
  }
  ensureEquipmentStartersInFlight = (async () => {
    try {
      const count = await prisma.globalEquipmentTemplate.count();
      if (count > 0) return;
      const rows = getGlobalStarterTemplateSeedRows();
      for (const r of rows) {
        await prisma.globalEquipmentTemplate.upsert({
          where: { id: r.id },
          update: {
            name: r.name,
            equipmentType: r.equipmentType,
            description: r.description,
            defaultGraphicName: r.defaultGraphicName,
            pointsJson: r.pointsJson,
            status: r.status,
          },
          create: {
            id: r.id,
            name: r.name,
            equipmentType: r.equipmentType,
            description: r.description,
            defaultGraphicName: r.defaultGraphicName,
            pointsJson: r.pointsJson,
            status: r.status,
          },
        });
      }
    } finally {
      ensureEquipmentStartersInFlight = null;
    }
  })();
  return ensureEquipmentStartersInFlight;
}

function normalizePointsJson(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function countBindingsFromGraphicState(state) {
  if (!state || typeof state !== 'object') return 0;
  const objects = state.objects;
  if (!Array.isArray(objects)) return 0;
  return objects.filter((o) => o && o.pointBinding && String(o.pointBinding).trim()).length;
}

function equipmentListRowFromRecord(r) {
  const points = normalizePointsJson(r.pointsJson);
  return {
    id: r.id,
    name: r.name,
    equipmentType: r.equipmentType,
    pointCount: points.length,
    defaultGraphicName: r.defaultGraphicName ?? null,
  };
}

async function listEquipmentTemplates() {
  await stripLegacyLegionPrefixFromGlobalEquipmentNames();
  await ensureGlobalEquipmentStartersInDb();
  const rows = await prisma.globalEquipmentTemplate.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ name: 'asc' }],
  });
  return rows.map((r) => equipmentListRowFromRecord(r));
}

async function updateEquipmentTemplateName(id, body) {
  const name = String(body?.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  let r;
  try {
    r = await prisma.globalEquipmentTemplate.update({
      where: { id },
      data: { name },
    });
  } catch (e) {
    if (e.code === 'P2025') throw new HttpError(404, 'Global equipment template not found');
    throw e;
  }
  return equipmentListRowFromRecord(r);
}

async function deleteEquipmentTemplate(id) {
  try {
    await prisma.globalEquipmentTemplate.delete({ where: { id } });
  } catch (e) {
    if (e.code === 'P2025') throw new HttpError(404, 'Global equipment template not found');
    throw e;
  }
}

async function getEquipmentTemplateById(id) {
  await stripLegacyLegionPrefixFromGlobalEquipmentNames();
  await ensureGlobalEquipmentStartersInDb();
  const r = await prisma.globalEquipmentTemplate.findFirst({
    where: { id, status: 'ACTIVE' },
  });
  if (!r) throw new HttpError(404, 'Global equipment template not found');
  const points = normalizePointsJson(r.pointsJson);
  return {
    id: r.id,
    name: r.name,
    equipmentType: r.equipmentType,
    description: r.description ?? '',
    defaultGraphicName: r.defaultGraphicName ?? null,
    pointCount: points.length,
    points,
  };
}

async function createEquipmentTemplateFromSitePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Invalid body');
  }
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  const equipmentType = String(body.equipmentType || 'CUSTOM').trim() || 'CUSTOM';
  const description = String(body.description ?? '').trim();
  const defaultGraphicName =
    body.defaultGraphicName != null && String(body.defaultGraphicName).trim()
      ? String(body.defaultGraphicName).trim()
      : body.defaultGraphic != null && String(body.defaultGraphic).trim()
        ? String(body.defaultGraphic).trim()
        : null;
  const points = normalizePointsJson(body.points);

  const created = await prisma.globalEquipmentTemplate.create({
    data: {
      name,
      equipmentType,
      description,
      defaultGraphicName,
      pointsJson: points,
    },
  });

  return getEquipmentTemplateById(created.id);
}

function graphicListRowFromRecord(r) {
  return {
    id: r.id,
    name: r.name,
    appliesToEquipmentType: r.appliesToEquipmentType,
    boundPointCount: r.boundPointCount ?? 0,
    globalEquipmentTemplateId: r.globalEquipmentTemplateId ?? null,
    equipmentTemplateName: r.equipmentTemplateName ?? null,
  };
}

async function updateGraphicTemplateName(id, body) {
  const name = String(body?.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  let r;
  try {
    r = await prisma.globalGraphicTemplate.update({
      where: { id },
      data: { name },
    });
  } catch (e) {
    if (e.code === 'P2025') throw new HttpError(404, 'Global graphic template not found');
    throw e;
  }
  return graphicListRowFromRecord(r);
}

async function deleteGraphicTemplate(id) {
  try {
    await prisma.globalGraphicTemplate.delete({ where: { id } });
  } catch (e) {
    if (e.code === 'P2025') throw new HttpError(404, 'Global graphic template not found');
    throw e;
  }
}

async function listGraphicTemplates() {
  const rows = await prisma.globalGraphicTemplate.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ name: 'asc' }],
  });
  return rows.map((r) => graphicListRowFromRecord(r));
}

async function getGraphicTemplateById(id) {
  const r = await prisma.globalGraphicTemplate.findFirst({
    where: { id, status: 'ACTIVE' },
  });
  if (!r) throw new HttpError(404, 'Global graphic template not found');
  const graphicEditorState =
    r.graphicEditorStateJson != null && typeof r.graphicEditorStateJson === 'object'
      ? r.graphicEditorStateJson
      : null;
  const boundFromState = countBindingsFromGraphicState(graphicEditorState);
  return {
    id: r.id,
    name: r.name,
    appliesToEquipmentType: r.appliesToEquipmentType,
    globalEquipmentTemplateId: r.globalEquipmentTemplateId ?? null,
    equipmentTemplateName: r.equipmentTemplateName ?? null,
    boundPointCount: Math.max(r.boundPointCount ?? 0, boundFromState),
    graphicEditorState,
  };
}

/**
 * @param {object} body - site graphic template row
 * @param {Array<{ id: string, name: string, equipmentType: string }>} [equipmentTemplates] - site equipment templates to resolve appliesTo / equipmentTemplateId
 */
async function createGraphicTemplateFromSitePayload(body, equipmentTemplates = []) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Invalid body');
  }
  const name = String(body.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');

  let appliesToEquipmentType = String(body.appliesToEquipmentType || '').trim();
  let globalEquipmentTemplateId = body.globalEquipmentTemplateId || null;
  let equipmentTemplateName = body.equipmentTemplateName != null ? String(body.equipmentTemplateName) : null;

  const siteEqId = body.equipmentTemplateId || null;
  const siteEq = siteEqId
    ? equipmentTemplates.find((e) => e && e.id === siteEqId)
    : equipmentTemplates.find(
        (e) =>
          e &&
          (e.name || '').toLowerCase() === String(body.appliesTo || '').toLowerCase()
      );

  if (!appliesToEquipmentType && siteEq) {
    appliesToEquipmentType = String(siteEq.equipmentType || 'CUSTOM').trim() || 'CUSTOM';
  }
  if (!appliesToEquipmentType) {
    appliesToEquipmentType = 'CUSTOM';
  }
  if (!equipmentTemplateName && siteEq) {
    equipmentTemplateName = siteEq.name || null;
  }

  const graphicEditorState =
    body.graphicEditorState != null && typeof body.graphicEditorState === 'object'
      ? body.graphicEditorState
      : null;
  const boundPointCount =
    typeof body.boundPointCount === 'number' && !Number.isNaN(body.boundPointCount)
      ? body.boundPointCount
      : countBindingsFromGraphicState(graphicEditorState);

  const created = await prisma.globalGraphicTemplate.create({
    data: {
      name,
      appliesToEquipmentType,
      globalEquipmentTemplateId: globalEquipmentTemplateId || null,
      equipmentTemplateName,
      graphicEditorStateJson: graphicEditorState,
      boundPointCount,
    },
  });

  return getGraphicTemplateById(created.id);
}

module.exports = {
  listEquipmentTemplates,
  getEquipmentTemplateById,
  createEquipmentTemplateFromSitePayload,
  updateEquipmentTemplateName,
  deleteEquipmentTemplate,
  listGraphicTemplates,
  getGraphicTemplateById,
  createGraphicTemplateFromSitePayload,
  updateGraphicTemplateName,
  deleteGraphicTemplate,
};
