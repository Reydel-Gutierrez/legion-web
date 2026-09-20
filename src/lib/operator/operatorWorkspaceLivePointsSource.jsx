/**
 * Active-release equipment rows sometimes diverge from the Prisma equipment row the runtime
 * simulator / point rows are bound to (duplicate FCU-1, re-seeded DB, etc.). Resolve which
 * equipment id should be used for listPointsByEquipment / point mappings when hydrating
 * operator workspace rows.
 */

/** @param {unknown} s */
function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

/**
 * @param {string} workspaceEquipmentId
 * @param {object | null | undefined} releaseData
 * @param {object[] | null | undefined} runtimeControllers
 * @returns {string}
 */
export function resolveLivePointsSourceEquipmentId(workspaceEquipmentId, releaseData, runtimeControllers) {
  const wid = String(workspaceEquipmentId ?? "").trim();
  if (!wid) return wid;

  const rt = Array.isArray(runtimeControllers) ? runtimeControllers : [];
  const runtimeEqIds = new Set(rt.map((c) => c?.equipmentId).filter(Boolean).map(String));
  /** Each SIM row is keyed to its equipment UUID — never substitute another site's FCU. */
  if (runtimeEqIds.has(wid)) return wid;

  const equip = releaseData?.equipment;
  if (!Array.isArray(equip) || equip.length === 0) return wid;

  const self = equip.find((e) => String(e.id) === wid);
  if (!self) return wid;

  const selfSite = String(self.siteId ?? "").trim();
  const selfCode = norm(self.code);
  const selfName = norm(self.name);

  const runtimeIds = runtimeEqIds;

  const dupByCodeOrName = equip.filter((e) => {
    if (String(e.id) === wid) return false;
    if (String(e.siteId ?? "").trim() !== selfSite) return false;
    if (selfCode && norm(e.code) === selfCode) return true;
    if (selfName && norm(e.name) === selfName) return true;
    return false;
  });

  for (const c of dupByCodeOrName) {
    if (runtimeIds.has(String(c.id))) return String(c.id);
  }
  if (dupByCodeOrName.length === 1) return String(dupByCodeOrName[0].id);
  if (dupByCodeOrName.length > 1) {
    const hit = dupByCodeOrName.find((d) => runtimeIds.has(String(d.id)));
    return String((hit || dupByCodeOrName[0]).id);
  }

  const fcuCtrls = rt.filter(
    (c) =>
      c &&
      String(c.protocol || "").toUpperCase() === "SIM" &&
      String(c.controllerCode || "").toUpperCase() === "FCU-1"
  );
  const selfIsFcuLab =
    selfCode === "FCU-1" ||
    selfName === "FCU-1" ||
    norm(self.name) === norm("FCU-1") ||
    norm(self.code) === norm("FCU-1");

  if (selfIsFcuLab && fcuCtrls.length === 1) {
    const bindEq = String(fcuCtrls[0].equipmentId || "").trim();
    if (bindEq && bindEq !== wid) {
      const boundMeta = equip.find((e) => String(e.id) === bindEq);
      if (boundMeta && String(boundMeta.siteId ?? "").trim() === selfSite) {
        return bindEq;
      }
    }
  }

  return wid;
}
