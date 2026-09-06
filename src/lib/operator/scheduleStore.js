/**
 * Client-side operator schedules until a schedules HTTP API exists.
 * Occupancy chip, schedule modal, and Schedules page share this store.
 */

const SCHEDULES_KEY = (siteId) => `legion.operator.schedules.v1.${siteId || "default"}`;
const OVERRIDE_KEY = (siteId, equipmentId) =>
  `legion.operator.occOverride.v1.${siteId || "default"}.${equipmentId || "none"}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
  return value;
}

export function loadSchedules(siteId) {
  const rows = readJson(SCHEDULES_KEY(siteId), []);
  return Array.isArray(rows) ? rows : [];
}

export function saveSchedules(siteId, schedules) {
  return writeJson(SCHEDULES_KEY(siteId), Array.isArray(schedules) ? schedules : []);
}

export function upsertSchedule(siteId, schedule) {
  const rows = loadSchedules(siteId);
  const id = schedule?.id;
  const next = id && rows.some((s) => s.id === id)
    ? rows.map((s) => (s.id === id ? { ...s, ...schedule } : s))
    : [{ ...schedule, id: id || `SCH-${Date.now()}` }, ...rows];
  saveSchedules(siteId, next);
  return next;
}

export function deleteSchedule(siteId, scheduleId) {
  const next = loadSchedules(siteId).filter((s) => s.id !== scheduleId);
  saveSchedules(siteId, next);
  return next;
}

/**
 * @returns {{ occupied: boolean, until: string, source?: string } | null}
 */
export function loadOccupancyOverride(siteId, equipmentId) {
  if (!equipmentId) return null;
  const row = readJson(OVERRIDE_KEY(siteId, equipmentId), null);
  if (!row || !row.until) return null;
  if (new Date(row.until).getTime() <= Date.now()) {
    clearOccupancyOverride(siteId, equipmentId);
    return null;
  }
  return row;
}

export function saveOccupancyOverride(siteId, equipmentId, override) {
  if (!equipmentId) return null;
  return writeJson(OVERRIDE_KEY(siteId, equipmentId), override);
}

export function clearOccupancyOverride(siteId, equipmentId) {
  try {
    localStorage.removeItem(OVERRIDE_KEY(siteId, equipmentId));
  } catch {
    /* ignore */
  }
}
