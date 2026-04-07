/**
 * Operator Site Layout — building overview (floors list, equipment summaries, comms-style live/offline counts).
 */

/** Product default when site/building have no operator description */
export const DEFAULT_BUILDING_HERO_TAGLINE =
  "Centralized control. Smarter buildings. Better experiences.";

/**
 * Many records use a trailing "Building" in the name (e.g. "Sunset Strip Plaza Building").
 * Hero title should match the prototype ("SUNSET STRIP PLAZA") — strip that suffix when present.
 */
export function formatBuildingHeroTitle(rawName) {
  const t = (rawName || "").trim();
  if (!t) return "Building";
  const withoutSuffix = t.replace(/\s+building\s*$/i, "").trim();
  return withoutSuffix || t;
}

/**
 * Hero copy for the operator building main page (prototype-aligned).
 * Title = building name only (e.g. "Sunset Strip Plaza"). Blue line = building type only.
 * @param {object|null} building
 * @param {object|null} site
 */
export function resolveBuildingHeroCopy(building, site) {
  const name = formatBuildingHeroTitle(building?.name || "Building");
  const buildingType = (building?.buildingType || "").trim();
  const subtitle = buildingType ? buildingType.toUpperCase() : "MAIN BUILDING";
  const tagline =
    (building?.description && String(building.description).trim()) ||
    (site?.description && String(site.description).trim()) ||
    DEFAULT_BUILDING_HERO_TAGLINE;
  return { name, subtitle, tagline };
}

/** @param {object} releaseData */
export function findBuildingInRelease(releaseData, buildingId) {
  if (!buildingId || !releaseData?.site?.buildings?.length) return null;
  return releaseData.site.buildings.find((b) => String(b.id) === String(buildingId)) || null;
}

/** Floors sorted for display (sortOrder, then name). */
export function sortedFloorsForBuilding(building) {
  if (!building?.floors?.length) return [];
  return [...building.floors].sort((a, b) => {
    const ao = Number.isFinite(a.sortOrder) ? a.sortOrder : 0;
    const bo = Number.isFinite(b.sortOrder) ? b.sortOrder : 0;
    if (ao !== bo) return ao - bo;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export function equipmentForBuilding(releaseData, buildingId) {
  if (!releaseData?.equipment?.length || !buildingId) return [];
  return releaseData.equipment.filter((e) => String(e.buildingId) === String(buildingId));
}

export function equipmentForFloor(releaseData, floorId) {
  if (!releaseData?.equipment?.length || !floorId) return [];
  return releaseData.equipment.filter((e) => String(e.floorId) === String(floorId));
}

function abbrevEquipmentType(eq) {
  const t = String(eq.type || eq.equipmentType || "").trim();
  if (!t) return "Eq";
  const word = t.split(/[\s/-]+/)[0];
  const u = word.toUpperCase();
  return u.length <= 8 ? u : `${u.slice(0, 6)}…`;
}

function pluralizeLabel(label, n) {
  if (n === 1) return label;
  if (/s$/i.test(label)) return label;
  return `${label}s`; // e.g. FCU → FCUs
}

/**
 * e.g. "5 FCU • 1 AHU • 2 VAV"
 * @param {object[]} equipment
 */
export function summarizeEquipmentTypes(equipment, { maxKinds = 5 } = {}) {
  if (!equipment.length) return "";
  const counts = new Map();
  equipment.forEach((eq) => {
    const k = abbrevEquipmentType(eq);
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxKinds);
  return entries.map(([label, c]) => `${c} ${pluralizeLabel(label, c)}`).join(" • ");
}

/** Proxy for “on the network”: controller assigned. Matches floor comms health pattern in activeReleaseUtils. */
export function isEquipmentLive(eq) {
  const ref = eq?.controllerRef;
  return ref != null && String(ref).trim() !== "";
}

export function liveOfflineStats(equipment) {
  const total = equipment.length;
  let live = 0;
  equipment.forEach((eq) => {
    if (isEquipmentLive(eq)) live += 1;
  });
  const offline = total - live;
  const livePct = total === 0 ? 100 : Math.round((100 * live) / total);
  const offlinePct = total === 0 ? 0 : Math.max(0, 100 - livePct);
  return { total, live, offline, livePct, offlinePct };
}

/**
 * Active alarms for equipment rows on this building (matches by equipmentId or equipmentName).
 * Expects alarm rows shaped like `contracts.Alarm` (state, ack, severity, equipmentName, …).
 */
export function filterActiveAlarmsForBuilding(releaseData, buildingId, alarms) {
  if (!buildingId || !Array.isArray(alarms) || alarms.length === 0) return [];
  const equipmentRows = equipmentForBuilding(releaseData, buildingId);
  const idSet = new Set(equipmentRows.map((e) => String(e.id)));
  const nameSet = new Set(
    equipmentRows
      .map((e) => (e.displayLabel || e.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return alarms.filter((a) => {
    const st = String(a.state || "Active").toLowerCase();
    if (st === "history" || st === "cleared") return false;
    const eid = a.equipmentId != null ? String(a.equipmentId).trim() : "";
    if (eid && idSet.has(eid)) return true;
    const en = String(a.equipmentName || "").trim().toLowerCase();
    return Boolean(en && nameSet.has(en));
  });
}

/** Subtitle lines for the active-alarm summary widget. */
export function summarizeActiveAlarmsForWidget(buildingActiveAlarms) {
  const list = Array.isArray(buildingActiveAlarms) ? buildingActiveAlarms : [];
  const unacked = list.filter((a) => !a.ack);
  const counts = {};
  list.forEach((a) => {
    const k = String(a.severity || "Alarm").trim() || "Alarm";
    counts[k] = (counts[k] || 0) + 1;
  });
  const severityPart = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${v} ${k}`)
    .join(" • ");
  return {
    activeCount: list.length,
    unackedCount: unacked.length,
    severitySummary: severityPart,
  };
}

export function floorSubtitleLines(floor) {
  const parts = [floor?.floorType, floor?.occupancyType].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(" · ") : "";
}

/** Secondary line under the floor name in Quick Navigation (prototype-style). */
export function floorQuickNavSubtitle(floor) {
  const t = String(floor?.floorType || "").trim();
  if (t) return t;
  const o = String(floor?.occupancyType || "").trim();
  if (o) return o;
  return "Main level";
}

/**
 * Tertiary line for Quick Navigation — equipment counts / types on the floor.
 * @param {object|null} releaseData
 * @param {object|null} floor
 */
export function floorQuickNavMetaLine(releaseData, floor) {
  if (!floor?.id) return "";
  const onFloor = equipmentForFloor(releaseData, floor.id);
  const n = onFloor.length;
  const summary = summarizeEquipmentTypes(onFloor, { maxKinds: 4 });
  const extra = floorSubtitleLines(floor);
  if (summary && extra) return `${summary} · ${extra}`;
  if (summary) return summary;
  if (n > 0) return `${n} equipment on this floor`;
  if (extra) return extra;
  return "No equipment on this floor";
}

/** Deterministic hash for stable pseudo-random UI (e.g. occupancy) per entity id. */
export function stableStringHash(input) {
  const s = String(input ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return Math.abs(h >>> 0);
}

/**
 * Treat each equipment row as a schedulable zone. Occupancy is a deterministic utilization model
 * (sorted order + target fill ratio) until live occupancy points are wired — stable for a given deployment.
 * @param {object[]} equipment
 * @param {string|number} buildingId
 */
export function occupancyZonesFromEquipment(equipment, buildingId) {
  const bid = String(buildingId ?? "");
  const sorted = [...(equipment || [])].sort((a, b) => {
    const la = String(a.displayLabel || a.name || a.id || "").toLowerCase();
    const lb = String(b.displayLabel || b.name || b.id || "").toLowerCase();
    if (la !== lb) return la.localeCompare(lb);
    return stableStringHash(`${bid}:${a.id}`) - stableStringHash(`${bid}:${b.id}`);
  });
  const total = sorted.length;
  const targetRatio = 0.78;
  const occupiedTarget = total === 0 ? 0 : Math.max(1, Math.min(total - 1, Math.round(total * targetRatio)));
  const zones = sorted.map((eq, i) => {
    const label = String(eq.displayLabel || eq.name || "Equipment").trim() || "Equipment";
    const occupied = i < occupiedTarget;
    return { id: eq.id, label, occupied };
  });
  const occupiedCount = zones.filter((z) => z.occupied).length;
  return {
    zones,
    occupiedCount,
    total: zones.length,
    vacantCount: zones.length - occupiedCount,
  };
}

function abbrevEquipmentTypeForNetwork(eq) {
  const t = String(eq.type || eq.equipmentType || "").trim();
  if (!t) return "Other";
  const word = t.split(/[\s/-]+/)[0];
  return word.length <= 12 ? word : `${word.slice(0, 10)}…`;
}

/**
 * Online = controller assigned (same as {@link isEquipmentLive}). Offline rows for troubleshooting list.
 * @param {object[]} equipment
 */
export function networkInsightFromEquipment(equipment) {
  const list = Array.isArray(equipment) ? equipment : [];
  const offlineRows = [];
  const onlineByType = new Map();
  list.forEach((eq) => {
    const live = isEquipmentLive(eq);
    const type = abbrevEquipmentTypeForNetwork(eq);
    if (live) {
      onlineByType.set(type, (onlineByType.get(type) || 0) + 1);
    } else {
      offlineRows.push({
        id: eq.id,
        label: String(eq.displayLabel || eq.name || "Equipment").trim() || "Equipment",
        type,
      });
    }
  });
  const stats = liveOfflineStats(list);
  const onlineByTypeSorted = [...onlineByType.entries()].sort((a, b) => b[1] - a[1]);
  return { ...stats, offlineRows, onlineByTypeSorted };
}

/** @param {object[]} users */
export function summarizeUsersForInsight(users) {
  const list = Array.isArray(users) ? users : [];
  const active = list.filter((u) => String(u.status || "").toLowerCase() === "active");
  const byRole = {};
  active.forEach((u) => {
    const r = String(u.role || "User").trim() || "User";
    byRole[r] = (byRole[r] || 0) + 1;
  });
  const roleOrder = Object.keys(byRole).sort((a, b) => byRole[b] - byRole[a]);
  return {
    total: list.length,
    activeCount: active.length,
    byRole,
    roleOrder,
  };
}
