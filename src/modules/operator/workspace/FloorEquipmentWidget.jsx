import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCogs, faCube, faTh, faTint } from "@fortawesome/free-solid-svg-icons";
import { deriveZoneVisualState } from "../../engineering/graphics-manager/floorZoneModel";
import {
  equipmentWidgetAccent,
  floorWidgetLegendStatus,
  floorWidgetStatusLabel,
} from "../../../lib/operator/floorWidgetStatus";

function typeIcon(accent) {
  if (accent === "ahu") return faCogs;
  if (accent === "pump") return faTint;
  if (accent === "vav" || accent === "fcu") return faTh;
  return faCube;
}

function primaryValue(values, accent) {
  const temp = values.spaceTemp || values.zoneTemp;
  if (temp && temp !== "—" && String(temp).toLowerCase() !== "offline") {
    const s = String(temp);
    if (accent === "ahu" && !/supply/i.test(s)) return `Supply: ${s}`;
    return s;
  }
  if (values.mode && values.mode !== "—" && String(values.mode).toLowerCase() !== "offline") {
    return String(values.mode);
  }
  if (
    values.zoneStatus &&
    values.zoneStatus !== "—" &&
    values.zoneStatus !== "No Data" &&
    String(values.zoneStatus).toLowerCase() !== "offline"
  ) {
    return String(values.zoneStatus);
  }
  return "—";
}

/**
 * Operator floor pin + card (prototype widgets). Used only on Operator floor graphics.
 */
export default function FloorEquipmentWidget({
  zoneObject,
  mergedValues = {},
  equipmentTitle,
  equipmentType,
  expanded = false,
  onToggleExpand,
  onLookInto,
}) {
  const zc = zoneObject?.zoneConfig || {};
  if (zc.enabled !== true) return null;
  if (zc.showGlassOverviewChip === false) return null;

  const eqTitle =
    (equipmentTitle || "").trim() ||
    (zc.linkedEquipmentId ? String(zc.linkedEquipmentId) : "") ||
    "Equipment";
  const locationLine = (zc.zoneName || "").trim();
  const values = mergedValues || {};
  const runtimeState = deriveZoneVisualState(zc, values);
  const legendStatus = floorWidgetLegendStatus({
    runtimeState,
    comms: values.comms,
    zoneStatus: values.zoneStatus,
  });
  const statusLabel = floorWidgetStatusLabel(legendStatus, runtimeState);
  const accent = equipmentWidgetAccent(equipmentType);
  const value = primaryValue(values, accent);
  const linkedId = zc.linkedEquipmentId;

  const zx = zoneObject.x ?? 0;
  const zy = zoneObject.y ?? 0;
  const zw = Math.max(24, zoneObject.width ?? 80);
  const zh = Math.max(24, zoneObject.height ?? 80);
  const pinX = zx + zw / 2;
  const pinY = zy + zh / 2;

  const canLookIn = Boolean(linkedId && onLookInto);

  return (
    <div
      className={`floor-eq-widget floor-eq-widget--${legendStatus}${expanded ? " is-expanded" : ""}`}
      style={{ left: pinX, top: pinY }}
    >
      <button
        type="button"
        className="floor-eq-widget__card"
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleExpand) onToggleExpand();
        }}
      >
        <span className={`floor-eq-widget__badge floor-eq-widget__badge--${accent}`} aria-hidden="true">
          <FontAwesomeIcon icon={typeIcon(accent)} />
        </span>
        <span className="floor-eq-widget__copy">
          <span className="floor-eq-widget__name">{eqTitle}</span>
          {locationLine && locationLine.toLowerCase() !== eqTitle.toLowerCase() ? (
            <span className="floor-eq-widget__loc">{locationLine}</span>
          ) : null}
          <span className="floor-eq-widget__value">{value}</span>
          <span className={`floor-eq-widget__status floor-eq-widget__status--${legendStatus}`}>
            <span className="floor-eq-widget__status-dot" />
            {statusLabel}
          </span>
        </span>
      </button>
      {expanded && canLookIn ? (
        <button
          type="button"
          className="floor-eq-widget__look"
          onClick={(e) => {
            e.stopPropagation();
            onLookInto(linkedId);
          }}
        >
          Look into it
        </button>
      ) : null}
      <span className="floor-eq-widget__stem" aria-hidden="true" />
      <span className={`floor-eq-widget__pin floor-eq-widget__pin--${accent}`} aria-hidden="true" />
    </div>
  );
}
