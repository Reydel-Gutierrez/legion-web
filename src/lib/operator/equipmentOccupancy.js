import { parseTimeToMinutes } from "../insights/energyInsights";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const OCCUPANCY_POINT_KEYS = new Set([
  "OCCUPIED",
  "OCCUPANCY",
  "OCC",
  "OCCMODE",
  "OCCUPANCYMODE",
  "OCCUPANCYSTATUS",
  "OCCSTATUS",
]);

function compactKey(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeDays(days) {
  if (Array.isArray(days)) return days.map(String);
  if (days && typeof days === "object") {
    return Object.keys(days).filter((key) => days[key]);
  }
  return [];
}

export function occupancyLabelFromValue(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s || s === "—" || s === "-" || s === "null" || s === "undefined") return null;
  if (["occupied", "true", "1", "on", "active", "yes"].includes(s)) return "Occupied";
  if (["unoccupied", "false", "0", "off", "inactive", "no"].includes(s)) return "Unoccupied";
  if (s.includes("unoccup")) return "Unoccupied";
  if (s.includes("occup")) return "Occupied";
  return null;
}

export function findOccupancyPoint(points) {
  return (points || []).find((p) => {
    const keys = [p.pointKey, p.pointCode, p.pointName, p.pointDescription, p.pointId].map(compactKey);
    return keys.some((k) => OCCUPANCY_POINT_KEYS.has(k));
  });
}

export function scheduleMatchesEquipment(schedule, equipment) {
  if (!schedule || !equipment) return false;
  if (schedule.equipmentId != null && String(schedule.equipmentId).trim()) {
    return String(schedule.equipmentId) === String(equipment.id);
  }
  const schedName = normName(schedule.equipment);
  if (!schedName) return false;
  const names = [equipment.displayLabel, equipment.name, equipment.code, equipment.controllerCode]
    .map(normName)
    .filter(Boolean);
  return names.includes(schedName);
}

function actionMeansOccupied(action) {
  const s = String(action || "Occupied").toLowerCase();
  if (s.includes("unoccup") || s.includes("setback") || s === "off") return false;
  return true;
}

export function isScheduleActiveAt(schedule, now) {
  if (!schedule || schedule.enabled === false) return false;
  const days = normalizeDays(schedule.days);
  const date = now instanceof Date ? now : new Date(now);
  const dayKey = DAY_KEYS[date.getDay()];
  const prevKey = DAY_KEYS[(date.getDay() + 6) % 7];
  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (end <= start) {
    if (days.includes(dayKey) && minutes >= start) return true;
    if (days.includes(prevKey) && minutes < end) return true;
    return false;
  }
  if (!days.includes(dayKey)) return false;
  return minutes >= start && minutes < end;
}

function matchingSchedules(schedules, equipment) {
  return (schedules || []).filter(
    (s) => s && s.enabled !== false && scheduleMatchesEquipment(s, equipment)
  );
}

function occupiedFromSchedules(matching, now) {
  return matching.some((s) => isScheduleActiveAt(s, now) && actionMeansOccupied(s.action));
}

function formatClock(date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDayClock(date) {
  const day = DAY_KEYS[date.getDay()];
  return `${day} ${formatClock(date)}`;
}

/**
 * Occupancy for a unit: temporary override, then enabled schedule windows, then an occupancy live point.
 * @returns {{ occupied: boolean, label: "Occupied" | "Unoccupied", source: "override" | "schedule" | "point" | "none", until?: string|null }}
 */
export function resolveEquipmentOccupancy({
  schedules,
  equipment,
  now = new Date(),
  occupancyPointValue = null,
  override = null,
} = {}) {
  const at = now instanceof Date ? now : new Date(now);
  if (override?.until && new Date(override.until).getTime() > at.getTime()) {
    const occupied = Boolean(override.occupied);
    return {
      occupied,
      label: occupied ? "Occupied" : "Unoccupied",
      source: "override",
      until: override.until,
    };
  }

  const matching = matchingSchedules(schedules, equipment);

  if (matching.length > 0) {
    const occupied = occupiedFromSchedules(matching, at);
    return {
      occupied,
      label: occupied ? "Occupied" : "Unoccupied",
      source: "schedule",
    };
  }

  const fromPoint = occupancyLabelFromValue(occupancyPointValue);
  if (fromPoint) {
    return {
      occupied: fromPoint === "Occupied",
      label: fromPoint,
      source: "point",
    };
  }

  return { occupied: false, label: "Unoccupied", source: "none" };
}

function windowOnDay(schedule, dayKey) {
  const days = normalizeDays(schedule.days);
  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  const overnight = end <= start;
  if (days.includes(dayKey)) {
    return {
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      action: schedule.action || "Occupied",
      overnight,
      name: schedule.name || "",
    };
  }
  return null;
}

/**
 * Occupied windows that apply to the calendar day of `now`.
 */
export function getTodayScheduleWindows(schedules, equipment, now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  const dayKey = DAY_KEYS[at.getDay()];
  const prevKey = DAY_KEYS[(at.getDay() + 6) % 7];
  const matching = matchingSchedules(schedules, equipment);
  const out = [];
  matching.forEach((s) => {
    const today = windowOnDay(s, dayKey);
    if (today) out.push({ ...today, continuesFromPrevDay: false });
    const start = parseTimeToMinutes(s.startTime);
    const end = parseTimeToMinutes(s.endTime);
    if (end <= start && normalizeDays(s.days).includes(prevKey)) {
      out.push({
        startTime: "00:00",
        endTime: s.endTime,
        action: s.action || "Occupied",
        overnight: false,
        name: s.name || "",
        continuesFromPrevDay: true,
      });
    }
  });
  return out;
}

/**
 * @returns {{ at: Date, occupied: boolean, label: string } | null}
 */
export function getNextOccupancyChange(schedules, equipment, now = new Date(), override = null) {
  const matching = matchingSchedules(schedules, equipment);
  if (matching.length === 0) return null;
  const at = now instanceof Date ? now : new Date(now);
  const startMs = at.getTime();
  const events = new Set();
  const overrideUntil = override?.until ? new Date(override.until).getTime() : NaN;
  if (overrideUntil > startMs) events.add(overrideUntil);

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const day = new Date(at.getFullYear(), at.getMonth(), at.getDate() + dayOffset);
    const dayKey = DAY_KEYS[day.getDay()];
    matching.forEach((s) => {
      const days = normalizeDays(s.days);
      const startMin = parseTimeToMinutes(s.startTime);
      const endMin = parseTimeToMinutes(s.endTime);
      const overnight = endMin <= startMin;
      const addEvent = (minutes) => {
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
        when.setMinutes(minutes);
        if (when.getTime() <= startMs) return;
        events.add(when.getTime());
      };
      if (days.includes(dayKey)) {
        addEvent(startMin);
        if (!overnight) addEvent(endMin);
      }
      const prevKey = DAY_KEYS[(day.getDay() + 6) % 7];
      if (overnight && days.includes(prevKey)) {
        addEvent(endMin);
      }
    });
  }

  const occupiedAt = (ms) => ms < overrideUntil
    ? Boolean(override.occupied)
    : occupiedFromSchedules(matching, new Date(ms));
  for (const ms of [...events].sort((a, b) => a - b)) {
    const occupied = occupiedAt(ms);
    if (occupied !== occupiedAt(ms - 1)) {
      return { at: new Date(ms), occupied, label: occupied ? "Occupied" : "Unoccupied" };
    }
  }
  return null;
}

export function formatNextOccupancyChange(next) {
  if (!next) return "No upcoming change";
  return `${next.label} at ${formatDayClock(next.at)}`;
}

/**
 * Weekly grid: day key → window summaries.
 */
export function getWeeklySchedule(schedules, equipment) {
  const matching = matchingSchedules(schedules, equipment);
  const byDay = {};
  DAY_KEYS.forEach((d) => {
    byDay[d] = [];
  });
  matching.forEach((s) => {
    normalizeDays(s.days).forEach((day) => {
      if (!byDay[day]) return;
      byDay[day].push({
        startTime: s.startTime,
        endTime: s.endTime,
        action: s.action || "Occupied",
        name: s.name || "",
      });
    });
  });
  return { days: DAY_KEYS, byDay };
}

export { DAY_KEYS };
