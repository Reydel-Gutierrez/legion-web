import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faChevronDown, faTimes, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import {
  deriveZoneVisualState,
  buildSimulatedPointValuesForObjectId,
  ZONE_RUNTIME_STATES,
  fieldEnabled,
} from "../floorZoneModel";

function parseTempMainDisplay(raw) {
  if (raw == null || raw === "—" || raw === "Offline") return { main: "—", unit: "" };
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([FC])?/i);
  if (m) {
    return { main: m[1], unit: m[2] ? `°${m[2].toUpperCase()}` : "°" };
  }
  return { main: s.slice(0, 8), unit: "" };
}

function targetPillText(setpointRaw) {
  if (setpointRaw == null || setpointRaw === "—") return "Target —";
  return `Target ${String(setpointRaw).replace(/^\s*/, "")}`;
}

function statusDotClass(runtimeState) {
  switch (runtimeState) {
    case ZONE_RUNTIME_STATES.ALARM:
      return "floor-zone-glass-chip__dot--alarm";
    case ZONE_RUNTIME_STATES.WARNING:
      return "floor-zone-glass-chip__dot--warn";
    case ZONE_RUNTIME_STATES.OFFLINE:
      return "floor-zone-glass-chip__dot--offline";
    case ZONE_RUNTIME_STATES.COOLING:
      return "floor-zone-glass-chip__dot--cool";
    case ZONE_RUNTIME_STATES.HEATING:
      return "floor-zone-glass-chip__dot--heat";
    default:
      return "floor-zone-glass-chip__dot--ok";
  }
}

function buildDetailRows(zoneConfig, equipmentLabel, values) {
  const wf = zoneConfig?.wedgeFields || [];
  const rows = [];
  if (fieldEnabled(wf, "zoneName")) rows.push({ label: "Zone", value: zoneConfig?.zoneName || "—" });
  if (fieldEnabled(wf, "equipmentName")) rows.push({ label: "Equipment", value: equipmentLabel || "—" });
  if (fieldEnabled(wf, "spaceTemp")) rows.push({ label: "Space", value: values.spaceTemp ?? "—" });
  if (fieldEnabled(wf, "setpoint")) rows.push({ label: "Setpoint", value: values.setpoint ?? "—" });
  if (fieldEnabled(wf, "occupancy")) rows.push({ label: "Occupancy", value: values.occupancy ?? "—" });
  if (fieldEnabled(wf, "alarmState")) rows.push({ label: "Alarm", value: values.alarmState ?? "—" });
  return rows;
}

/**
 * Glass zone readout placed inside the zone shape. Collapsed: temp + target + labels.
 * Expanded: full wedge-style rows + Open Details (same glass aesthetic; no separate dark card).
 */
export default function FloorZoneGlassChip({
  zoneObject,
  mergedValues,
  equipmentTitle,
  expanded = false,
  onToggleExpand,
  onOpenEquipmentDetail,
}) {
  const zc = zoneObject?.zoneConfig || {};
  const zoneObjectId = zoneObject?.id;
  const values = useMemo(() => {
    const sim = buildSimulatedPointValuesForObjectId(zoneObjectId);
    return { ...sim, ...(mergedValues || {}) };
  }, [zoneObjectId, mergedValues]);
  const zoneName = (zc.zoneName || "").trim();
  const eqTitle = useMemo(
    () =>
      (equipmentTitle || "").trim() ||
      (zc.linkedEquipmentId ? String(zc.linkedEquipmentId) : "") ||
      "Equipment",
    [equipmentTitle, zc.linkedEquipmentId]
  );
  const detailRows = useMemo(() => buildDetailRows(zc, eqTitle, values), [zc, eqTitle, values]);
  const runtimeState = deriveZoneVisualState(zc, values);

  if (zc.enabled !== true) return null;
  if (zc.showGlassOverviewChip === false) return null;

  const detailsAllowed = zc.wedgeEnabled !== false;

  const { main: tempMain, unit: tempUnit } = parseTempMainDisplay(values.spaceTemp);
  const targetLabel = targetPillText(values.setpoint);

  const zx = zoneObject.x ?? 0;
  const zy = zoneObject.y ?? 0;
  const zw = Math.max(48, zoneObject.width ?? 80);
  const zh = Math.max(48, zoneObject.height ?? 80);
  const padX = Math.max(8, Math.min(18, zw * 0.08));
  const padY = Math.max(8, Math.min(22, zh * 0.09));

  const estHalfW = expanded ? 130 : 74;
  let cx = zx + zw / 2;
  const minCx = zx + padX + estHalfW;
  const maxCx = zx + zw - padX - estHalfW;
  if (minCx <= maxCx) {
    cx = Math.max(minCx, Math.min(maxCx, cx));
  }

  let top = zy + padY;
  const linkedId = zc.linkedEquipmentId;
  const canOpenDetails =
    detailsAllowed && zc.runtimeActions?.allowOpenDetails !== false && linkedId && onOpenEquipmentDetail;

  const showZoneSubtitle =
    zoneName && zoneName.toLowerCase() !== eqTitle.toLowerCase();

  const showStatusBadge = fieldEnabled(zc.wedgeFields, "statusChip");

  return (
    <div
      className={`floor-zone-glass-chip${expanded ? " floor-zone-glass-chip--expanded" : ""}`}
      style={{
        position: "absolute",
        left: cx,
        top,
        transform: "translateX(-50%)",
        zIndex: expanded ? 22 : 14,
        pointerEvents: "auto",
        maxWidth: Math.min(260, zw - padX * 2),
      }}
      role="group"
      aria-expanded={expanded}
      aria-label={eqTitle}
    >
      <div
        className="floor-zone-glass-chip__body"
        onClick={
          !expanded && detailsAllowed
            ? (e) => {
                e.stopPropagation();
                if (onToggleExpand) onToggleExpand();
              }
            : undefined
        }
        onKeyDown={
          !expanded && detailsAllowed
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onToggleExpand) onToggleExpand();
                }
              }
            : undefined
        }
        role={!expanded && detailsAllowed ? "button" : undefined}
        tabIndex={!expanded && detailsAllowed ? 0 : undefined}
      >
        <div className="floor-zone-glass-chip__glow" aria-hidden />
        <div className="floor-zone-glass-chip__header">
          <span className="floor-zone-glass-chip__eq" title={eqTitle}>
            {eqTitle}
          </span>
          <div className="floor-zone-glass-chip__header-actions">
            <span
              className={`floor-zone-glass-chip__dot ${statusDotClass(runtimeState)}`}
              title={values.alarmState || runtimeState}
            />
            <span className="floor-zone-glass-chip__power" title="Status">
              <FontAwesomeIcon icon={faBolt} className="floor-zone-glass-chip__power-icon" />
            </span>
            {expanded && detailsAllowed ? (
              <button
                type="button"
                className="floor-zone-glass-chip__icon-btn"
                title="Collapse"
                aria-label="Collapse"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleExpand) onToggleExpand();
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : detailsAllowed ? (
              <span className="floor-zone-glass-chip__chevron" aria-hidden>
                <FontAwesomeIcon icon={faChevronDown} />
              </span>
            ) : null}
          </div>
        </div>
        <div className="floor-zone-glass-chip__main">
          <span className="floor-zone-glass-chip__temp">
            {tempMain}
            {tempUnit ? <span className="floor-zone-glass-chip__temp-unit">{tempUnit}</span> : null}
          </span>
          <span className="floor-zone-glass-chip__target-pill">{targetLabel}</span>
        </div>
        {showZoneSubtitle ? (
          <div className="floor-zone-glass-chip__zone-line" title={zoneName}>
            {zoneName}
          </div>
        ) : null}

        {expanded && detailsAllowed && (
          <div className="floor-zone-glass-chip__expanded" onClick={(e) => e.stopPropagation()}>
            {showStatusBadge && (
              <div className="floor-zone-glass-chip__status-row">
                <span className="floor-zone-glass-chip__status-pill">
                  {values.zoneStatus || values.alarmState || "Normal"}
                </span>
              </div>
            )}
            <div className="floor-zone-glass-chip__details">
              {detailRows.map((row) => (
                <div key={row.label} className="floor-zone-glass-chip__detail-row">
                  <span className="floor-zone-glass-chip__detail-label">{row.label}</span>
                  <span className="floor-zone-glass-chip__detail-value">{row.value}</span>
                </div>
              ))}
            </div>
            {canOpenDetails && (
              <button
                type="button"
                className="floor-zone-glass-chip__open-details"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEquipmentDetail(linkedId);
                }}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} className="me-2" />
                Open Details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
