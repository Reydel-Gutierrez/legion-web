import { getEquipmentStatus, normalizeCommStatus } from "./statusUtils";

function compact(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function isActiveAlarm(alarm) {
  return String(alarm?.state || "").toLowerCase() === "active";
}

/**
 * High / Low / generic alarm label from the definition operator or message.
 * @param {object} alarm
 * @returns {"High Alarm"|"Low Alarm"|"Alarm"}
 */
export function alarmStateLabel(alarm) {
  const op = String(alarm?.operator || "").toUpperCase();
  if (op === "GT" || op === "GTE") return "High Alarm";
  if (op === "LT" || op === "LTE") return "Low Alarm";
  const text = `${alarm?.message || ""} ${alarm?.definitionName || ""} ${alarm?.name || ""}`.toLowerCase();
  if (/\bhigh\b/.test(text)) return "High Alarm";
  if (/\blow\b/.test(text)) return "Low Alarm";
  return "Alarm";
}

function pointKeys(point) {
  return [point?.pointKey, point?.pointId, point?.pointCode, point?.pointReferenceId, point?.pointName, point?.pointDescription]
    .map(compact)
    .filter(Boolean);
}

function alarmKeys(alarm) {
  return [alarm?.pointKey, alarm?.pointCode, alarm?.point].map(compact).filter(Boolean);
}

/**
 * @param {object} point
 * @param {object[]} alarms
 * @param {string} [equipmentId]
 * @returns {object[]}
 */
export function matchActiveAlarmsForPoint(point, alarms, equipmentId) {
  const list = (alarms || []).filter(isActiveAlarm);
  if (!point || list.length === 0) return [];
  const eqId = String(equipmentId || point.equipmentId || "");
  const dbId = point.databasePointId != null ? String(point.databasePointId) : "";
  const keys = new Set(pointKeys(point));

  return list.filter((a) => {
    const aEq = String(a.equipmentId || "");
    if (eqId && aEq && aEq !== eqId) return false;
    if (dbId && a.pointId) return String(a.pointId) === dbId;
    // Text keys are only unique within an equipment assignment.
    if (!eqId || aEq !== eqId) return false;
    if (keys.size === 0) return false;
    return alarmKeys(a).some((k) => keys.has(k));
  });
}

/**
 * @param {object} point
 * @param {object[]} alarms
 * @param {string} [equipmentId]
 * @returns {{ active: boolean, label: string|null, count: number }}
 */
export function resolvePointAlarmState(point, alarms, equipmentId) {
  const hits = matchActiveAlarmsForPoint(point, alarms, equipmentId);
  if (hits.length === 0) return { active: false, label: null, count: 0 };
  const high = hits.find((a) => alarmStateLabel(a) === "High Alarm");
  const low = hits.find((a) => alarmStateLabel(a) === "Low Alarm");
  const chosen = high || low || hits[0];
  return { active: true, label: alarmStateLabel(chosen), count: hits.length };
}

/**
 * @param {object[]} alarms
 * @param {string} equipmentId
 * @returns {number}
 */
export function countActiveAlarmsForEquipment(alarms, equipmentId) {
  const eqId = String(equipmentId || "");
  if (!eqId) return 0;
  return (alarms || []).filter((a) => isActiveAlarm(a) && String(a.equipmentId || "") === eqId).length;
}

/**
 * Roll alarm counts (and equipment comm when runtime is provided) up the facility tree.
 * Does not mutate the source tree.
 * @param {object|null} tree
 * @param {object[]} alarms
 * @param {object[]} [runtimeControllers]
 * @returns {object|null}
 */
export function annotateFacilityTreeAlarms(tree, alarms, runtimeControllers, now = Date.now()) {
  if (!tree) return tree;

  const runtimeByEq = new Map();
  (runtimeControllers || []).forEach((c) => {
    const id = String(c?.equipmentId || c?.mappedEquipmentId || "").trim();
    if (id) runtimeByEq.set(id, c);
  });

  function walk(node) {
    const children = (node.children || []).map(walk);
    const own =
      node.kind === "equipment" ? countActiveAlarmsForEquipment(alarms, node.id) : 0;
    const alarmCount = own + children.reduce((sum, child) => sum + (child.alarmCount || 0), 0);
    let commStatus = normalizeCommStatus(node.commStatus || node.equipmentCommStatus || node.status);
    if (node.kind === "equipment") {
      const rt = runtimeByEq.get(String(node.id));
      if (rt) {
        commStatus =
          rt.online === false
            ? "OFFLINE"
            : getEquipmentStatus({ lastSeenAt: rt.lastSeenAt, pollRateMs: rt.pollRateMs, now });
      }
    }
    return { ...node, children, alarmCount, commStatus };
  }

  return walk(tree);
}
