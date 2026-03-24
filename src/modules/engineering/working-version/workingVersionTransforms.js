/**
 * Maps flat persisted engineering state ↔ version-shaped objects for UI and hooks.
 */

/**
 * @param {string} siteId
 * @param {object} flatState - Working-version reducer state
 */
export function toWorkingVersion(siteId, flatState) {
  if (!flatState) return null;
  const last = flatState.activeDeploymentSnapshot?.version || "v0";
  const n = parseInt(String(last).replace(/\D/g, ""), 10) || 0;
  return {
    id: `working-${siteId}`,
    versionNumber: `v${n + 1}`,
    status: "working",
    data: { ...flatState },
  };
}

/**
 * @param {string} siteId
 * @param {object} normalizedOrSnapshot - API-normalized `{ versionNumber, status, data }` OR legacy full snapshot (mock store)
 */
export function toActiveRelease(siteId, normalizedOrSnapshot) {
  if (!normalizedOrSnapshot) return null;

  if (
    normalizedOrSnapshot.data != null &&
    typeof normalizedOrSnapshot === "object" &&
    Object.prototype.hasOwnProperty.call(normalizedOrSnapshot, "versionNumber")
  ) {
    const payload = normalizedOrSnapshot.data;
    const vnRaw = normalizedOrSnapshot.versionNumber;
    const vn =
      typeof vnRaw === "number"
        ? `v${vnRaw}`
        : String(payload?.version ?? vnRaw ?? "v0");
    const mergedData =
      payload && typeof payload === "object" ? { ...payload, version: vn } : payload;
    return {
      id: `release-${siteId}-${vn}`,
      versionNumber: vn,
      status: String(normalizedOrSnapshot.status ?? "RELEASED").toLowerCase(),
      data: mergedData,
    };
  }

  const snapshotPayload = normalizedOrSnapshot;
  const vn = snapshotPayload.version ?? "v0";
  return {
    id: `release-${siteId}-${vn}`,
    versionNumber: vn,
    status: "released",
    data: snapshotPayload,
  };
}

/** Flat data payload from a workingVersion object */
export function workingVersionData(wv) {
  return wv?.data ?? {};
}
