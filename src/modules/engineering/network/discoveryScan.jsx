/**
 * Mock discovery scan: filter site mock devices by protocol and configured paths.
 * Replace internals later with API calls without changing callers.
 */

import { engineeringRepository } from "../../../lib/data";

function isMstpProtocol(protocol) {
  const p = (protocol || "").toLowerCase();
  return p.includes("ms/tp") || p.includes("mstp");
}

/** BACnet/IP side: IP-native devices and routers (supervisory path), excluding MS/TP field devices */
function isIpSideProtocol(protocol) {
  if (isMstpProtocol(protocol)) return false;
  const p = (protocol || "").toLowerCase();
  return p.includes("bacnet/ip") || p.includes("bac/ip") || p.includes("router");
}

function cloneTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => ({
    ...n,
    children: cloneTree(n.children || []),
  }));
}

function filterTreeByPredicate(nodes, predicate) {
  const out = [];
  for (const n of nodes || []) {
    const children = filterTreeByPredicate(n.children || [], predicate);
    const match = predicate(n);
    if (match || children.length > 0) {
      out.push({ ...n, children });
    }
  }
  return out;
}

export function hasEnabledDiscoveryPaths(networkConfig) {
  const ip = networkConfig?.bacnetIpNetworks?.some((n) => n.enabled);
  const mstp = networkConfig?.mstpTrunks?.some((t) => t.enabled);
  return Boolean(ip || mstp);
}

/**
 * @param {object} params
 * @param {string} params.siteName
 * @param {'all'|'bacnet_ip'|'bacnet_mstp'} params.scanMode
 * @param {object} params.networkConfig
 * @returns {{ devices: object[], statusSummary: string, scanLines: string[] }}
 */
export function getMockDiscoveryScanResult({ siteName, scanMode, networkConfig }) {
  const raw = engineeringRepository.getEngineeringDiscoveryDevices(siteName);
  const base = Array.isArray(raw) ? cloneTree(raw) : [];
  const includeUnconfigured = networkConfig?.scanDefaults?.includeUnconfiguredProtocols === true;

  const scanLines = [];

  if (!includeUnconfigured && !hasEnabledDiscoveryPaths(networkConfig)) {
    return {
      devices: [],
      statusSummary: "no_config_paths",
      scanLines: ["No enabled BACnet/IP networks or MSTP trunks in Network Configuration."],
    };
  }

  const ipEnabled = includeUnconfigured || networkConfig?.bacnetIpNetworks?.some((n) => n.enabled);
  const mstpEnabled = includeUnconfigured || networkConfig?.mstpTrunks?.some((t) => t.enabled);

  const enabledIpNames = (networkConfig?.bacnetIpNetworks || []).filter((n) => n.enabled).map((n) => n.name);
  const enabledMstpNames = (networkConfig?.mstpTrunks || []).filter((t) => t.enabled).map((t) => t.name);

  let predicate;
  if (scanMode === "bacnet_ip") {
    if (!includeUnconfigured && !networkConfig?.bacnetIpNetworks?.some((n) => n.enabled)) {
      return {
        devices: [],
        statusSummary: "no_ip_paths",
        scanLines: ["Enable at least one BACnet/IP network in Network Configuration."],
      };
    }
    predicate = (n) => isIpSideProtocol(n.protocol);
    scanLines.push(
      `BACnet/IP — ${includeUnconfigured ? "all IP paths (unconfigured protocols allowed)" : enabledIpNames.join(", ") || "configured IP networks"}`
    );
  } else if (scanMode === "bacnet_mstp") {
    if (!includeUnconfigured && !networkConfig?.mstpTrunks?.some((t) => t.enabled)) {
      return {
        devices: [],
        statusSummary: "no_mstp_paths",
        scanLines: ["Enable at least one MSTP trunk in Network Configuration."],
      };
    }
    predicate = (n) => isMstpProtocol(n.protocol);
    scanLines.push(
      `BACnet MS/TP — ${includeUnconfigured ? "all trunks (unconfigured protocols allowed)" : enabledMstpNames.join(", ") || "configured trunks"}`
    );
  } else {
    predicate = (n) => {
      const ipOk = ipEnabled && isIpSideProtocol(n.protocol);
      const mstpOk = mstpEnabled && isMstpProtocol(n.protocol);
      return ipOk || mstpOk;
    };
    const parts = [];
    if (ipEnabled) parts.push(`IP: ${includeUnconfigured ? "all" : enabledIpNames.join(", ") || "configured"}`);
    if (mstpEnabled) parts.push(`MSTP: ${includeUnconfigured ? "all" : enabledMstpNames.join(", ") || "configured"}`);
    scanLines.push(`Scan All — ${parts.join(" · ") || "paths"}`);
  }

  const filtered = filterTreeByPredicate(base, predicate);
  return { devices: filtered, statusSummary: "ok", scanLines };
}

export function flattenDeviceCount(roots) {
  let n = 0;
  function walk(nodes) {
    (nodes || []).forEach((node) => {
      if (node?.id) n += 1;
      walk(node?.children);
    });
  }
  walk(Array.isArray(roots) ? roots : []);
  return n;
}

/** Flatten discovery tree to a list (same order as Network Discovery table walk). */
export function flattenDiscoveryTree(roots) {
  const out = [];
  function walk(nodes) {
    if (!nodes || !nodes.length) return;
    nodes.forEach((node) => {
      if (node?.id) out.push({ ...node, children: undefined });
      walk(node?.children);
    });
  }
  walk(Array.isArray(roots) ? roots : []);
  return out;
}

// ---------------------------------------------------------------------------
// Simulated / runtime-backed discovery (Legion SIM controllers from API)
// ---------------------------------------------------------------------------

/** @param {string | undefined} iso */
export function formatDiscoveryLastSeen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    if (sec < 45) return "just now";
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} hr ago`;
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * @param {object} item — runtime discovery payload
 * @returns {object} discovery tree node (flat device row shape)
 */
export function runtimeDiscoveryItemToTreeRoot(item) {
  /** Stable runtime id (e.g. sim-fcu-01) — API route key for field-points / poll; not equipment UUID. */
  const apiCode = item?.code != null ? String(item.code) : "SIM";
  const humanControllerCode =
    item?.controllerCode != null && String(item.controllerCode).trim() !== ""
      ? String(item.controllerCode).trim()
      : apiCode;
  const hasBacnetInstance = item?.bacnetDeviceInstance != null && String(item.bacnetDeviceInstance).trim() !== "";
  return {
    id: `runtime-${apiCode}`,
    parentId: null,
    name: item?.deviceLabel || humanControllerCode,
    vendor: item?.vendorName != null && String(item.vendorName).trim() !== "" ? String(item.vendorName) : "Legion",
    deviceInstance: hasBacnetInstance ? String(item.bacnetDeviceInstance) : humanControllerCode,
    network:
      item?.discoveryNetwork != null && String(item.discoveryNetwork).trim() !== ""
        ? String(item.discoveryNetwork)
        : `SIM:${humanControllerCode}`,
    macOrMstpId: (() => {
      const raw = item?.deviceAddress;
      if (raw != null && String(raw).trim() !== "") return String(raw).trim();
      return "—";
    })(),
    objectCount: item?.pointCount != null ? item.pointCount : "—",
    lastSeen: formatDiscoveryLastSeen(item?.lastSeenAt),
    status: item?.online ? "Online" : "Offline",
    protocol: item?.protocol || "SIM",
    isExpandable: false,
    assignedEquipmentId: item?.equipmentId ?? item?.mappedEquipmentId ?? null,
    children: [],
    discoverySource: item?.source || "runtime",
    /** Pass to `/api/runtime/controllers/:code/field-points` (catalog runtimeId) */
    runtimeFieldPointsCode: apiCode,
    /** Pass to assign API as `controllerCode` (e.g. FCU-1) */
    assignControllerCode: humanControllerCode,
  };
}

/**
 * Append SIM / runtime devices after BACnet-filtered scan results.
 * @param {object[]} treeRoots
 * @param {object[]} runtimeItems
 */
export function appendRuntimeDevicesToDiscoveryTree(treeRoots, runtimeItems) {
  const roots = Array.isArray(treeRoots) ? treeRoots : [];
  const extra = Array.isArray(runtimeItems) ? runtimeItems.map(runtimeDiscoveryItemToTreeRoot) : [];
  return [...roots, ...extra];
}

/** @param {string | undefined} pointType */
function mapPointTypeToDiscoveryAbbrev(pointType) {
  const s = (pointType || "").toLowerCase();
  if (s.includes("analog input")) return "AI";
  if (s.includes("analog output")) return "AO";
  if (s.includes("analog value")) return "AV";
  if (s.includes("binary")) return "BV";
  if (s.includes("character") || s.includes("string")) return "STR";
  return pointType ? String(pointType).slice(0, 12) : "—";
}

/**
 * Maps hierarchy API point rows to Device Inspector "discovered object" rows (live SIM / DB-backed).
 * @param {Array<{ id?: string, pointName?: string, pointCode?: string, pointType?: string, unit?: string | null, presentValue?: string | null }>} points
 */
/**
 * Runtime `/field-points` payload → Device Inspector rows (unmapped SIM: catalog-only).
 * @param {Array<{ fieldPointKey?: string, fieldPointName?: string, fieldObjectType?: string }>} fieldPoints
 */
export function mapRuntimeFieldPointsToDiscoveryObjects(fieldPoints) {
  const readLabel = formatDiscoveryLastSeen(new Date().toISOString());
  const sorted = [...(fieldPoints || [])].sort((a, b) =>
    String(a.fieldPointKey || "").localeCompare(String(b.fieldPointKey || ""), undefined, { sensitivity: "base" })
  );
  return sorted.map((p, idx) => {
    const objectType = mapPointTypeToDiscoveryAbbrev(p.fieldObjectType);
    const codeRaw =
      p.fieldPointKey != null && String(p.fieldPointKey).trim() !== "" ? String(p.fieldPointKey).trim() : null;
    const refSuffix = codeRaw ?? String(idx);
    const objectName = p.fieldPointName || p.fieldPointKey || "—";
    return {
      id: `rt-fp-${p.fieldPointKey}-${idx}`,
      objectName,
      objectType,
      instance: p.fieldPointKey ?? "—",
      presentValue: "—",
      units: "",
      lastRead: readLabel,
      bacnetRef: `${objectType}-${refSuffix}`,
      displayName: objectName,
    };
  });
}

export function mapEquipmentPointsToDiscoveryObjects(points) {
  const readLabel = formatDiscoveryLastSeen(new Date().toISOString());
  const sorted = [...(points || [])].sort((a, b) =>
    String(a.pointCode || "").localeCompare(String(b.pointCode || ""), undefined, { sensitivity: "base" })
  );
  return sorted.map((p, idx) => {
    const objectType = mapPointTypeToDiscoveryAbbrev(p.pointType);
    const codeRaw = p.pointCode != null && String(p.pointCode).trim() !== "" ? String(p.pointCode).trim() : null;
    const refSuffix = codeRaw ?? String(idx);
    const objectName = p.pointName || p.pointCode || "—";
    return {
      id: p.id || `sim-${p.pointCode}-${idx}`,
      objectName,
      objectType,
      instance: p.pointCode ?? "—",
      presentValue:
        p.presentValue != null && String(p.presentValue).trim() !== "" ? String(p.presentValue) : "—",
      units: p.unit != null && String(p.unit).trim() !== "" ? String(p.unit) : "",
      lastRead: readLabel,
      // Point Mapping page + auto-map use bacnetRef / displayName (same shape as generateMockDiscoveredObjects).
      bacnetRef: `${objectType}-${refSuffix}`,
      displayName: objectName,
    };
  });
}

/** Legion SIM device row from runtime discovery merge */
export function isRuntimeSimDiscoveryDevice(device) {
  if (!device) return false;
  if (device.discoverySource === "runtime") return true;
  if (device.protocol === "SIM") return true;
  if (String(device.network || "").startsWith("SIM:")) return true;
  return false;
}

export function getRuntimeSimEquipmentId(device) {
  if (!device) return null;
  return device.assignedEquipmentId ?? device.equipmentId ?? null;
}
