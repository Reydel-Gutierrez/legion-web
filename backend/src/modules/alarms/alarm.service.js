const prisma = require('../../lib/prisma');
const { HttpError } = require('../../lib/httpError');

/** @type {Map<string, number>} definitionId -> first violated timestamp (ms) */
const delayFirstViolatedAt = new Map();

function parsePresentValue(raw) {
  if (raw === null || raw === undefined || raw === '') return { kind: 'empty', num: null, bool: null, str: '' };
  if (typeof raw === 'boolean') return { kind: 'bool', num: null, bool: raw, str: String(raw) };
  if (typeof raw === 'number' && !Number.isNaN(raw)) return { kind: 'num', num: raw, bool: null, str: String(raw) };
  const s = String(raw).trim();
  if (s === '') return { kind: 'empty', num: null, bool: null, str: '' };
  const lower = s.toLowerCase();
  if (lower === 'true' || lower === 'on' || lower === 'active') return { kind: 'bool', num: null, bool: true, str: s };
  if (lower === 'false' || lower === 'off' || lower === 'inactive') return { kind: 'bool', num: null, bool: false, str: s };
  if (s === '1') return { kind: 'bool', num: null, bool: true, str: s };
  if (s === '0') return { kind: 'bool', num: null, bool: false, str: s };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { kind: 'num', num: parseFloat(s), bool: null, str: s };
  return { kind: 'str', num: null, bool: null, str: s };
}

function isOn(parsed) {
  if (parsed.kind === 'bool') return parsed.bool === true;
  if (parsed.kind === 'num') return parsed.num !== 0;
  const lower = parsed.str.toLowerCase();
  return lower === 'on' || lower === 'active' || lower === 'true' || lower === 'run' || lower === 'running';
}

function isOff(parsed) {
  if (parsed.kind === 'bool') return parsed.bool === false;
  if (parsed.kind === 'num') return parsed.num === 0;
  const lower = parsed.str.toLowerCase();
  return lower === 'off' || lower === 'inactive' || lower === 'false' || lower === 'stop' || lower === 'stopped';
}

function numericOrNull(parsed) {
  if (parsed.kind === 'num') return parsed.num;
  if (parsed.kind === 'bool') return parsed.bool ? 1 : 0;
  if (parsed.kind === 'empty') return null;
  const n = parseFloat(parsed.str);
  return Number.isNaN(n) ? null : n;
}

/**
 * @param {import('@prisma/client').AlarmDefinition & { point?: import('@prisma/client').Point, targetPoint?: import('@prisma/client').Point | null }} def
 * @returns {{ violated: boolean, displayValue: string }}
 */
function evaluateCondition(def) {
  const src = parsePresentValue(def.point?.presentValue);
  const displayValue = def.point?.presentValue != null ? String(def.point.presentValue) : '—';
  const tgt = def.targetPoint ? parsePresentValue(def.targetPoint.presentValue) : null;
  const threshold = def.targetValue != null ? def.targetValue : null;

  const cat = def.category;
  const op = def.operator;

  if (cat === 'BINARY') {
    if (op === 'IS_ON') return { violated: isOn(src), displayValue };
    if (op === 'IS_OFF') return { violated: isOff(src), displayValue };
    return { violated: false, displayValue };
  }

  if (cat === 'DEVIATION') {
    if (!def.targetPoint || threshold === null) return { violated: false, displayValue };
    const a = numericOrNull(src);
    const b = tgt ? numericOrNull(tgt) : null;
    if (a === null || b === null) return { violated: false, displayValue };
    const diff = a - b;
    if (op === 'DELTA_GT') return { violated: diff > threshold, displayValue };
    if (op === 'DELTA_GTE') return { violated: diff >= threshold, displayValue };
    if (op === 'DELTA_LT') return { violated: diff < threshold, displayValue };
    if (op === 'DELTA_LTE') return { violated: diff <= threshold, displayValue };
    return { violated: false, displayValue };
  }

  if (cat === 'COMPARISON') {
    if (!def.targetPoint) return { violated: false, displayValue };
    const aNum = numericOrNull(src);
    const bNum = tgt ? numericOrNull(tgt) : null;
    if (aNum !== null && bNum !== null) {
      if (op === 'EQ') return { violated: aNum === bNum, displayValue };
      if (op === 'NEQ') return { violated: aNum !== bNum, displayValue };
      if (op === 'GT') return { violated: aNum > bNum, displayValue };
      if (op === 'GTE') return { violated: aNum >= bNum, displayValue };
      if (op === 'LT') return { violated: aNum < bNum, displayValue };
      if (op === 'LTE') return { violated: aNum <= bNum, displayValue };
    }
    const aStr = src.str || displayValue;
    const bStr = (tgt && tgt.str) || String(def.targetPoint?.presentValue ?? '');
    if (op === 'EQ') return { violated: aStr === bStr, displayValue };
    if (op === 'NEQ') return { violated: aStr !== bStr, displayValue };
    return { violated: false, displayValue };
  }

  return { violated: false, displayValue };
}

/**
 * Threshold with hysteresis: if already in alarm, use relaxed clear band.
 * @param {import('@prisma/client').AlarmDefinition & { point?: import('@prisma/client').Point, targetPoint?: import('@prisma/client').Point | null }} def
 * @param {boolean} hasActive
 */
function evaluateThresholdWithHysteresis(def, hasActive) {
  const src = parsePresentValue(def.point?.presentValue);
  const displayValue = def.point?.presentValue != null ? String(def.point.presentValue) : '—';
  const t = def.targetValue;
  const dead = def.deadband != null ? def.deadband : 0;
  const v = numericOrNull(src);
  if (v === null || t === null) return { violated: false, displayValue };
  const op = def.operator;

  const enter = () => {
    if (op === 'GT') return v > t;
    if (op === 'GTE') return v >= t;
    if (op === 'LT') return v < t;
    if (op === 'LTE') return v <= t;
    if (op === 'EQ') return v === t;
    if (op === 'NEQ') return v !== t;
    return false;
  };

  const clear = () => {
    if (op === 'GT') return v <= t - dead;
    if (op === 'GTE') return v < t - dead;
    if (op === 'LT') return v >= t + dead;
    if (op === 'LTE') return v > t + dead;
    if (op === 'EQ') return v !== t;
    if (op === 'NEQ') return v === t;
    return true;
  };

  if (!hasActive) {
    return { violated: enter(), displayValue };
  }
  if (enter()) return { violated: true, displayValue };
  return { violated: !clear(), displayValue };
}

function resolveViolated(def, hasActive) {
  if (def.category === 'THRESHOLD') {
    return evaluateThresholdWithHysteresis(def, hasActive);
  }
  return evaluateCondition(def);
}

function buildMessage(def, displayValue) {
  if (def.messageTemplate && String(def.messageTemplate).trim()) {
    return String(def.messageTemplate)
      .replace(/\{value\}/gi, displayValue)
      .replace(/\{name\}/gi, def.name);
  }
  const pt = def.point;
  const label = pt ? `${pt.pointName || pt.pointCode}` : def.pointKey || 'Point';
  return `${def.name}: ${label} = ${displayValue}`;
}

/**
 * Resolve live Point row for source or target using pointId first, then equipmentId + logical key.
 * @param {{ siteId: string, equipmentId: string, pointId?: string|null, pointKey: string, targetPointId?: string|null, targetPointKey?: string|null }} def
 * @param {'source'|'target'} role
 */
async function resolveLivePointForDefinition(def, role) {
  const isSource = role === 'source';
  const idField = isSource ? 'pointId' : 'targetPointId';
  const keyStr = isSource
    ? String(def.pointKey || '').trim()
    : String(def.targetPointKey || '').trim();

  const pid = def[idField];
  if (pid) {
    const p = await prisma.point.findFirst({
      where: { id: pid, equipmentId: def.equipmentId, siteId: def.siteId },
    });
    if (p) return p;
  }
  if (keyStr) {
    return prisma.point.findFirst({
      where: { equipmentId: def.equipmentId, siteId: def.siteId, pointCode: keyStr },
    });
  }
  return null;
}

/** Persist resolved DB ids onto the definition when mapping appears. */
async function persistResolvedPointers(defRow, sourcePoint, targetPoint) {
  const data = {};
  if (sourcePoint && defRow.pointId !== sourcePoint.id) {
    data.pointId = sourcePoint.id;
  }
  if (targetPoint && defRow.targetPointId !== targetPoint.id) {
    data.targetPointId = targetPoint.id;
  }
  if (Object.keys(data).length === 0) return null;
  return prisma.alarmDefinition.update({
    where: { id: defRow.id },
    data,
    include: { point: true, targetPoint: true },
  });
}

async function evaluateDefinitionById(definitionId) {
  const row = await prisma.alarmDefinition.findUnique({
    where: { id: definitionId },
    include: { point: true, targetPoint: true },
  });
  if (row) await evaluateOneDefinition(row);
}

/**
 * When a Point row is created/updated, link alarm definitions that use the same logical key.
 */
async function syncAlarmDefinitionsAfterPointWrite(point) {
  if (!point?.siteId || !point?.equipmentId || !point?.pointCode || !point?.id) return;
  const { siteId, equipmentId, pointCode, id } = point;
  await prisma.alarmDefinition.updateMany({
    where: { siteId, equipmentId, pointKey: pointCode, pointId: null },
    data: { pointId: id },
  });
  await prisma.alarmDefinition.updateMany({
    where: { siteId, equipmentId, targetPointKey: pointCode, targetPointId: null },
    data: { targetPointId: id },
  });
}

async function assertSite(siteId) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new HttpError(404, 'Site not found');
  return site;
}

function bodyEnum(map, value, field) {
  if (value === undefined || value === null) return undefined;
  const u = String(value).toUpperCase().replace(/-/g, '_');
  if (map.has(u)) return map.get(u);
  throw new HttpError(400, `Invalid ${field}`);
}

const SEVERITY_MAP = new Map([
  ['CRITICAL', 'CRITICAL'],
  ['MAJOR', 'MAJOR'],
  ['MINOR', 'MINOR'],
  ['WARNING', 'WARNING'],
]);
const CATEGORY_MAP = new Map([
  ['BINARY', 'BINARY'],
  ['THRESHOLD', 'THRESHOLD'],
  ['DEVIATION', 'DEVIATION'],
  ['COMPARISON', 'COMPARISON'],
]);
const OPERATOR_MAP = new Map([
  ['EQ', 'EQ'],
  ['NEQ', 'NEQ'],
  ['GT', 'GT'],
  ['GTE', 'GTE'],
  ['LT', 'LT'],
  ['LTE', 'LTE'],
  ['IS_ON', 'IS_ON'],
  ['IS_OFF', 'IS_OFF'],
  ['DELTA_GT', 'DELTA_GT'],
  ['DELTA_GTE', 'DELTA_GTE'],
  ['DELTA_LT', 'DELTA_LT'],
  ['DELTA_LTE', 'DELTA_LTE'],
]);

async function listDefinitions(siteId, query) {
  await assertSite(siteId);
  const { equipmentId, pointId, pointKey } = query;
  const where = {
    siteId,
    ...(equipmentId ? { equipmentId: String(equipmentId) } : {}),
    ...(pointId ? { pointId: String(pointId) } : {}),
    ...(pointKey ? { pointKey: String(pointKey) } : {}),
  };
  const rows = await prisma.alarmDefinition.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      point: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
      targetPoint: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    sourceBinding: r.pointId ? 'READY' : 'PENDING_BINDING',
  }));
}

async function createDefinition(siteId, body) {
  await assertSite(siteId);
  const {
    equipmentId,
    pointKey,
    pointId,
    name,
    enabled,
    severity,
    category,
    operator,
    targetValue,
    targetPointId,
    targetPointKey,
    deadband,
    delaySeconds,
    messageTemplate,
    autoAcknowledge,
    buildingId,
    floorId,
  } = body;

  if (!equipmentId || !name || !category || !operator) {
    throw new HttpError(400, 'equipmentId, name, category, and operator are required');
  }
  const pk = pointKey != null ? String(pointKey).trim() : '';
  if (!pk) {
    throw new HttpError(400, 'pointKey is required (template / logical point identifier)');
  }

  const equipment = await prisma.equipment.findFirst({
    where: { id: String(equipmentId), siteId },
  });
  if (!equipment) throw new HttpError(404, 'Equipment not found for this site');

  const catEnum = bodyEnum(CATEGORY_MAP, category, 'category');
  if (catEnum === 'DEVIATION' || catEnum === 'COMPARISON') {
    const hasTgt =
      (targetPointId && String(targetPointId).trim()) ||
      (targetPointKey != null && String(targetPointKey).trim());
    if (!hasTgt) {
      throw new HttpError(400, 'targetPointId or targetPointKey is required for this rule type');
    }
    if (targetPointKey != null && String(targetPointKey).trim() === pk) {
      throw new HttpError(400, 'targetPointKey must differ from pointKey');
    }
  }

  let resolvedSource = null;
  if (pointId) {
    resolvedSource = await prisma.point.findFirst({
      where: { id: String(pointId), siteId, equipmentId: String(equipmentId) },
    });
    if (!resolvedSource) throw new HttpError(404, 'pointId not found for this equipment/site');
  } else {
    resolvedSource = await prisma.point.findFirst({
      where: { siteId, equipmentId: String(equipmentId), pointCode: pk },
    });
  }

  if (targetPointId) {
    const tp = await prisma.point.findFirst({
      where: { id: String(targetPointId), siteId, equipmentId: String(equipmentId) },
    });
    if (!tp) throw new HttpError(404, 'targetPoint not found on this equipment');
  }

  const tpk =
    !targetPointId && targetPointKey != null && String(targetPointKey).trim() !== ''
      ? String(targetPointKey).trim()
      : null;

  const row = await prisma.alarmDefinition.create({
    data: {
      siteId,
      buildingId: buildingId != null ? String(buildingId) : equipment.buildingId,
      floorId: floorId != null ? String(floorId) : equipment.floorId,
      equipmentId: String(equipmentId),
      pointKey: pk,
      pointId: resolvedSource ? resolvedSource.id : null,
      name: String(name).trim(),
      enabled: enabled !== false,
      severity: bodyEnum(SEVERITY_MAP, severity || 'WARNING', 'severity') || 'WARNING',
      category: catEnum,
      operator: bodyEnum(OPERATOR_MAP, operator, 'operator'),
      targetValue: targetValue != null && targetValue !== '' ? Number(targetValue) : null,
      targetPointId: targetPointId ? String(targetPointId) : null,
      targetPointKey: tpk,
      deadband: deadband != null && deadband !== '' ? Number(deadband) : null,
      delaySeconds:
        delaySeconds != null && delaySeconds !== '' ? parseInt(String(delaySeconds), 10) : null,
      messageTemplate: messageTemplate != null ? String(messageTemplate) : null,
      autoAcknowledge: Boolean(autoAcknowledge),
    },
    include: {
      point: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
      targetPoint: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
    },
  });

  await evaluateDefinitionById(row.id);
  return {
    ...row,
    sourceBinding: row.pointId ? 'READY' : 'PENDING_BINDING',
  };
}

async function updateDefinition(siteId, definitionId, body) {
  const existing = await prisma.alarmDefinition.findFirst({
    where: { id: definitionId, siteId },
  });
  if (!existing) throw new HttpError(404, 'Alarm definition not found');

  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.severity !== undefined) data.severity = bodyEnum(SEVERITY_MAP, body.severity, 'severity');
  if (body.category !== undefined) data.category = bodyEnum(CATEGORY_MAP, body.category, 'category');
  if (body.operator !== undefined) data.operator = bodyEnum(OPERATOR_MAP, body.operator, 'operator');
  if (body.targetValue !== undefined) {
    data.targetValue = body.targetValue != null && body.targetValue !== '' ? Number(body.targetValue) : null;
  }
  if (body.pointKey !== undefined) {
    const pk = String(body.pointKey || '').trim();
    if (!pk) throw new HttpError(400, 'pointKey cannot be empty');
    data.pointKey = pk;
  }
  if (body.pointId !== undefined) {
    if (body.pointId) {
      const p = await prisma.point.findFirst({
        where: { id: String(body.pointId), siteId, equipmentId: existing.equipmentId },
      });
      if (!p) throw new HttpError(404, 'pointId not found on this equipment');
    }
    data.pointId = body.pointId ? String(body.pointId) : null;
  }
  if (body.targetPointId !== undefined) {
    if (body.targetPointId) {
      const tp = await prisma.point.findFirst({
        where: { id: String(body.targetPointId), siteId, equipmentId: existing.equipmentId },
      });
      if (!tp) throw new HttpError(404, 'targetPoint not found on this equipment');
    }
    data.targetPointId = body.targetPointId ? String(body.targetPointId) : null;
  }
  if (body.targetPointKey !== undefined) {
    data.targetPointKey =
      body.targetPointKey != null && String(body.targetPointKey).trim() !== ''
        ? String(body.targetPointKey).trim()
        : null;
  }
  if (body.deadband !== undefined) {
    data.deadband = body.deadband != null && body.deadband !== '' ? Number(body.deadband) : null;
  }
  if (body.delaySeconds !== undefined) {
    data.delaySeconds =
      body.delaySeconds != null && body.delaySeconds !== ''
        ? parseInt(String(body.delaySeconds), 10)
        : null;
  }
  if (body.messageTemplate !== undefined) data.messageTemplate = body.messageTemplate != null ? String(body.messageTemplate) : null;
  if (body.autoAcknowledge !== undefined) data.autoAcknowledge = Boolean(body.autoAcknowledge);

  if (Object.keys(data).length === 0) throw new HttpError(400, 'No fields to update');

  const row = await prisma.alarmDefinition.update({
    where: { id: definitionId },
    data,
    include: {
      point: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
      targetPoint: { select: { id: true, pointName: true, pointCode: true, presentValue: true } },
    },
  });

  delayFirstViolatedAt.delete(definitionId);
  await evaluateDefinitionById(row.id);
  return {
    ...row,
    sourceBinding: row.pointId ? 'READY' : 'PENDING_BINDING',
  };
}

async function deleteDefinition(siteId, definitionId) {
  const existing = await prisma.alarmDefinition.findFirst({
    where: { id: definitionId, siteId },
  });
  if (!existing) throw new HttpError(404, 'Alarm definition not found');
  await prisma.alarmDefinition.delete({ where: { id: definitionId } });
  delayFirstViolatedAt.delete(definitionId);
  return { ok: true };
}

async function listEvents(siteId, query) {
  await assertSite(siteId);
  const { state, equipmentId } = query;
  const where = { siteId };
  if (equipmentId) where.equipmentId = String(equipmentId);
  if (state === 'active') where.state = 'ACTIVE';
  else if (state === 'history' || state === 'cleared') where.state = 'CLEARED';
  return prisma.alarmEvent.findMany({
    where,
    orderBy: [{ occurredAt: 'desc' }],
    include: {
      definition: {
        include: {
          point: { select: { pointName: true, pointCode: true } },
          equipment: { select: { name: true, equipmentType: true } },
        },
      },
    },
    take: 500,
  });
}

async function acknowledgeEvent(siteId, eventId) {
  const ev = await prisma.alarmEvent.findFirst({
    where: { id: eventId, siteId },
  });
  if (!ev) throw new HttpError(404, 'Alarm event not found');
  return prisma.alarmEvent.update({
    where: { id: eventId },
    data: { ack: true },
    include: {
      definition: {
        include: {
          point: { select: { pointName: true, pointCode: true } },
          equipment: { select: { name: true, equipmentType: true } },
        },
      },
    },
  });
}

async function loadDefinitionBundle(defId) {
  return prisma.alarmDefinition.findUnique({
    where: { id: defId },
    include: {
      point: true,
      targetPoint: true,
    },
  });
}

async function evaluateOneDefinition(defRow) {
  if (!defRow || !defRow.enabled) return;

  let full = await loadDefinitionBundle(defRow.id);
  if (!full) return;

  const sourcePoint = await resolveLivePointForDefinition(full, 'source');
  const needsTarget = full.category === 'DEVIATION' || full.category === 'COMPARISON';
  const targetPoint = needsTarget ? await resolveLivePointForDefinition(full, 'target') : null;

  if (sourcePoint || targetPoint) {
    const persisted = await persistResolvedPointers(full, sourcePoint, targetPoint);
    if (persisted) full = persisted;
  }

  const active = await prisma.alarmEvent.findFirst({
    where: { alarmDefinitionId: full.id, state: 'ACTIVE' },
  });

  const now = new Date();

  if (!sourcePoint) {
    delayFirstViolatedAt.delete(full.id);
    if (active) {
      const occurred = active.occurredAt;
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - occurred.getTime()) / 1000)
      );
      await prisma.alarmEvent.update({
        where: { id: active.id },
        data: {
          state: 'CLEARED',
          clearedAt: now,
          lastEvaluatedAt: now,
          clearValue: null,
          message: `${full.name}: cleared — no live source for ${full.pointKey}`,
          durationSeconds,
        },
      });
    }
    return;
  }

  if (needsTarget && !targetPoint) {
    delayFirstViolatedAt.delete(full.id);
    if (active) {
      const occurred = active.occurredAt;
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - occurred.getTime()) / 1000)
      );
      await prisma.alarmEvent.update({
        where: { id: active.id },
        data: {
          state: 'CLEARED',
          clearedAt: now,
          lastEvaluatedAt: now,
          clearValue: null,
          message: `${full.name}: cleared — reference point not bound`,
          durationSeconds,
        },
      });
    }
    return;
  }

  const evalDef = {
    ...full,
    point: sourcePoint,
    targetPoint: needsTarget ? targetPoint : full.targetPoint,
  };

  const { violated, displayValue } = resolveViolated(evalDef, Boolean(active));
  const delaySec = full.delaySeconds != null && full.delaySeconds > 0 ? full.delaySeconds : 0;

  let effectiveViolated = violated;
  if (violated && delaySec > 0) {
    const key = full.id;
    if (!delayFirstViolatedAt.has(key)) delayFirstViolatedAt.set(key, now.getTime());
    const first = delayFirstViolatedAt.get(key);
    if ((now.getTime() - first) / 1000 < delaySec) {
      effectiveViolated = false;
    }
  } else if (!violated) {
    delayFirstViolatedAt.delete(full.id);
  }

  const message = buildMessage(evalDef, displayValue);

  if (effectiveViolated) {
    if (!active) {
      await prisma.alarmEvent.create({
        data: {
          alarmDefinitionId: full.id,
          siteId: full.siteId,
          equipmentId: full.equipmentId,
          pointId: sourcePoint.id,
          state: 'ACTIVE',
          ack: full.autoAcknowledge === true,
          message,
          activeValue: displayValue,
          lastEvaluatedAt: now,
        },
      });
    } else {
      await prisma.alarmEvent.update({
        where: { id: active.id },
        data: {
          lastEvaluatedAt: now,
          activeValue: displayValue,
          message,
          pointId: sourcePoint.id,
        },
      });
    }
  } else if (active) {
    const occurred = active.occurredAt;
    const clearedAt = now;
    const durationSeconds = Math.max(
      0,
      Math.round((clearedAt.getTime() - occurred.getTime()) / 1000)
    );
    const clearVal =
      sourcePoint?.presentValue != null ? String(sourcePoint.presentValue) : null;
    await prisma.alarmEvent.update({
      where: { id: active.id },
      data: {
        state: 'CLEARED',
        clearedAt,
        lastEvaluatedAt: now,
        clearValue: clearVal,
        durationSeconds,
        pointId: sourcePoint.id,
      },
    });
  }
}

async function evaluateDefinitionsForSite(siteId, pointIds) {
  const idSet = [...new Set((pointIds || []).filter(Boolean).map(String))];
  const whereEnabled = {
    siteId,
    enabled: true,
    ...(idSet.length
      ? {
          OR: [{ pointId: { in: idSet } }, { targetPointId: { in: idSet } }],
        }
      : {}),
  };

  const defs = await prisma.alarmDefinition.findMany({
    where: whereEnabled,
    select: { id: true },
  });

  for (const d of defs) {
    await evaluateDefinitionById(d.id);
  }
}

/**
 * Call after point value updates. Evaluates any alarm definitions tied to these points.
 * @param {string[]} pointIds
 */
async function evaluateForPointIds(pointIds) {
  if (!pointIds || !pointIds.length) return;
  const points = await prisma.point.findMany({
    where: { id: { in: pointIds } },
  });
  const defIds = new Set();
  for (const p of points) {
    const defs = await prisma.alarmDefinition.findMany({
      where: {
        siteId: p.siteId,
        enabled: true,
        OR: [
          { pointId: p.id },
          { targetPointId: p.id },
          { equipmentId: p.equipmentId, pointKey: p.pointCode },
          { equipmentId: p.equipmentId, targetPointKey: p.pointCode },
        ],
      },
      select: { id: true },
    });
    defs.forEach((d) => defIds.add(d.id));
  }
  for (const id of defIds) {
    await evaluateDefinitionById(id);
  }
}

module.exports = {
  listDefinitions,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  listEvents,
  acknowledgeEvent,
  evaluateForPointIds,
  evaluateDefinitionsForSite,
  syncAlarmDefinitionsAfterPointWrite,
};
