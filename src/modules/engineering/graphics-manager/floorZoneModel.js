/**
 * Floor zone metadata for interactive layout graphics (engineering + operator runtime).
 * Shapes keep type: "shape"; zone behavior is driven by zoneConfig.enabled.
 */

export const ZONE_RUNTIME_STATES = {
  NORMAL: "normal",
  COOLING: "cooling",
  HEATING: "heating",
  WARNING: "warning",
  ALARM: "alarm",
  OFFLINE: "offline",
};

const DEFAULT_STATE_STYLE = {
  fill: "rgba(64, 196, 255, 0.18)",
  fillOpacity: 1,
  borderColor: "rgba(64, 196, 255, 0.65)",
  glowColor: "rgba(64, 196, 255, 0.45)",
  glowIntensity: 0.35,
  pulse: false,
  labelColor: "#e8f7ff",
};

function stateStyle(overrides) {
  return { ...DEFAULT_STATE_STYLE, ...overrides };
}

export function createDefaultStateColors() {
  return {
    normal: stateStyle({
      fill: "rgba(64, 196, 255, 0.15)",
      borderColor: "rgba(64, 196, 255, 0.5)",
      glowColor: "rgba(64, 196, 255, 0.35)",
    }),
    cooling: stateStyle({
      fill: "rgba(52, 152, 219, 0.22)",
      borderColor: "rgba(93, 173, 226, 0.85)",
      glowColor: "rgba(52, 152, 219, 0.5)",
    }),
    heating: stateStyle({
      fill: "rgba(231, 76, 60, 0.2)",
      borderColor: "rgba(236, 112, 99, 0.85)",
      glowColor: "rgba(231, 76, 60, 0.45)",
    }),
    warning: stateStyle({
      fill: "rgba(241, 196, 15, 0.22)",
      borderColor: "rgba(245, 203, 92, 0.9)",
      glowColor: "rgba(241, 196, 15, 0.5)",
    }),
    alarm: stateStyle({
      fill: "rgba(192, 57, 43, 0.28)",
      borderColor: "rgba(231, 76, 60, 0.95)",
      glowColor: "rgba(231, 76, 60, 0.65)",
      pulse: true,
    }),
    offline: stateStyle({
      fill: "rgba(127, 140, 141, 0.25)",
      borderColor: "rgba(149, 165, 166, 0.7)",
      glowColor: "rgba(127, 140, 141, 0.3)",
    }),
    selected: stateStyle({
      fill: "rgba(13, 202, 240, 0.28)",
      borderColor: "rgba(13, 202, 240, 0.95)",
      glowColor: "rgba(13, 202, 240, 0.55)",
      glowIntensity: 0.55,
    }),
    hover: stateStyle({
      fill: "rgba(13, 202, 240, 0.2)",
      borderColor: "rgba(13, 202, 240, 0.75)",
      glowColor: "rgba(13, 202, 240, 0.5)",
      glowIntensity: 0.45,
    }),
  };
}

export function createDefaultWedgeFields() {
  return [
    { key: "zoneName", enabled: true },
    { key: "equipmentName", enabled: true },
    { key: "spaceTemp", enabled: true },
    { key: "setpoint", enabled: true },
    { key: "occupancy", enabled: true },
    { key: "alarmState", enabled: true },
    { key: "statusChip", enabled: true },
  ];
}

export function createDefaultZoneConfig() {
  return {
    enabled: true,
    zoneName: "New zone",
    zoneDescription: "",
    zoneType: "room",
    linkedEquipmentId: "",
    linkedEquipmentRoute: "",
    badgeIcon: "",
    wedgeEnabled: true,
    wedgePinnedByDefault: false,
    showGlassOverviewChip: true,
    hoverPreviewEnabled: true,
    collapseDelayMs: 900,
    wedgeCompact: false,
    wedgeMaxWidth: 280,
    wedgePlacement: "auto",
    visualStateSource: { mode: "point" },
    stateColors: createDefaultStateColors(),
    wedgeFields: createDefaultWedgeFields(),
    pointBindings: {
      spaceTemp: "",
      setpoint: "",
      occupancy: "",
      alarmState: "",
      mode: "",
      zoneStatus: "",
      comms: "",
    },
    runtimeActions: {
      allowOpenDetails: true,
      allowQuickAck: false,
      allowQuickCommand: false,
    },
  };
}

export const VISUAL_PRESETS = {
  cooling_zone: "Cooling Zone",
  heating_zone: "Heating Zone",
  normal_zone: "Normal Zone",
  alarm_zone: "Alarm Zone",
  offline_zone: "Offline Zone",
  neutral_blueprint: "Neutral Blueprint Zone",
};

export const WEDGE_PRESETS = {
  minimal: "Minimal",
  standard: "Standard",
  operator_summary: "Operator Summary",
  alarm_focus: "Alarm Focus",
};

export const DATA_PRESETS = {
  vav_zone: "VAV Zone",
  ahu_area: "AHU Area Summary",
  generic_room: "Generic Room",
  fcu_zone: "FCU Zone",
};

function pickStateColors(partial) {
  const base = createDefaultStateColors();
  Object.keys(partial).forEach((k) => {
    if (base[k] && partial[k]) base[k] = { ...base[k], ...partial[k] };
  });
  return base;
}

export function applyVisualPreset(presetKey) {
  switch (presetKey) {
    case "cooling_zone":
      return pickStateColors({
        normal: { fill: "rgba(52, 152, 219, 0.2)", borderColor: "rgba(93, 173, 226, 0.8)" },
        cooling: { fill: "rgba(41, 128, 185, 0.35)", borderColor: "rgba(133, 193, 233, 0.95)", glowIntensity: 0.55 },
      });
    case "heating_zone":
      return pickStateColors({
        normal: { fill: "rgba(231, 76, 60, 0.15)", borderColor: "rgba(236, 112, 99, 0.75)" },
        heating: { fill: "rgba(192, 57, 43, 0.32)", borderColor: "rgba(231, 76, 60, 0.95)", glowIntensity: 0.55 },
      });
    case "alarm_zone":
      return pickStateColors({
        alarm: { fill: "rgba(192, 57, 43, 0.4)", borderColor: "rgba(255, 87, 66, 1)", pulse: true, glowIntensity: 0.7 },
        warning: { fill: "rgba(241, 196, 15, 0.3)", borderColor: "rgba(245, 203, 92, 0.95)" },
      });
    case "offline_zone":
      return pickStateColors({
        offline: { fill: "rgba(100, 100, 110, 0.35)", borderColor: "rgba(160, 160, 170, 0.6)" },
        normal: { fill: "rgba(90, 90, 98, 0.2)", borderColor: "rgba(140, 140, 150, 0.5)" },
      });
    case "neutral_blueprint":
      return pickStateColors({
        normal: { fill: "rgba(200, 210, 220, 0.08)", borderColor: "rgba(180, 190, 200, 0.35)", glowIntensity: 0.15 },
        hover: { fill: "rgba(200, 210, 220, 0.14)", borderColor: "rgba(200, 210, 220, 0.5)" },
      });
    case "normal_zone":
    default:
      return createDefaultStateColors();
  }
}

export function applyWedgePreset(presetKey) {
  const base = createDefaultZoneConfig();
  switch (presetKey) {
    case "minimal":
      return {
        ...base,
        wedgeFields: createDefaultWedgeFields().map((f) => ({
          ...f,
          enabled: ["zoneName", "equipmentName"].includes(f.key),
        })),
        wedgeCompact: true,
        wedgeMaxWidth: 220,
      };
    case "operator_summary":
      return {
        ...base,
        wedgeFields: createDefaultWedgeFields().map((f) => ({ ...f, enabled: true })),
        wedgeCompact: false,
        wedgeMaxWidth: 320,
      };
    case "alarm_focus":
      return {
        ...base,
        wedgeFields: createDefaultWedgeFields().map((f) => ({
          ...f,
          enabled: ["zoneName", "equipmentName", "alarmState", "statusChip"].includes(f.key),
        })),
        wedgeCompact: false,
      };
    case "standard":
    default:
      return {
        ...base,
        wedgeFields: createDefaultWedgeFields(),
        wedgeCompact: false,
        wedgeMaxWidth: 280,
      };
  }
}

export function applyDataPreset(presetKey) {
  const pb = {
    spaceTemp: "",
    setpoint: "",
    occupancy: "",
    alarmState: "",
    mode: "",
    zoneStatus: "",
    comms: "",
  };
  switch (presetKey) {
    case "vav_zone":
      return { pointBindings: pb, zoneType: "vav" };
    case "ahu_area":
      return { pointBindings: pb, zoneType: "ahu" };
    case "fcu_zone":
      return { pointBindings: pb, zoneType: "fcu" };
    case "generic_room":
    default:
      return { pointBindings: pb, zoneType: "room" };
  }
}

/**
 * Merge partial zone config onto existing (e.g. from JSON).
 * @param {object | undefined} existing
 * @param {object} patch
 */
export function mergeZoneConfig(existing, patch) {
  const def = createDefaultZoneConfig();
  const cur = { ...def, ...(existing || {}) };
  const next = { ...cur, ...patch };
  if (patch.stateColors) {
    next.stateColors = { ...createDefaultStateColors(), ...(cur.stateColors || {}), ...patch.stateColors };
  }
  if (patch.pointBindings) {
    next.pointBindings = { ...def.pointBindings, ...(cur.pointBindings || {}), ...patch.pointBindings };
  }
  if (patch.runtimeActions) {
    next.runtimeActions = { ...def.runtimeActions, ...(cur.runtimeActions || {}), ...patch.runtimeActions };
  }
  if (patch.wedgeFields) {
    next.wedgeFields = patch.wedgeFields;
  }
  if (patch.visualStateSource) {
    next.visualStateSource = { ...def.visualStateSource, ...patch.visualStateSource };
  }
  return next;
}

/**
 * @param {object} zoneConfig
 * @param {string} stateKey — normal | cooling | … | hover | selected
 */
export function getStyleForZoneState(zoneConfig, stateKey) {
  const colors = zoneConfig?.stateColors || createDefaultStateColors();
  const s = colors[stateKey] || colors.normal || DEFAULT_STATE_STYLE;
  const fillOp = s.fillOpacity != null ? Number(s.fillOpacity) : 1;
  const glow = Number(s.glowIntensity || 0) * 40;
  const glowColor = s.glowColor || "transparent";
  const boxShadow =
    glow > 0 ? `0 0 ${glow}px ${glowColor}, inset 0 0 ${glow * 0.4}px ${glowColor}` : undefined;
  return {
    fill: s.fill,
    stroke: s.borderColor,
    opacity: fillOp,
    boxShadow,
    labelColor: s.labelColor,
    pulse: !!s.pulse,
  };
}

/**
 * Simulated / derived runtime state for preview when live points are missing.
 * @param {object} zoneConfig
 * @param {Record<string, string>} pointValuesByKey — keys match pointBindings fields
 */
export function deriveZoneVisualState(zoneConfig, pointValuesByKey = {}) {
  const pb = zoneConfig?.pointBindings || {};
  const alarm =
    pointValuesByKey.alarmState ||
    (pb.alarmState && pointValuesByKey[pb.alarmState] ? pointValuesByKey[pb.alarmState] : "");
  const comms =
    pointValuesByKey.comms ||
    (pb.comms && pointValuesByKey[pb.comms] ? pointValuesByKey[pb.comms] : "");
  const mode =
    pointValuesByKey.mode || (pb.mode && pointValuesByKey[pb.mode] ? pointValuesByKey[pb.mode] : "");

  const alarmStr = String(alarm || "").toLowerCase();
  if (alarmStr.includes("alarm") || alarmStr.includes("fault")) return ZONE_RUNTIME_STATES.ALARM;
  if (alarmStr.includes("warn")) return ZONE_RUNTIME_STATES.WARNING;

  const commsStr = String(comms || "").toLowerCase();
  if (commsStr.includes("offline") || commsStr.includes("down") || commsStr === "false" || commsStr === "0")
    return ZONE_RUNTIME_STATES.OFFLINE;

  const modeStr = String(mode || "").toLowerCase();
  if (modeStr.includes("cool")) return ZONE_RUNTIME_STATES.COOLING;
  if (modeStr.includes("heat")) return ZONE_RUNTIME_STATES.HEATING;

  return ZONE_RUNTIME_STATES.NORMAL;
}

export function buildSimulatedPointValues(zoneConfig) {
  return {
    spaceTemp: "72.0°F",
    setpoint: "74°F",
    occupancy: "Occupied",
    alarmState: "Normal",
    mode: "Cooling",
    comms: "Online",
    zoneStatus: "Normal",
  };
}

/** Stable pseudo-live temps per zone id so multiple zones don’t all read identical in preview. */
export function buildSimulatedPointValuesForObjectId(objectId) {
  const base = buildSimulatedPointValues();
  if (!objectId || typeof objectId !== "string") return base;
  let h = 0;
  for (let i = 0; i < objectId.length; i += 1) {
    h = (Math.imul(31, h) + objectId.charCodeAt(i)) | 0;
  }
  const t = 69 + (Math.abs(h) % 7);
  return {
    ...base,
    spaceTemp: `${t}.0°F`,
    setpoint: `${Math.min(t + 2, 78)}°F`,
  };
}

export function isZoneShape(obj) {
  return obj?.type === "shape" && obj?.zoneConfig?.enabled === true;
}

/**
 * Resolve zone binding keys to display strings using Graphics Manager point list.
 * @param {object} zoneConfig
 * @param {Array<{id: string, displayName?: string, displayValue?: *, presentValue?: *, units?: string}>} availablePoints
 */
export function resolveZonePointValuesForDisplay(zoneConfig, availablePoints) {
  const pb = zoneConfig?.pointBindings || {};
  const byId = {};
  (availablePoints || []).forEach((p) => {
    if (p?.id) byId[p.id] = p;
  });
  const fmt = (p) => {
    if (!p) return null;
    const dv = p.displayValue ?? p.presentValue;
    if (dv == null) return p.valueState === "offline" ? "Offline" : "—";
    if (typeof dv === "number") return `${dv}${p.units || ""}`;
    return String(dv);
  };
  const out = {};
  Object.entries(pb).forEach(([key, pointId]) => {
    if (!pointId) return;
    out[key] = fmt(byId[pointId]);
  });
  return out;
}

export function fieldEnabled(wedgeFields, key) {
  const row = (wedgeFields || []).find((f) => f.key === key);
  return row ? row.enabled !== false : true;
}
