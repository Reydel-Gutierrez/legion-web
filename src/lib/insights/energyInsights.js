/**
 * Shared Insights energy math (mock-friendly). Used by Operator Insights dashboard.
 * - Runtime savings: hours per month equipment is off vs 24/7, from enabled schedules.
 * - kWh: sum of (k-factor kW × estimated daily run hours) across equipment.
 * User overrides for k-factors persist in localStorage.
 */

export const K_FACTOR_STORAGE_KEY = "legion.insights.kFactors.v1";

/** Default average draw when running (kW), by equipment family */
export const DEFAULT_KW_BY_EQUIP_TYPE = {
  AHU: 14,
  VAV: 0.38,
  FCU: 1.15,
  OAU: 3.2,
  CH: 42,
  CHWP: 3.8,
  EF: 0.85,
  HX: 0.55,
  Sensor: 0.04,
  DEFAULT: 2.0,
};

export function normalizeEquipType(type) {
  if (!type) return "DEFAULT";
  const t = String(type).toUpperCase();
  if (t.includes("AHU")) return "AHU";
  if (t.includes("VAV")) return "VAV";
  if (t.includes("FCU")) return "FCU";
  if (t.includes("OAU")) return "OAU";
  if (t.includes("CHWP") || t.includes("PUMP")) return "CHWP";
  if (t.includes("CH") && !t.includes("CHWP")) return "CH";
  if (t.includes("EF") || t.includes("EXHAUST")) return "EF";
  if (t.includes("HX")) return "HX";
  if (t.includes("SENSOR") || t.includes("CO-")) return "Sensor";
  return "DEFAULT";
}

export function getKwForType(equipType, mergedKFactors) {
  const key = normalizeEquipType(equipType);
  const table = mergedKFactors || DEFAULT_KW_BY_EQUIP_TYPE;
  return table[key] ?? table.DEFAULT ?? DEFAULT_KW_BY_EQUIP_TYPE.DEFAULT;
}

export function loadKFactorOverrides() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(K_FACTOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveKFactorOverrides(overrides) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(K_FACTOR_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

export function mergeKFactors(overrides) {
  return { ...DEFAULT_KW_BY_EQUIP_TYPE, ...overrides };
}

export function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr || "0:00").split(":").map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Length of [start, end) window in hours; supports overnight (end before start). */
export function dailyOccupiedHours(startTime, endTime) {
  let s = parseTimeToMinutes(startTime);
  let e = parseTimeToMinutes(endTime);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

/**
 * Weekly hours equipment is OFF vs running 24/7, for one schedule (occupied = ON window).
 * Assumes schedule only applies on listed days; other days fully "off" vs 24/7 baseline.
 */
export function weeklyUnscheduledOffHours(schedule) {
  if (!schedule.enabled) return 0;
  const occ = dailyOccupiedHours(schedule.startTime, schedule.endTime);
  const n = (schedule.days || []).length;
  if (n === 0) return 0;
  const offOnListedDays = (24 - occ) * n;
  const offOnOtherDays = (7 - n) * 24;
  return offOnListedDays + offOnOtherDays;
}

/**
 * Sum weekly "saved" off-hours across unique equipment (max per equipment if multiple schedules).
 */
export function aggregateWeeklyOffHoursFromSchedules(schedules) {
  const list = Array.isArray(schedules) ? schedules : [];
  const byEquipment = {};
  for (const s of list) {
    if (!s.enabled) continue;
    const w = weeklyUnscheduledOffHours(s);
    const key = s.equipment || s.id || "unknown";
    if (!byEquipment[key]) byEquipment[key] = [];
    byEquipment[key].push(w);
  }
  let total = 0;
  for (const key of Object.keys(byEquipment)) {
    total += Math.max(...byEquipment[key]);
  }
  return total;
}

/** Calibrates monthly hours to typical operator dashboard scale (mock tuning). */
export const RUNTIME_MONTHLY_CALIBRATION = 0.87;

/** Monthly equivalent hours (from weekly schedule math). */
export function monthlyRuntimeSavingsHoursFromSchedules(schedules) {
  const weekly = aggregateWeeklyOffHoursFromSchedules(schedules);
  return Math.round(((weekly * 52) / 12) * RUNTIME_MONTHLY_CALIBRATION);
}

/** Mean daily run hours from enabled schedules (average occupied window). */
export function meanDailyRunHoursFromSchedules(schedules) {
  const enabled = (schedules || []).filter((s) => s.enabled);
  if (enabled.length === 0) return 12;
  const sum = enabled.reduce((acc, s) => acc + dailyOccupiedHours(s.startTime, s.endTime), 0);
  return sum / enabled.length;
}

/**
 * Build equipment rows for kWh: prefer active-release equipment; else unique enabled schedules.
 */
export function buildEquipmentRowsForEnergy(releaseSnapshot, schedules) {
  const eqList = releaseSnapshot?.equipment;
  if (Array.isArray(eqList) && eqList.length > 0) {
    return eqList.map((e) => ({
      id: e.id,
      type: e.type || "DEFAULT",
      label: e.displayLabel || e.name || e.id,
    }));
  }
  const seen = new Set();
  const rows = [];
  for (const s of schedules || []) {
    if (!s.enabled) continue;
    const key = s.equipment || s.id;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: key,
      type: s.equipType || "AHU",
      label: s.equipment,
    });
  }
  if (rows.length === 0) {
    return [{ id: "placeholder", type: "AHU", label: "AHU-1" }];
  }
  return rows;
}

/**
 * Estimated kWh for "today" = total connected load × typical daily run × diversity.
 */
export function computeTodaysKwhEstimate(equipmentRows, mergedKFactors, meanDailyRunHours) {
  const diversity = 0.88;
  const totalKw = equipmentRows.reduce((sum, eq) => sum + getKwForType(eq.type, mergedKFactors), 0);
  const hours = Math.min(24, Math.max(4, meanDailyRunHours));
  return Math.round(totalKw * hours * diversity);
}

/** $/kWh for display estimates */
export const DEFAULT_ELECTRICITY_RATE_USD = 0.14;

export function computeEnergyCostUsd(kwhMonthEstimate, rateUsd = DEFAULT_ELECTRICITY_RATE_USD) {
  return Math.round(kwhMonthEstimate * rateUsd);
}

/** Rough lbs CO2 per kWh (grid average placeholder) */
export function computeCo2LbsFromKwh(kwh) {
  return Math.round(kwh * 0.85);
}

/**
 * kW breakdown by normalized type for charts.
 */
export function computeKwBreakdown(equipmentRows, mergedKFactors) {
  const map = {};
  for (const eq of equipmentRows) {
    const key = normalizeEquipType(eq.type);
    const kw = getKwForType(eq.type, mergedKFactors);
    if (!map[key]) map[key] = { type: key, count: 0, kw: 0 };
    map[key].count += 1;
    map[key].kw += kw;
  }
  return Object.values(map).sort((a, b) => b.kw - a.kw);
}

/**
 * Week-over-week % change for Today's kWh (deterministic from site + value).
 */
export function weekOverWeekPercentDelta(todaysKwh, siteId) {
  const seed = String(siteId || "default").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = ((seed % 17) - 8) / 100;
  const baseline = todaysKwh * (1.12 + jitter);
  const pct = baseline > 0 ? Math.round(((baseline - todaysKwh) / baseline) * 100) : 0;
  return Math.max(-40, Math.min(40, pct));
}

/**
 * Five-point trend for chart (relative units 0–100 for SVG).
 */
export function buildKwhTrendSeries(todaysKwh) {
  const base = Math.max(400, todaysKwh);
  const factors = [0.82, 0.88, 0.92, 0.97, 1.0];
  return factors.map((f, i) => ({
    label: i === 0 ? "-4 Wk" : i === 4 ? "Today" : `-${4 - i} Wk`,
    kwh: Math.round(base * f),
    x: 8 + i * 23,
    y: 100 - (base * f / (base * 1.25)) * 72,
  }));
}

export function efficiencyScoreFromMetrics({ monthlyRuntimeHours, todaysKwh, equipmentCount, devicesOffline }) {
  const runFactor = Math.min(18, monthlyRuntimeHours / 85);
  const kwhFactor = Math.min(12, todaysKwh / 400);
  const offPenalty = Math.min(15, (devicesOffline || 0) * 4);
  const raw = 58 + runFactor + kwhFactor * 0.4 - offPenalty * 0.3;
  return Math.max(40, Math.min(96, Math.round(raw)));
}

/**
 * Single snapshot for Insights dashboard (all derived values).
 */
export function computeInsightsSnapshot({
  siteId,
  activeDeployment,
  releaseSnapshot,
  schedules,
  mergedKFactors,
  summaryDevicesOffline = 0,
}) {
  const snap = releaseSnapshot ?? activeDeployment;
  const equipmentRows = buildEquipmentRowsForEnergy(snap, schedules);
  const meanRun = meanDailyRunHoursFromSchedules(schedules);
  const todaysKwh = computeTodaysKwhEstimate(equipmentRows, mergedKFactors, meanRun);
  const monthlyRuntimeHours = monthlyRuntimeSavingsHoursFromSchedules(schedules);
  const weekDeltaPct = weekOverWeekPercentDelta(todaysKwh, siteId);
  const monthlyKwh = Math.round(todaysKwh * 30);
  const energySavingsUsd = Math.round(monthlyKwh * DEFAULT_ELECTRICITY_RATE_USD * 0.26);
  const weeklySavingsUsd = Math.round(energySavingsUsd * 0.3);
  const yearlyCostImpactUsd = Math.round(energySavingsUsd * 12 * 5.15);
  const co2AvoidedLbs = computeCo2LbsFromKwh(monthlyKwh);
  const kwBreakdown = computeKwBreakdown(equipmentRows, mergedKFactors);
  const trendSeries = buildKwhTrendSeries(todaysKwh);
  const efficiencyScore = efficiencyScoreFromMetrics({
    monthlyRuntimeHours,
    todaysKwh,
    equipmentCount: equipmentRows.length,
    devicesOffline: summaryDevicesOffline,
  });
  const runtimeVsBaselinePct = Math.min(
    40,
    Math.max(10, Math.round(monthlyRuntimeHours / 28))
  );

  return {
    equipmentRows,
    meanDailyRunHours: meanRun,
    todaysKwh,
    monthlyRuntimeHours,
    weekDeltaPct,
    monthlyKwh,
    energySavingsUsd,
    weeklySavingsUsd,
    yearlyCostImpactUsd,
    co2AvoidedLbs,
    kwBreakdown,
    trendSeries,
    efficiencyScore,
    runtimeVsBaselinePct,
  };
}
