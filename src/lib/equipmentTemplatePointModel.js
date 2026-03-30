/**
 * Canonical equipment template point model + migration helpers.
 * Persisted shape: { id, label, key, expectedType, commandType, commandConfig, mappingHint, notes }
 * Reads also accept legacy fields: pointLabel, pointKey, referenceId, required, expectedObjectType.
 */

export const COMMAND_TYPES = ["none", "numeric", "percentage", "boolean", "enum"];

export const COMMAND_TYPE_OPTIONS = [
  { value: "none", label: "None (read-only)" },
  { value: "numeric", label: "Numeric" },
  { value: "percentage", label: "Percentage" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
];

/** Allowed logical point keys: no spaces; letters, digits, hyphen, underscore, period. */
export const TEMPLATE_POINT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * @param {string} k
 * @returns {boolean}
 */
export function isValidTemplatePointKey(k) {
  const s = String(k || "").trim();
  if (!s) return false;
  if (/\s/.test(s)) return false;
  return TEMPLATE_POINT_KEY_PATTERN.test(s);
}

/**
 * Trim for persistence; caller should validate with isValidTemplatePointKey first.
 * @param {string} k
 */
export function sanitizeTemplatePointKeyForSave(k) {
  return String(k != null ? k : "").trim();
}

/**
 * "Supply Air Temp" -> supplyAirTemp (legacy fallback when no explicit key is stored)
 */
export function labelToAutoKey(label) {
  const s = (label || "").trim();
  if (!s) return "";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts
    .map((word, i) => {
      const alnum = word.replace(/[^a-zA-Z0-9]/g, "");
      if (!alnum) return "";
      const lower = alnum.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function inferLegacyCommandType(expectedObjectType, units) {
  const et = String(expectedObjectType || "AI").toUpperCase();
  const u = String(units || "").trim();
  if (["MSV", "MSI", "MV", "MSO"].includes(et)) return "enum";
  if (et === "AO" || et === "AV") return u === "%" ? "percentage" : "numeric";
  if (et === "BO" || et === "BV") return "boolean";
  return "none";
}

export function defaultCommandConfig(commandType, { units } = {}) {
  switch (commandType) {
    case "percentage":
      return { min: 0, max: 100, step: 1, unit: "%" };
    case "numeric": {
      const unit = units != null && units !== "" ? units : "";
      return { min: null, max: null, step: 1, unit };
    }
    case "boolean":
      return { offLabel: "Off", onLabel: "On" };
    case "enum":
      return { options: [] };
    default:
      return null;
  }
}

function mergeNumericLike(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const numOrNull = (v, fallback) => {
    if (v === undefined || v === "") return fallback;
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    min: numOrNull(patch.min, base.min),
    max: numOrNull(patch.max, base.max),
    step: numOrNull(patch.step, base.step),
    unit: patch.unit !== undefined ? String(patch.unit) : base.unit,
  };
}

function sanitizeNumericConfig(cfg, fallbackUnit) {
  const base = defaultCommandConfig("numeric", { units: fallbackUnit });
  const m = mergeNumericLike(base, cfg || {});
  const out = { ...m };
  if (Number.isNaN(out.min)) out.min = null;
  if (Number.isNaN(out.max)) out.max = null;
  if (Number.isNaN(out.step)) out.step = 1;
  return out;
}

function sanitizePercentageConfig(cfg) {
  const base = defaultCommandConfig("percentage");
  const m = mergeNumericLike(base, cfg || {});
  return {
    min: Number.isFinite(m.min) ? m.min : 0,
    max: Number.isFinite(m.max) ? m.max : 100,
    step: Number.isFinite(m.step) ? m.step : 1,
    unit: m.unit || "%",
  };
}

function sanitizeBooleanConfig(cfg) {
  const b = cfg && typeof cfg === "object" ? cfg : {};
  return {
    offLabel: (b.offLabel != null && String(b.offLabel).trim()) ? String(b.offLabel).trim() : "Off",
    onLabel: (b.onLabel != null && String(b.onLabel).trim()) ? String(b.onLabel).trim() : "On",
  };
}

function sanitizeEnumConfig(cfg) {
  const raw = cfg && typeof cfg === "object" && Array.isArray(cfg.options) ? cfg.options : [];
  const options = raw
    .map((o) => ({
      label: String(o?.label != null ? o.label : "").trim(),
      value: o?.value,
    }))
    .filter((o) => o.label.length > 0);
  return { options };
}

/**
 * @param {string} commandType
 * @param {*} commandConfig
 * @param {{ units?: string }} [ctx]
 */
export function sanitizeCommandConfigForSave(commandType, commandConfig, ctx = {}) {
  if (commandType === "none") return null;
  if (commandType === "numeric") return sanitizeNumericConfig(commandConfig, ctx.units);
  if (commandType === "percentage") return sanitizePercentageConfig(commandConfig);
  if (commandType === "boolean") return sanitizeBooleanConfig(commandConfig);
  if (commandType === "enum") return sanitizeEnumConfig(commandConfig);
  return null;
}

/**
 * Full normalization for runtime (templates, mapping, operator).
 * @param {object} raw
 * @returns {object} canonical fields + compatibility aliases (displayName, pointKey, expectedObjectType, …)
 */
export function normalizeTemplatePointForRuntime(raw) {
  if (!raw || typeof raw !== "object") return null;
  const label = String(raw.label != null ? raw.label : raw.pointLabel || "").trim();
  const keyRaw = String(raw.key != null ? raw.key : raw.pointKey || "").trim();
  const key = keyRaw || labelToAutoKey(label);
  const expectedType = String(raw.expectedType || raw.expectedObjectType || "AI").trim() || "AI";
  const mappingHint = raw.mappingHint != null ? String(raw.mappingHint).trim() : "";
  const legacyRef = raw.referenceId != null ? String(raw.referenceId).trim() : "";
  const hint = mappingHint || legacyRef || null;

  let commandType = raw.commandType;
  if (!COMMAND_TYPES.includes(commandType)) {
    commandType = inferLegacyCommandType(expectedType, raw.units);
  }

  let commandConfig = raw.commandConfig;
  if (commandConfig === undefined || commandConfig === null) {
    commandConfig = defaultCommandConfig(commandType, { units: raw.units });
  } else {
    commandConfig = sanitizeCommandConfigForSave(commandType, commandConfig, { units: raw.units });
  }

  const unitsTop =
    raw.units != null && String(raw.units).trim()
      ? String(raw.units).trim()
      : commandConfig && commandConfig.unit != null
        ? String(commandConfig.unit)
        : "";

  const writable = commandType !== "none";

  const id = raw.id != null ? String(raw.id) : "";

  return {
    id,
    label,
    key,
    expectedType,
    commandType,
    commandConfig,
    mappingHint: hint,
    notes: raw.notes != null && String(raw.notes).trim() ? String(raw.notes).trim() : raw.description != null && String(raw.description).trim() ? String(raw.description).trim() : null,
    units: unitsTop,
    writable,
    // compatibility for mockPointMappingData / graphics
    displayName: label,
    pointKey: key,
    pointLabel: label,
    expectedObjectType: expectedType,
    referenceId: hint || key,
    required: raw.required === true,
    pointCategory: raw.pointCategory || "sensor",
    description: raw.notes || raw.description || "",
  };
}

/**
 * Editor row shape for template points (Point = key, Point description = label).
 */
export function templatePointToEditorRow(p) {
  const n = normalizeTemplatePointForRuntime(p) || {};
  const id = n.id || p?.id || `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const label = n.label || "";
  let key = "";
  if (p && typeof p === "object") {
    const rawK = p.key != null ? p.key : p.pointKey;
    if (rawK != null && String(rawK).trim() !== "") {
      key = sanitizeTemplatePointKeyForSave(rawK);
    }
  }
  if (!key) key = sanitizeTemplatePointKeyForSave(n.key) || "";
  let commandType = n.commandType || "none";
  let commandConfig = n.commandConfig ?? defaultCommandConfig(commandType, { units: n.units });
  if (commandType === "percentage" && (!commandConfig || typeof commandConfig !== "object")) {
    commandConfig = defaultCommandConfig("percentage");
  }
  return {
    id,
    label,
    key,
    expectedType: n.expectedType || "AI",
    commandType,
    commandConfig,
    mappingHint: n.mappingHint != null && n.mappingHint !== "null" ? String(n.mappingHint) : "",
    notes: n.notes || "",
  };
}

export function validateTemplatePointRow(p) {
  const err = {};
  const keyRaw = sanitizeTemplatePointKeyForSave(p.key);
  if (!keyRaw) err.key = "Required";
  else if (!isValidTemplatePointKey(keyRaw)) {
    err.key = "Use letters, numbers, - _ . only; no spaces.";
  }
  if (!(p.label || "").trim()) err.label = "Required";
  if (!(p.expectedType || "").trim()) err.expectedType = "Required";
  if (!(p.commandType || "").trim()) err.commandType = "Required";
  if (p.commandType === "enum") {
    const opts = p.commandConfig?.options;
    if (!Array.isArray(opts) || opts.length === 0) {
      err.commandConfig = "Add at least one enum option";
    }
  }
  return err;
}

/**
 * Mock / unbound placeholder for operator and graphics when no live value exists.
 * @param {object} tp - normalized template point (see normalizeTemplatePointForRuntime)
 */
export function placeholderPresentValueForTemplatePoint(tp) {
  if (!tp) return "—";
  const ct = tp.commandType || "none";
  if (ct === "enum") {
    const opts = tp.commandConfig?.options;
    if (opts && opts[0] && opts[0].value !== undefined) return opts[0].value;
    return "—";
  }
  if (ct === "boolean") return "—";
  if (ct === "percentage" || ct === "numeric") {
    const u = (tp.commandConfig && tp.commandConfig.unit) || tp.units || "";
    if (u === "°F" || u === "°C") return 72;
    if (u === "%") return 50;
    if (String(u).toLowerCase() === "cfm") return 400;
    return 0;
  }
  const u = tp.units || "";
  const et = String(tp.expectedObjectType || tp.expectedType || "AI").toUpperCase();
  if (et === "AI" || et === "AV") {
    if (u === "°F" || u === "°C") return 72;
    if (u === "%") return 50;
    if (u === "CFM") return 400;
  }
  return "—";
}

/**
 * Format a live or placeholder value for operator workspace / detail readout.
 * @param {*} displayValue
 * @param {object} tp - normalized template point
 */
export function formatOperatorWorkspaceValue(displayValue, tp) {
  if (displayValue === null || displayValue === undefined) return "—";
  if (displayValue === "—") return "—";
  const ct = (tp && tp.commandType) || "none";
  if (ct === "enum" && tp.commandConfig?.options) {
    const match = tp.commandConfig.options.find((o) => String(o.value) === String(displayValue));
    if (match) return match.label;
  }
  const cfgUnit =
    tp.commandConfig &&
    tp.commandConfig.unit !== undefined &&
    tp.commandConfig.unit !== null &&
    String(tp.commandConfig.unit).trim() !== ""
      ? String(tp.commandConfig.unit).trim()
      : "";
  const topUnit = (tp.units || "").trim();
  const u = cfgUnit || topUnit;
  if (u) return `${displayValue} ${u}`.trim();
  return String(displayValue);
}
