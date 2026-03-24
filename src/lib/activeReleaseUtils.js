/**
 * Helpers to derive Operator UI data from an active release payload (`activeRelease.data`).
 */

function getTemplatePoints(name, equipmentTemplates) {
  const { getTemplatePoints: get } = require("../modules/engineering/data/mockPointMappingData");
  return get(name, equipmentTemplates);
}
function getDiscoveredObjects(controllerRef) {
  const { getDiscoveredObjects: get } = require("../modules/engineering/data/mockPointMappingData");
  return get(controllerRef);
}

/** Binding status for logical points when no physical device is mapped */
export const BINDING_STATUS = {
  LIVE: "live",
  MAPPED: "mapped",
  UNBOUND: "unbound",
  SIMULATED: "simulated",
};

function placeholderValueForPoint(tp) {
  if (!tp) return "—";
  const u = tp.units || "";
  if (tp.expectedObjectType === "AI" || tp.expectedObjectType === "AV") {
    if (u === "°F") return 72;
    if (u === "%") return 50;
    if (u === "CFM") return 400;
  }
  if (tp.expectedObjectType === "BI" || tp.expectedObjectType === "BO") return "—";
  return "—";
}

/**
 * @param {object} releaseData - Snapshot payload (site, equipment, templates, …)
 */
export function getLogicalPointsForEquipmentFromRelease(releaseData, equipmentId) {
  if (!releaseData?.equipment) return [];
  const eq = releaseData.equipment.find((e) => String(e.id) === String(equipmentId));
  if (!eq?.templateName) return [];
  const templatePoints = getTemplatePoints(eq.templateName, releaseData.templates?.equipmentTemplates);
  return templatePoints.map((tp) => ({
    id: tp.id,
    name: tp.displayName,
    key: tp.key,
    referenceId: tp.referenceId || tp.key || tp.id,
    units: tp.units || "",
    valueType: tp.expectedObjectType,
    writable: tp.expectedObjectType === "AV" || tp.expectedObjectType === "AO" || tp.expectedObjectType === "BO",
  }));
}

export function getWorkspaceRowsFromRelease(releaseData, equipmentId, equipmentName) {
  const logicalPoints = getLogicalPointsForEquipmentFromRelease(releaseData, equipmentId);
  if (logicalPoints.length === 0) return [];
  const mappings = releaseData?.mappings?.[equipmentId] || {};
  const controllerRef = releaseData?.equipment?.find((e) => String(e.id) === String(equipmentId))?.controllerRef;
  const discovered = controllerRef ? getDiscoveredObjects(controllerRef) : [];
  /** @type {import("../data/contracts").WorkspaceRow[]} */
  const rows = logicalPoints.map((tp) => {
    const bacnetId = mappings[tp.id];
    const bacnetObj = bacnetId && discovered.find((o) => o.id === bacnetId);
    const hasLive = bacnetObj && (bacnetObj.status || "").toLowerCase() !== "offline";
    const displayValue = hasLive ? bacnetObj.presentValue : placeholderValueForPoint(tp);
    const valueStr = tp.units ? `${displayValue} ${tp.units}`.trim() : String(displayValue ?? "—");
    return {
      id: `${equipmentId}-${tp.id}`,
      equipmentId,
      equipmentName,
      pointId: tp.id,
      pointName: tp.name,
      pointReferenceId: tp.referenceId || tp.key || tp.id,
      value: valueStr,
      units: tp.units || "",
      status: hasLive ? "OK" : "Unbound",
      writable: tp.writable,
    };
  });
  return rows;
}

export function getEquipmentFromRelease(releaseData, equipmentIdOrInstance) {
  if (!releaseData?.equipment || !equipmentIdOrInstance) return null;
  const key = String(equipmentIdOrInstance).trim();
  return (
    releaseData.equipment.find(
      (e) => String(e.id) === key || String(e.instanceNumber || "").trim() === key
    ) || null
  );
}

export function activeReleaseDataToEquipmentTree(releaseData) {
  if (!releaseData?.site?.buildings?.length || !Array.isArray(releaseData.equipment)) {
    return [];
  }
  const equipment = releaseData.equipment;
  const byFloor = {};
  equipment.forEach((eq) => {
    const floorId = eq.floorId || "unknown";
    if (!byFloor[floorId]) byFloor[floorId] = [];
    byFloor[floorId].push({
      id: eq.id,
      instanceNumber: eq.instanceNumber || null,
      label: eq.displayLabel || eq.name || eq.id,
      status: eq.status || "Normal",
      type: "equip",
    });
  });

  const floors = [];
  releaseData.site.buildings.forEach((b) => {
    (b.floors || []).forEach((f) => {
      const eqList = byFloor[f.id] || [];
      const sub = eqList.length
        ? eqList
            .slice(0, 3)
            .map((e) => e.label)
            .join(" • ") + (eqList.length > 3 ? ` +${eqList.length - 3}` : "")
        : "No equipment";
      floors.push({
        id: f.id,
        label: f.name,
        sub,
        type: "floor",
        children: eqList,
      });
    });
  });

  const chillerPlant = equipment.filter((e) => (e.type || "").toLowerCase().includes("ch"));
  if (chillerPlant.length > 0) {
    return [
      {
        id: "plant",
        label: "Chiller Plant",
        sub: "Chiller",
        type: "group",
        children: chillerPlant.map((e) => ({
          id: e.id,
          instanceNumber: e.instanceNumber || null,
          label: e.displayLabel || e.name,
          status: e.status || "Online",
          type: "equip",
        })),
      },
      ...floors,
    ];
  }
  return floors;
}

export function getSummaryFromActiveRelease(releaseData) {
  const equipment = releaseData?.equipment ?? [];
  return {
    equipmentCount: equipment.length,
    activeAlarms: 0,
    unackedAlarms: 0,
    devicesOffline: 0,
    openTasks: 0,
    energyRuntime: null,
  };
}

export function getFloorCommunicationHealthFromRelease(releaseData) {
  if (!releaseData?.site?.buildings?.length) return [];
  const equipment = releaseData.equipment ?? [];
  const rows = [];
  for (const b of releaseData.site.buildings) {
    for (const f of b.floors || []) {
      const onFloor = equipment.filter((e) => e.floorId === f.id);
      const total = onFloor.length;
      const online = onFloor.filter((e) => Boolean(e.controllerRef)).length;
      const pct = total === 0 ? 100 : Math.round((100 * online) / total);
      const offline = total - online;
      rows.push({
        id: f.id,
        label: f.name || f.label || String(f.id),
        buildingLabel: b.name || "",
        pct,
        offline,
        total,
        online,
      });
    }
  }
  return rows;
}

export function getEquipmentHealthFromActiveRelease(releaseData) {
  const equipment = releaseData?.equipment ?? [];
  return equipment.slice(0, 12).map((eq) => ({
    id: eq.id,
    name: eq.displayLabel || eq.name,
    status: eq.status === "CONTROLLER_ASSIGNED" || eq.status === "READY_FOR_MAPPING" ? "OK" : "Warn",
    comm: eq.controllerRef ? "Online" : "Offline",
    lastUpdate: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }),
  }));
}
