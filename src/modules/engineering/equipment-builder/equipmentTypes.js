/**
 * Equipment type definitions for Equipment Builder.
 * Maps short codes (AHU, VAV, etc.) to display labels.
 */
export const EQUIPMENT_TYPE_OPTIONS = [
  { value: "AHU", label: "Air Handling Unit" },
  { value: "VAV", label: "Variable Air Volume" },
  { value: "FCU", label: "Fan Coil Unit" },
  { value: "CH", label: "Chiller" },
  { value: "CHWP", label: "Chilled Water Pump" },
  { value: "EF", label: "Exhaust Fan" },
  { value: "BLR", label: "Boiler" },
  { value: "CT", label: "Cooling Tower" },
  { value: "CUSTOM", label: "Custom" },
];

export const EQUIPMENT_GROUP_ORDER = [
  "AHUs",
  "VAVs",
  "FCUs",
  "Chiller Plant",
  "Pumps",
  "Exhaust Fans",
  "Boilers",
  "Cooling Towers",
  "Custom",
];

const TYPE_TO_GROUP = {
  AHU: "AHUs",
  VAV: "VAVs",
  FCU: "FCUs",
  CH: "Chiller Plant",
  CHWP: "Pumps",
  EF: "Exhaust Fans",
  BLR: "Boilers",
  CT: "Cooling Towers",
  CUSTOM: "Custom",
};

export function getEquipmentGroup(type) {
  return TYPE_TO_GROUP[type] || "Custom";
}

export function getEquipmentTypeLabel(type) {
  const opt = EQUIPMENT_TYPE_OPTIONS.find((o) => o.value === type);
  return opt ? opt.label : type || "Custom";
}
