/**
 * Centralized chip/badge mapping for Legion Web.
 *
 * Color rules (NO exceptions):
 * - Red   = ALARM, CRITICAL, OFFLINE, UNACKED (bad/urgent)
 * - Green = OK, ACKED, ONLINE (good/confirmed)
 * - Yellow = WARN, WARNING (MAJOR renamed to WARNING)
 * - White/Gray = MINOR (neutral)
 * - No blue anywhere for chips/badges.
 */

const norm = (v) => String(v ?? "").trim().toLowerCase();

// Dot modifier for StatusDotLabel (red/green/yellow/neutral)
const DOT_RED = "legion-dot--red";
const DOT_GREEN = "legion-dot--green";
const DOT_YELLOW = "legion-dot--yellow";
const DOT_NEUTRAL = "legion-dot--neutral";

// ---- Severity ----
const SEVERITY_MAP = {
  critical: { label: "CRITICAL", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--sev-critical" },
  major: { label: "WARNING", dotModifier: DOT_YELLOW, variant: "warning", dotClass: "bg-warning", chipClass: "legion-chip--sev-warning" },
  warn: { label: "WARNING", dotModifier: DOT_YELLOW, variant: "warning", dotClass: "bg-warning", chipClass: "legion-chip--sev-warning" },
  warning: { label: "WARNING", dotModifier: DOT_YELLOW, variant: "warning", dotClass: "bg-warning", chipClass: "legion-chip--sev-warning" },
  minor: { label: "MINOR", dotModifier: DOT_NEUTRAL, variant: "secondary", dotClass: "bg-secondary", chipClass: "legion-chip--sev-minor" },
  info: { label: "INFO", dotModifier: DOT_NEUTRAL, variant: "secondary", dotClass: "bg-secondary", chipClass: "legion-chip--sev-minor" },
};

export function getSeverityMap(value) {
  const s = norm(value);
  if (s === "critical" || s === "crit") return SEVERITY_MAP.critical;
  if (s === "major" || s === "warn" || s === "warning") return SEVERITY_MAP.major;
  if (s === "minor" || s === "info" || s === "informational") return SEVERITY_MAP.minor;
  return SEVERITY_MAP.minor;
}

// ---- Status (equipment health, user status, comm) ----
const STATUS_MAP = {
  ok: { label: "OK", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--stat-ok" },
  normal: { label: "NORMAL", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--stat-ok" },
  online: { label: "ONLINE", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--stat-ok" },
  active: { label: "ACTIVE", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--stat-ok" },
  acked: { label: "ACKED", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--ack-acked" },
  enabled: { label: "ENABLED", dotModifier: DOT_GREEN, variant: "success", dotClass: "bg-success", chipClass: "legion-chip--stat-ok" },
  warn: { label: "WARN", dotModifier: DOT_YELLOW, variant: "warning", dotClass: "bg-warning", chipClass: "legion-chip--stat-warn" },
  warning: { label: "WARNING", dotModifier: DOT_YELLOW, variant: "warning", dotClass: "bg-warning", chipClass: "legion-chip--stat-warn" },
  alarm: { label: "ALARM", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-alarm" },
  fault: { label: "FAULT", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-alarm" },
  critical: { label: "CRITICAL", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-alarm" },
  offline: { label: "OFFLINE", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-offline" },
  down: { label: "OFFLINE", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-offline" },
  disabled: { label: "DISABLED", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--stat-offline" },
  unacked: { label: "UNACKED", dotModifier: DOT_RED, variant: "danger", dotClass: "bg-danger", chipClass: "legion-chip--ack-unacked" },
};

export function getStatusMap(value) {
  const s = norm(value);
  if (s === "ok" || s === "normal" || s === "online" || s === "active" || s === "enabled") return STATUS_MAP.ok;
  if (s === "acked") return STATUS_MAP.acked;
  if (s === "warn" || s === "warning" || s === "major") return STATUS_MAP.warn;
  if (s === "alarm" || s === "fault" || s === "critical") return STATUS_MAP.alarm;
  if (s === "offline" || s === "down" || s === "disabled") return STATUS_MAP.offline;
  if (s === "unacked") return STATUS_MAP.unacked;
  return STATUS_MAP.offline;
}

// ---- Ack (acknowledgment state) ----
export function getAckMap(acked) {
  return acked ? STATUS_MAP.acked : STATUS_MAP.unacked;
}

// ---- Alarm state (Active = red, History = green) ----
const ALARM_STATE_MAP = {
  active: { label: "ACTIVE", dotModifier: DOT_RED },
  history: { label: "HISTORY", dotModifier: DOT_GREEN },
};

export function getAlarmStateMap(value) {
  const s = norm(value);
  if (s === "active") return ALARM_STATE_MAP.active;
  return ALARM_STATE_MAP.history;
}

// ---- Role badges (no blue - avoid info/primary) ----
const ROLE_MAP = {
  admin: { variant: "warning", label: "Admin" },
  engineer: { variant: "secondary", label: "Engineer" },
  operator: { variant: "light", label: "Operator" },
  viewer: { variant: "secondary", label: "Viewer" },
};

export function getRoleMap(role) {
  const r = norm(role);
  return ROLE_MAP[r] ?? { variant: "dark", label: String(role || "") };
}

// ---- Event type badges (no blue) ----
const EVENT_TYPE_MAP = {
  command: { variant: "light" },
  comm: { variant: "warning" },
  schedule: { variant: "secondary" },
  system: { variant: "secondary" },
  user: { variant: "light" },
  device: { variant: "secondary" },
  alarm: { variant: "warning" },
};

export function getEventTypeMap(type) {
  const t = norm(type);
  return EVENT_TYPE_MAP[t] ?? { variant: "dark" };
}

// ---- Equipment type badges (no blue: no info, no primary) ----
const EQUIP_TYPE_MAP = {
  ahu: { variant: "secondary" },
  vav: { variant: "light" },
  oau: { variant: "warning" },
  fcu: { variant: "secondary" },
  pump: { variant: "secondary" },
};

export function getEquipTypeMap(type) {
  const t = norm(type);
  return EQUIP_TYPE_MAP[t] ?? { variant: "dark" };
}
