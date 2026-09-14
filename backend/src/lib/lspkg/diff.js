'use strict';

/**
 * Shared change-preview engine (LC-ARCH-002 §7 "Change Preview, Activation & Rollback").
 * Used both by the package builder (to auto-generate a release summary, `builder.js`) and by the
 * LS-100 activation pipeline (`deployment.service.js` "Preview Changes") — one diff engine, so a
 * package's own release notes and an LS-100 operator's pre-activation preview can never disagree.
 *
 * Operates on two "file bundles" shaped like a package's `files` map (`{ 'equipment.json': {...},
 * 'alarms.json': {...}, ... }`). Comparison is always by the object's stable `id` (the Prisma UUID
 * carried inside the package — see builder.js) never by array position, so reordering never reads
 * as a change. A bundle missing a key entirely (e.g. an old pre-package deployment snapshot that
 * never tracked alarms/trends/schedules) is treated as an empty collection for that key — anything
 * present on the new side then correctly reads as "added", never crashes the diff.
 */

const { canonicalStringify } = require('./checksum');

/** @type {Array<{ collection: string, file: string, arrayPath: string[] }>} */
const COLLECTIONS = [
  { collection: 'equipment', file: 'equipment.json', arrayPath: ['equipment'] },
  { collection: 'points', file: 'equipment.json', arrayPath: ['points'] },
  { collection: 'controllers', file: 'mappings.json', arrayPath: ['controllers'] },
  { collection: 'pointMappings', file: 'mappings.json', arrayPath: ['pointMappings'] },
  { collection: 'alarmDefinitions', file: 'alarms.json', arrayPath: ['alarmDefinitions'] },
  { collection: 'trendDefinitions', file: 'trends.json', arrayPath: ['trendDefinitions'] },
  { collection: 'scheduleDefinitions', file: 'schedules.json', arrayPath: ['scheduleDefinitions'] },
];

function arrayFromBundle(bundle, file, arrayPath) {
  let node = bundle && typeof bundle === 'object' ? bundle[file] : undefined;
  for (const key of arrayPath) {
    node = node && typeof node === 'object' ? node[key] : undefined;
  }
  return Array.isArray(node) ? node : [];
}

function byId(list) {
  const map = new Map();
  for (const item of list) {
    if (item && typeof item === 'object' && item.id != null) map.set(String(item.id), item);
  }
  return map;
}

/**
 * @param {object|null} previousBundle
 * @param {object} nextBundle
 */
function computeChangePreview(previousBundle, nextBundle) {
  const collections = {};

  for (const { collection, file, arrayPath } of COLLECTIONS) {
    const prevMap = byId(arrayFromBundle(previousBundle, file, arrayPath));
    const nextMap = byId(arrayFromBundle(nextBundle, file, arrayPath));

    const added = [];
    const changed = [];
    const removed = [];
    const preserved = [];

    for (const [id, nextItem] of nextMap.entries()) {
      if (!prevMap.has(id)) {
        added.push(id);
      } else {
        const prevItem = prevMap.get(id);
        if (canonicalStringify(prevItem) === canonicalStringify(nextItem)) preserved.push(id);
        else changed.push(id);
      }
    }
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) removed.push(id);
    }

    collections[collection] = { added, changed, removed, preserved };
  }

  const nextEquipmentIds = new Set(arrayFromBundle(nextBundle, 'equipment.json', ['equipment']).map((e) => String(e.id)));
  const nextControllerIds = new Set(arrayFromBundle(nextBundle, 'mappings.json', ['controllers']).map((c) => String(c.id)));
  const nextPointIds = new Set(arrayFromBundle(nextBundle, 'equipment.json', ['points']).map((p) => String(p.id)));

  // "Unresolved" means a definition whose reference is not yet concretely resolved to a live
  // point/equipment — e.g. an alarm authored against a logical pointKey that has no bound Point
  // yet (alarm.service's own "PENDING_BINDING" concept). A dangling foreign key (an alarm
  // pointing at equipment that doesn't exist at all) cannot occur from real relational data —
  // Equipment/AlarmDefinition/etc. have `onDelete: Cascade` FKs — but the checks below still guard
  // a future *scoped/partial* package (LC-ARCH-002 §7 "Partial deployments") where an object could
  // legitimately reference equipment outside the package's own scope.
  const unresolved = [];
  for (const alarm of arrayFromBundle(nextBundle, 'alarms.json', ['alarmDefinitions'])) {
    if (!nextEquipmentIds.has(String(alarm.equipmentId))) {
      unresolved.push({ collection: 'alarmDefinitions', id: alarm.id, reason: `references missing equipmentId ${alarm.equipmentId}` });
    } else if (alarm.pointId == null) {
      unresolved.push({ collection: 'alarmDefinitions', id: alarm.id, reason: `pointKey "${alarm.pointKey}" is not yet bound to a Point` });
    }
  }
  for (const mapping of arrayFromBundle(nextBundle, 'mappings.json', ['pointMappings'])) {
    if (!nextControllerIds.has(String(mapping.equipmentControllerId))) {
      unresolved.push({ collection: 'pointMappings', id: mapping.id, reason: `references missing controller ${mapping.equipmentControllerId}` });
    } else if (!nextPointIds.has(String(mapping.pointId))) {
      unresolved.push({ collection: 'pointMappings', id: mapping.id, reason: `references missing point ${mapping.pointId}` });
    } else if (!mapping.isBound) {
      unresolved.push({ collection: 'pointMappings', id: mapping.id, reason: 'mapping is not yet bound' });
    }
  }
  for (const trend of arrayFromBundle(nextBundle, 'trends.json', ['trendDefinitions'])) {
    for (const assignment of trend.assignments || []) {
      if (!nextEquipmentIds.has(String(assignment.equipmentId))) {
        unresolved.push({ collection: 'trendDefinitions', id: trend.id, reason: `assignment references missing equipmentId ${assignment.equipmentId}` });
      }
    }
  }
  for (const schedule of arrayFromBundle(nextBundle, 'schedules.json', ['scheduleDefinitions'])) {
    for (const assignment of schedule.assignments || []) {
      if (!nextEquipmentIds.has(String(assignment.equipmentId))) {
        unresolved.push({ collection: 'scheduleDefinitions', id: schedule.id, reason: `assignment references missing equipmentId ${assignment.equipmentId}` });
      }
    }
  }

  // Objects intentionally preserved and never touched by activation (LC-ARCH-002 §7): surfaced as
  // a fixed informational list rather than computed, since they are never part of a package.
  const preservedByPolicy = [
    'Point history (PointHistorySample)',
    'Alarm/event history (AlarmEvent)',
    'Audit/deployment history',
    'Operational users and credentials',
    'Current live values and communication state',
  ];

  return { collections, unresolved, preservedByPolicy };
}

module.exports = { computeChangePreview, COLLECTIONS };
