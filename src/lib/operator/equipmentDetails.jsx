import { resolveEquipmentLocationInRelease } from "../activeReleaseUtils";

/**
 * Operator-friendly fields for the Equipment Details card.
 * Technical/engineering fields stay in `technical`.
 */
export function splitOperatorEquipmentDetails(releaseData, equipment, graphic, extras) {
  if (!equipment) {
    return { primary: [], technical: [] };
  }

  const loc = releaseData
    ? resolveEquipmentLocationInRelease(releaseData, equipment.id)
    : {
        siteName: "",
        buildingName: "",
        floorName: "",
        equipmentLabel: equipment.displayLabel || equipment.name || "",
      };

  const protocol = equipment.protocol || extras?.protocol || "BACnet/IP";
  const controller =
    extras?.controllerCode ||
    (equipment.controllerRef ? `${protocol}: ${equipment.controllerRef}` : "—");

  const maps = releaseData?.mappings?.[equipment.id] ?? releaseData?.mappings?.[String(equipment.id)] ?? {};
  const mappedPointCount = Object.keys(maps).filter((k) => maps[k]).length;
  const pointsTotal =
    typeof equipment.pointsDefined === "number"
      ? equipment.pointsDefined
      : Array.isArray(equipment.livePoints)
        ? equipment.livePoints.length
        : "—";

  const graphicTemplate =
    graphic?.templateName ||
    graphic?.sourceTemplateName ||
    graphic?.name ||
    (graphic?.objects?.length > 0 ? "Deployed graphic (instance)" : "—");

  const lastUpdated =
    extras?.lastSeenAt ||
    extras?.lastUpdated ||
    releaseData?.lastDeployedAt ||
    null;

  const description =
    equipment.notes ||
    equipment.description ||
    equipment.typeLabel ||
    equipment.type ||
    equipment.equipmentType ||
    "—";

  const pointsMappedLabel =
    pointsTotal !== "—"
      ? `${mappedPointCount} / ${pointsTotal} mapped`
      : `${mappedPointCount} mapped`;

  const primary = [
    { key: "Name", value: equipment.displayLabel || equipment.name || "—" },
    { key: "Description", value: description },
    { key: "Location", value: loc.floorName || equipment.locationLabel || "—" },
    { key: "Building", value: loc.buildingName || "—" },
    { key: "System", value: equipment.type || equipment.equipmentType || "—" },
    { key: "Serial Number", value: equipment.serialNumber || equipment.instanceNumber || "—" },
    { key: "Communication Status", value: extras?.commHeadline || equipment.status || "—" },
    { key: "Points", value: pointsMappedLabel },
    { key: "Active Alarms", value: extras?.activeAlarms ?? 0 },
  ];

  const fullPath = [loc.siteName, loc.buildingName, loc.floorName, loc.equipmentLabel]
    .filter((x) => x != null && String(x).trim() !== "")
    .join(" / ");

  const technical = [
    { key: "Manufacturer", value: equipment.manufacturer || "—" },
    { key: "Model", value: equipment.model || "—" },
    { key: "Installation Date", value: equipment.installationDate || "—" },
    { key: "Control Panel", value: controller },
    { key: "Network Address", value: equipment.address != null && String(equipment.address).trim() !== "" ? String(equipment.address) : "—" },
    { key: "BACnet Instance", value: equipment.instanceNumber ?? extras?.bacnetInstance ?? "—" },
    { key: "Protocol", value: protocol },
    { key: "Last Updated", value: lastUpdated ? formatDetailTimestamp(lastUpdated) : "—" },
    { key: "Equipment full address", value: fullPath || "—" },
    { key: "Equipment ID", value: String(equipment.id) },
    { key: "Instance number", value: equipment.instanceNumber ?? "—" },
    { key: "Mapped controller", value: equipment.controllerRef ? `${protocol}: ${equipment.controllerRef}` : "Unassigned" },
    { key: "Engineering status", value: equipment.status || "—" },
    { key: "Comm / controller", value: equipment.commStatus || (equipment.controllerRef ? "Controller assigned" : "No controller") },
    { key: "Equipment template", value: equipment.templateName || "—" },
    { key: "Graphic template", value: graphicTemplate },
    { key: "Building ID", value: equipment.buildingId || "—" },
    { key: "Floor ID", value: equipment.floorId || "—" },
    {
      key: "Point mapping",
      value: pointsTotal !== "—" ? `${mappedPointCount} mapped / ${pointsTotal} defined` : `${mappedPointCount} mapped`,
    },
    { key: "Site", value: releaseData?.site?.name || "—" },
  ];

  return { primary, technical };
}

export function formatDetailTimestamp(value) {
  const t = new Date(value);
  if (!Number.isFinite(t.getTime())) return String(value);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function formatLastSyncTime(value) {
  if (value == null || value === "") return null;
  const t = new Date(value);
  if (!Number.isFinite(t.getTime())) return null;
  let hours = t.getHours();
  const minutes = String(t.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatOverviewTimestamp(value) {
  if (value == null || value === "") return "—";
  const t = new Date(value);
  if (!Number.isFinite(t.getTime())) return "—";
  const date = t.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = t.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}
