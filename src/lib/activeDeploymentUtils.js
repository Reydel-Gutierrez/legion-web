/**
 * Helpers to derive Operator UI data from active deployment.
 * Operator reads from activeDeployment only — no separate mock project/site data.
 */

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
