/**
 * Legion starter equipment templates — canonical point model matches frontend
 * `equipmentTemplatePointModel` / EquipmentTemplateEditorPanel persisted shape:
 * { id, label, key, pointLabel, pointKey, expectedType, commandType, commandConfig, mappingHint, notes }
 *
 * Used for:
 * - Prisma GlobalEquipmentTemplate seed (company library)
 * - ensureGlobalEquipmentStartersInDb (global library API)
 *
 * Site project Template Library starts empty; users import from the global library when needed.
 */

/** Stable UUIDs for idempotent GlobalEquipmentTemplate upserts */
const GLOBAL_IDS = {
  AHU: 'e0000001-0000-4000-8000-000000000001',
  VAV_CLG_ONLY: 'e0000001-0000-4000-8000-000000000002',
  VAV_HTG: 'e0000001-0000-4000-8000-000000000003',
  FCU: 'e0000001-0000-4000-8000-000000000004',
  RTU: 'e0000001-0000-4000-8000-000000000005',
};

function pt(key, label, expectedType, commandType, commandConfig = null, notes = null) {
  const id = `legion-pt-${key}`;
  return {
    id,
    key,
    pointKey: key,
    label,
    pointLabel: label,
    expectedType,
    commandType,
    commandConfig,
    mappingHint: null,
    notes,
  };
}

/** Points only (shared by global JSON column and site clones). */
const POINTS = {
  AHU: [
    pt('supplyAirTemp', 'Supply Air Temperature', 'AI', 'none', null),
    pt('returnAirTemp', 'Return Air Temperature', 'AI', 'none', null),
    pt('outdoorAirTemp', 'Outdoor Air Temperature', 'AI', 'none', null),
    pt('mixedAirTemp', 'Mixed Air Temperature', 'AI', 'none', null),
    pt('systemEnable', 'System Enable', 'BO', 'boolean', { offLabel: 'Off', onLabel: 'On' }),
    pt('occupancyMode', 'Occupancy Mode', 'MSV', 'enum', {
      options: [
        { label: 'Off', value: 0 },
        { label: 'Occupied', value: 1 },
        { label: 'Unoccupied', value: 2 },
        { label: 'Bypass', value: 3 },
      ],
    }),
    pt('supplyAirTempSetpoint', 'Supply Air Temp Setpoint', 'AV', 'numeric', {
      min: 55,
      max: 75,
      step: 0.5,
      unit: '°F',
    }),
    pt('staticPressureSetpoint', 'Static Pressure Setpoint', 'AV', 'numeric', {
      min: 0.5,
      max: 3,
      step: 0.1,
      unit: 'in.w.g',
    }),
    pt('supplyFanStatus', 'Supply Fan Status', 'BI', 'none', null),
    pt('filterStatus', 'Filter Status', 'BI', 'none', null),
    pt('alarmStatus', 'Alarm Status', 'BV', 'none', null),
    pt('chilledWaterValve', 'Chilled Water Valve Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
    pt('supplyFanSpeed', 'Supply Fan Speed Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  ],
  VAV_CLG_ONLY: [
    pt('zoneTemp', 'Zone Temperature', 'AI', 'none', null),
    pt('dischargeAirTemp', 'Discharge Air Temperature', 'AI', 'none', null),
    pt('airflow', 'Airflow', 'AI', 'none', null),
    pt('coolingSetpoint', 'Cooling Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('airflowSetpoint', 'Airflow Setpoint', 'AV', 'numeric', {
      min: 0,
      max: 2000,
      step: 50,
      unit: 'CFM',
    }),
    pt('damperPosition', 'Damper Position', 'AI', 'none', null),
    pt('occupancyStatus', 'Occupancy Status', 'BV', 'none', null),
    pt('damperCommand', 'Damper Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  ],
  VAV_HTG: [
    pt('zoneTemp', 'Zone Temperature', 'AI', 'none', null),
    pt('dischargeAirTemp', 'Discharge Air Temperature', 'AI', 'none', null),
    pt('airflow', 'Airflow', 'AI', 'none', null),
    pt('coolingSetpoint', 'Cooling Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('heatingSetpoint', 'Heating Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('airflowSetpoint', 'Airflow Setpoint', 'AV', 'numeric', {
      min: 0,
      max: 2000,
      step: 50,
      unit: 'CFM',
    }),
    pt('damperPosition', 'Damper Position', 'AI', 'none', null),
    pt('reheatStatus', 'Reheat Status', 'BI', 'none', null),
    pt('occupancyStatus', 'Occupancy Status', 'BV', 'none', null),
    pt('damperCommand', 'Damper Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
    pt('reheatValve', 'Reheat Valve Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  ],
  FCU: [
    pt('zoneTemp', 'Zone Temperature', 'AI', 'none', null),
    pt('dischargeAirTemp', 'Discharge Air Temperature', 'AI', 'none', null),
    pt('systemEnable', 'System Enable', 'BO', 'boolean', { offLabel: 'Off', onLabel: 'On' }),
    pt('fanSpeed', 'Fan Speed', 'MSV', 'enum', {
      options: [
        { label: 'Off', value: 0 },
        { label: 'Low', value: 1 },
        { label: 'Medium', value: 2 },
        { label: 'High', value: 3 },
      ],
    }),
    pt('coolingSetpoint', 'Cooling Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('heatingSetpoint', 'Heating Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('fanStatus', 'Fan Status', 'BI', 'none', null),
    pt('alarmStatus', 'Alarm Status', 'BV', 'none', null),
    pt('chilledWaterValve', 'Chilled Water Valve', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
    pt('heatingValve', 'Heating Valve', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  ],
  RTU: [
    pt('supplyAirTemp', 'Supply Air Temperature', 'AI', 'none', null),
    pt('returnAirTemp', 'Return Air Temperature', 'AI', 'none', null),
    pt('outdoorAirTemp', 'Outdoor Air Temperature', 'AI', 'none', null),
    pt('systemEnable', 'System Enable', 'BO', 'boolean', { offLabel: 'Off', onLabel: 'On' }),
    pt('occupancyMode', 'Occupancy Mode', 'MSV', 'enum', {
      options: [
        { label: 'Off', value: 0 },
        { label: 'Occupied', value: 1 },
        { label: 'Unoccupied', value: 2 },
      ],
    }),
    pt('coolingSetpoint', 'Cooling Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('heatingSetpoint', 'Heating Setpoint', 'AV', 'numeric', {
      min: 65,
      max: 78,
      step: 0.5,
      unit: '°F',
    }),
    pt('compressorStatus', 'Compressor Status', 'BI', 'none', null),
    pt('fanStatus', 'Fan Status', 'BI', 'none', null),
    pt('alarmStatus', 'Alarm Status', 'BV', 'none', null),
    pt('fanSpeed', 'Fan Speed Command', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
    pt('economizerDamper', 'Economizer Damper', 'AO', 'percentage', {
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  ],
};

const DEFINITIONS = [
  {
    globalId: GLOBAL_IDS.AHU,
    name: 'AHU',
    equipmentType: 'AHU',
    description: 'Starter — air handling unit',
    points: POINTS.AHU,
  },
  {
    globalId: GLOBAL_IDS.VAV_CLG_ONLY,
    name: 'VAV-CLG-ONLY',
    equipmentType: 'VAV-CLG-ONLY',
    description: 'Starter — VAV cooling only',
    points: POINTS.VAV_CLG_ONLY,
  },
  {
    globalId: GLOBAL_IDS.VAV_HTG,
    name: 'VAV-HTG',
    equipmentType: 'VAV-HTG',
    description: 'Starter — VAV with heating / reheat',
    points: POINTS.VAV_HTG,
  },
  {
    globalId: GLOBAL_IDS.FCU,
    name: 'FCU',
    equipmentType: 'FCU',
    description: 'Starter — fan coil unit',
    points: POINTS.FCU,
  },
  {
    globalId: GLOBAL_IDS.RTU,
    name: 'RTU',
    equipmentType: 'RTU',
    description: 'Starter — rooftop unit',
    points: POINTS.RTU,
  },
];

/**
 * Rows for prisma.globalEquipmentTemplate.upsert
 */
function getGlobalStarterTemplateSeedRows() {
  return DEFINITIONS.map((d) => ({
    id: d.globalId,
    name: d.name,
    equipmentType: d.equipmentType,
    description: d.description,
    defaultGraphicName: null,
    pointsJson: d.points.map((p) => ({ ...p })),
    status: 'ACTIVE',
  }));
}

module.exports = {
  GLOBAL_IDS,
  getGlobalStarterTemplateSeedRows,
};
