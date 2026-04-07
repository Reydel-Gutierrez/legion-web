const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');
const {
  createDefaultWorkingPayload,
  cloneJson,
  buildDeploymentSnapshotFromWorking,
  deploymentSnapshotToWorkingPayload,
  validateWorkingPayloadForDeploy,
  isPlainObject,
} = require('./siteVersion.payload');
const { buildWorkingSiteEquipmentFromDb } = require('../siteHierarchy/siteHierarchy.service');

const versionInclude = {
  payload: true,
};

async function assertSiteExists(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new HttpError(404, 'Site not found');
  }
  return site;
}

async function nextVersionNumber(siteId) {
  const agg = await prisma.siteVersion.aggregate({
    where: { siteId },
    _max: { versionNumber: true },
  });
  return (agg._max.versionNumber ?? 0) + 1;
}

function serializeVersionRow(version, includePayload = true) {
  const row = {
    id: version.id,
    siteId: version.siteId,
    versionNumber: version.versionNumber,
    status: version.status,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    deployedAt: version.deployedAt,
    parentVersionId: version.parentVersionId,
    notes: version.notes,
  };
  if (includePayload) {
    row.payload = version.payload?.payloadJson ?? null;
  }
  return row;
}

/**
 * Find current WORKING version or create one (clone from active release or empty default).
 */
async function getOrCreateWorkingVersion(siteId) {
  await assertSiteExists(siteId);

  const existing = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });
  if (existing) return existing;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      activeReleaseVersion: { include: { payload: true } },
    },
  });

  const vn = await nextVersionNumber(siteId);

  let initialPayload = createDefaultWorkingPayload();
  let parentVersionId = null;

  if (site?.activeReleaseVersionId && site.activeReleaseVersion?.payload) {
    const snap = site.activeReleaseVersion.payload.payloadJson;
    initialPayload = deploymentSnapshotToWorkingPayload(
      typeof snap === 'object' && snap !== null ? snap : {}
    );
    parentVersionId = site.activeReleaseVersion.id;
  }

  initialPayload.templates =
    initialPayload.templates && typeof initialPayload.templates === 'object'
      ? initialPayload.templates
      : { equipmentTemplates: [], graphicTemplates: [] };
  initialPayload.templates.equipmentTemplates = Array.isArray(initialPayload.templates.equipmentTemplates)
    ? initialPayload.templates.equipmentTemplates
    : [];
  initialPayload.templates.graphicTemplates = Array.isArray(initialPayload.templates.graphicTemplates)
    ? initialPayload.templates.graphicTemplates
    : [];

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.siteVersion.create({
        data: {
          siteId,
          versionNumber: vn,
          status: 'WORKING',
          parentVersionId,
          notes: null,
          payload: {
            create: {
              payloadJson: initialPayload,
            },
          },
        },
        include: versionInclude,
      });
      return created;
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await prisma.siteVersion.findFirst({
        where: { siteId, status: 'WORKING' },
        include: versionInclude,
      });
      if (again) return again;
    }
    throw e;
  }
}

/**
 * Merge relational hierarchy into the WORKING payload so Site Builder and deploy see DB truth.
 * Preserves templates, mappings, graphics, networkConfig, etc.
 */
async function syncWorkingPayloadFromDb(siteId) {
  await assertSiteExists(siteId);
  let working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });
  if (!working) {
    working = await getOrCreateWorkingVersion(siteId);
  }
  const payloadJson = working.payload?.payloadJson || createDefaultWorkingPayload();
  const { site, equipment } = await buildWorkingSiteEquipmentFromDb(siteId);
  const merged = { ...cloneJson(payloadJson), site, equipment };
  merged.templates =
    merged.templates && typeof merged.templates === 'object'
      ? merged.templates
      : { equipmentTemplates: [], graphicTemplates: [] };
  merged.templates.equipmentTemplates = Array.isArray(merged.templates.equipmentTemplates)
    ? merged.templates.equipmentTemplates
    : [];
  merged.templates.graphicTemplates = Array.isArray(merged.templates.graphicTemplates)
    ? merged.templates.graphicTemplates
    : [];
  return prisma.siteVersion.update({
    where: { id: working.id },
    data: {
      payload: {
        update: { payloadJson: merged },
      },
    },
    include: versionInclude,
  });
}

/**
 * PUT body: { payload: object, notes?: string }
 */
async function putWorkingVersion(siteId, body) {
  await assertSiteExists(siteId);

  if (!body || !isPlainObject(body.payload)) {
    throw new HttpError(400, 'payload is required and must be a JSON object');
  }

  const notes = body.notes !== undefined ? (body.notes === null ? null : String(body.notes)) : undefined;

  let working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: versionInclude,
  });

  if (!working) {
    working = await getOrCreateWorkingVersion(siteId);
  }

  await prisma.siteVersion.update({
    where: { id: working.id },
    data: {
      ...(notes !== undefined ? { notes } : {}),
      payload: {
        update: {
          payloadJson: cloneJson(body.payload),
        },
      },
    },
    include: versionInclude,
  });

  return syncWorkingPayloadFromDb(siteId);
}

async function getActiveRelease(siteId) {
  await assertSiteExists(siteId);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      activeReleaseVersion: { include: { payload: true } },
    },
  });

  if (!site?.activeReleaseVersion) {
    return null;
  }
  return site.activeReleaseVersion;
}

async function deployWorkingVersion(siteId) {
  await assertSiteExists(siteId);

  await syncWorkingPayloadFromDb(siteId);

  const working = await prisma.siteVersion.findFirst({
    where: { siteId, status: 'WORKING' },
    include: { payload: true },
  });

  if (!working) {
    throw new HttpError(404, 'No working version to deploy');
  }

  const payloadJson = working.payload?.payloadJson;
  const err = validateWorkingPayloadForDeploy(payloadJson);
  if (err) {
    throw new HttpError(400, err);
  }

  const workingFlat = payloadJson;
  const snapshot = buildDeploymentSnapshotFromWorking(workingFlat, {
    version: `v${working.versionNumber}`,
    lastDeployedAt: new Date().toISOString(),
  });

  const released = await prisma.$transaction(async (tx) => {
    const deployedAt = new Date();

    const updatedVersion = await tx.siteVersion.update({
      where: { id: working.id },
      data: {
        status: 'RELEASED',
        deployedAt,
        payload: {
          update: {
            payloadJson: snapshot,
          },
        },
      },
      include: { payload: true },
    });

    await tx.site.update({
      where: { id: siteId },
      data: { activeReleaseVersionId: updatedVersion.id },
    });

    return updatedVersion;
  });

  return released;
}

async function listVersionHistory(siteId) {
  await assertSiteExists(siteId);

  const rows = await prisma.siteVersion.findMany({
    where: { siteId },
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      siteId: true,
      versionNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      deployedAt: true,
      parentVersionId: true,
      notes: true,
    },
  });

  return rows;
}

module.exports = {
  getOrCreateWorkingVersion,
  syncWorkingPayloadFromDb,
  putWorkingVersion,
  getActiveRelease,
  deployWorkingVersion,
  listVersionHistory,
  serializeVersionRow,
};
