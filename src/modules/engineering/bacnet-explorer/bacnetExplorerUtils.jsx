/** Explorer tree group keys in display order. */
export const TREE_GROUP_ORDER = [
  "deviceObjects",
  "analogInputs",
  "analogOutputs",
  "analogValues",
  "binaryInputs",
  "binaryOutputs",
  "binaryValues",
  "multistateInputs",
  "multistateOutputs",
  "multistateValues",
  "schedules",
  "trendLogs",
  "files",
  "proprietary",
  "unknown",
];

export const TREE_GROUP_LABELS = {
  deviceObjects: "Device Objects",
  analogInputs: "Analog Inputs",
  analogOutputs: "Analog Outputs",
  analogValues: "Analog Values",
  binaryInputs: "Binary Inputs",
  binaryOutputs: "Binary Outputs",
  binaryValues: "Binary Values",
  multistateInputs: "Multistate Inputs",
  multistateOutputs: "Multistate Outputs",
  multistateValues: "Multistate Values",
  schedules: "Schedules",
  trendLogs: "Trend Logs",
  files: "Files",
  proprietary: "Proprietary",
  unknown: "Unknown",
};

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function formatDisplayValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function formatObjectRef(objectType, objectInstance) {
  if (!objectType && objectInstance == null) return "—";
  if (objectInstance == null) return String(objectType || "—");
  return `${objectType}-${objectInstance}`;
}

export function getLastSeenPresenceStatus(lastSeenAt) {
  if (!lastSeenAt) {
    return { key: "unknown", label: "Unknown", className: "bacnet-explorer-status--unknown" };
  }

  const ts = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ts)) {
    return { key: "unknown", label: "Unknown", className: "bacnet-explorer-status--unknown" };
  }

  const ageMs = Date.now() - ts;
  if (ageMs <= ONLINE_THRESHOLD_MS) {
    return { key: "stale", label: "Unknown / Stale", className: "bacnet-explorer-status--stale" };
  }
  if (ageMs <= STALE_THRESHOLD_MS) {
    return { key: "stale", label: "Stale", className: "bacnet-explorer-status--stale" };
  }
  return { key: "offline", label: "Stale", className: "bacnet-explorer-status--offline" };
}

/** @deprecated Use getLastSeenPresenceStatus or getDeviceDisplayStatus instead */
export function getDevicePresenceStatus(lastSeenAt) {
  return getLastSeenPresenceStatus(lastSeenAt);
}

export function getDeviceDisplayStatus(device, health) {
  if (health) {
    if (health.online) {
      return {
        key: "online",
        label: "Online",
        className: "bacnet-explorer-status--online",
        detail: health.detail,
        checkedAt: health.checkedAt,
        responseMs: health.responseMs,
      };
    }

    return {
      key: "offline",
      label: "Not reachable",
      className: "bacnet-explorer-status--stale",
      detail: health.detail,
      checkedAt: health.checkedAt,
      responseMs: health.responseMs,
    };
  }

  const fallback = getLastSeenPresenceStatus(device?.lastSeenAt);
  return {
    ...fallback,
    className: "bacnet-explorer-status--stale",
    detail: null,
    checkedAt: null,
    responseMs: null,
  };
}

export function formatDeviceStatusTooltip(status, device) {
  const parts = [status.label];
  if (status.detail) parts.push(status.detail);
  if (status.responseMs != null) parts.push(`${Math.round(status.responseMs)} ms`);
  if (status.checkedAt) parts.push(`Checked ${formatTimestamp(status.checkedAt)}`);
  else if (device?.lastSeenAt) parts.push(`Last seen ${formatTimestamp(device.lastSeenAt)}`);
  return parts.join(" · ");
}

export function formatDeviceAddressCompact(device = {}) {
  const {
    address,
    deviceInstance,
    protocol,
    networkNumber,
    mstpMacAddress,
    routerAddress,
  } = device;

  const isRoutedMstp =
    (protocol && /ms\/tp/i.test(protocol)) ||
    networkNumber != null ||
    mstpMacAddress != null;

  if (isRoutedMstp && (networkNumber != null || mstpMacAddress != null)) {
    const parts = [`${routerAddress || address}`];
    if (networkNumber != null) parts.push(`Net ${networkNumber}`);
    if (mstpMacAddress != null) parts.push(`MAC ${mstpMacAddress}`);
    parts.push(`Inst ${deviceInstance}`);
    return parts.join(" · ");
  }

  return `${address} · Inst ${deviceInstance}`;
}

export function formatDeviceAddressLines(device = {}) {
  const {
    address,
    deviceInstance,
    protocol,
    networkNumber,
    mstpMacAddress,
    routerAddress,
  } = device;

  const isRoutedMstp =
    (protocol && /ms\/tp/i.test(protocol)) ||
    networkNumber != null ||
    mstpMacAddress != null;

  if (isRoutedMstp && (networkNumber != null || mstpMacAddress != null)) {
    const lines = [
      { label: "Router/IP", value: routerAddress || address },
    ];
    if (networkNumber != null) {
      lines.push({ label: "Network", value: networkNumber });
    }
    if (mstpMacAddress != null) {
      lines.push({ label: "MAC", value: mstpMacAddress });
    }
    lines.push({ label: "Instance", value: deviceInstance });
    return lines;
  }

  return [
    { label: "IP", value: address },
    { label: "Instance", value: deviceInstance },
  ];
}

export function formatResponseTime(responseMs) {
  if (responseMs == null || Number.isNaN(Number(responseMs))) return null;
  return `${Math.round(Number(responseMs))} ms`;
}

export function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function isFaultedReliability(reliability) {
  if (reliability == null || reliability === "") return false;
  const normalized = String(reliability).trim().toUpperCase();
  return normalized !== "NO_FAULT_DETECTED" && normalized !== "NO FAULT DETECTED";
}

export function hasPresentValue(value) {
  return value != null && value !== "";
}

export function flattenTreeGroups(groups = {}) {
  const rows = [];
  for (const key of TREE_GROUP_ORDER) {
    const list = groups[key];
    if (!Array.isArray(list)) continue;
    for (const object of list) {
      rows.push({ ...object, groupKey: key });
    }
  }
  return rows;
}

export function filterTreeObjects(objects, filters = {}) {
  const {
    search = "",
    groupKey = "all",
    onlyWithPresentValue = false,
    onlyFaulted = false,
  } = filters;

  const query = search.trim().toLowerCase();

  return objects.filter((object) => {
    if (groupKey !== "all" && object.groupKey !== groupKey) {
      return false;
    }

    if (onlyWithPresentValue && !hasPresentValue(object.presentValue)) {
      return false;
    }

    if (onlyFaulted && !isFaultedReliability(object.reliability)) {
      return false;
    }

    if (!query) return true;

    const haystack = [
      object.objectType,
      object.objectInstance,
      object.objectName,
      object.description,
      formatObjectRef(object.objectType, object.objectInstance),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function groupFilteredObjects(filteredObjects) {
  const grouped = TREE_GROUP_ORDER.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  for (const object of filteredObjects) {
    const key = object.groupKey || "unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(object);
  }

  return grouped;
}

export function countTreeObjects(groups = {}) {
  return TREE_GROUP_ORDER.reduce((sum, key) => sum + (groups[key]?.length || 0), 0);
}
