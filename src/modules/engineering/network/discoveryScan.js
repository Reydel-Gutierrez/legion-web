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
