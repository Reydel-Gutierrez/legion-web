/**
 * Helpers to derive Operator UI data from active deployment.
 * Operator reads from activeDeployment only — no separate mock project/site data.
 * Supports sites with no discovered devices: logical points from templates, status "unbound" when no live source.
 */

// Lazy require to avoid circular deps; called only when building rows from deployment
function getTemplatePoints(name, draftTemplates) {
  const { getTemplatePoints: get } = require("../modules/engineering/data/mockPointMappingData");
  return get(name, draftTemplates);
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
 * Get logical points for one equipment from deployed snapshot (template-based; no discovery required).
 */
export function getLogicalPointsForEquipmentFromDeployment(activeDeployment, equipmentId) {
  if (!activeDeployment?.equipment) return [];
  const eq = activeDeployment.equipment.find((e) => String(e.id) === String(equipmentId));
  if (!eq?.templateName) return [];
  const draftTemplates = activeDeployment.templates;
  const templatePoints = getTemplatePoints(eq.templateName, draftTemplates?.equipmentTemplates);
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

/**
 * Build WorkspaceRow[] for operator from deployed snapshot. Uses logical points; value from mapped live or placeholder.
 * Status: "OK" when mapped/live, "Unbound" when no live source.
 */
export function getWorkspaceRowsFromDeployment(activeDeployment, equipmentId, equipmentName) {
  const logicalPoints = getLogicalPointsForEquipmentFromDeployment(activeDeployment, equipmentId);
  if (logicalPoints.length === 0) return [];
  const mappings = activeDeployment?.mappings?.[equipmentId] || {};
  const controllerRef = activeDeployment?.equipment?.find((e) => String(e.id) === String(equipmentId))?.controllerRef;
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

/**
 * Find equipment in deployment by id or instance number (for detail page URL).
 */
export function getEquipmentFromDeployment(activeDeployment, equipmentIdOrInstance) {
  if (!activeDeployment?.equipment || !equipmentIdOrInstance) return null;
  const key = String(equipmentIdOrInstance).trim();
  return (
    activeDeployment.equipment.find(
      (e) => String(e.id) === key || String(e.instanceNumber || "").trim() === key
    ) || null
  );
}

/**
 * Build equipment tree for Operator Equipment page from active deployment.
 * Returns array of { id, label, sub, type: "group"|"floor"|"equip", children }.
 * If no deployment or no site, returns empty array.
 */
export function activeDeploymentToEquipmentTree(activeDeployment) {
  if (!activeDeployment?.site?.buildings?.length || !Array.isArray(activeDeployment.equipment)) {
    return [];
  }
  const equipment = activeDeployment.equipment;
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
  activeDeployment.site.buildings.forEach((b) => {
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

/**
 * Derive dashboard summary from active deployment (equipment count, etc.).
 * Use for counts; keep events/alarms as placeholders until backend.
 */
export function getSummaryFromActiveDeployment(activeDeployment) {
  const equipment = activeDeployment?.equipment ?? [];
  return {
    equipmentCount: equipment.length,
    activeAlarms: 0,
    unackedAlarms: 0,
    devicesOffline: 0,
    openTasks: 0,
    energyRuntime: null,
  };
}

/**
 * Derive equipment health list from active deployment for dashboard widget.
 */
export function getEquipmentHealthFromActiveDeployment(activeDeployment) {
  const equipment = activeDeployment?.equipment ?? [];
  return equipment.slice(0, 12).map((eq) => ({
    id: eq.id,
    name: eq.displayLabel || eq.name,
    status: eq.status === "CONTROLLER_ASSIGNED" || eq.status === "READY_FOR_MAPPING" ? "OK" : "Warn",
    comm: eq.controllerRef ? "Online" : "Offline",
    lastUpdate: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }),
  }));
}
