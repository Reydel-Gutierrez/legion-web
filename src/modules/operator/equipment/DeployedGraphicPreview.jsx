import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import FloorZoneGlassChip from "../../engineering/graphics-manager/components/FloorZoneGlassChip";
import {
  isZoneShape,
  getStyleForZoneState,
  deriveZoneVisualState,
  resolveZonePointValuesForDisplay,
  buildSimulatedPointValuesForObjectId,
} from "../../engineering/graphics-manager/floorZoneModel";

/**
 * Read-only preview of a deployed equipment graphic.
 * Renders the same layout as Graphics Manager: background image/SVG, text, value, and link objects.
 * Value objects show live point values; link objects are clickable and call onLinkClick.
 */
function GraphicObject({
  obj,
  pointsByPointId,
  onLinkClick,
  floorZoneInteractive = false,
  zoneShapeStyle = null,
  onZoneMouseEnter,
  onZoneMouseLeave,
  onZoneClick,
}) {
  const {
    type,
    label,
    x,
    y,
    width = 60,
    height = 24,
    bindings = [],
    linkTarget,
    color,
    fill,
    stroke,
    opacity,
    borderRadius,
    fontSize,
    textAlign,
  } = obj;
  const boundPoint = bindings[0];
  const pointRow = boundPoint ? pointsByPointId[boundPoint.pointId] : null;

  const displayText =
    type === "link"
      ? label || "Link"
      : type === "value"
        ? boundPoint && pointRow
          ? pointRow.value ?? "—"
          : "Point"
        : label || "Text";

  const isOffline = type === "value" && pointRow && (pointRow.status === "Unbound" || pointRow.status === "OFFLINE");
  const valueStateClass = type === "value" && isOffline ? " graphics-canvas-object--offline" : "";
  const isLink = type === "link";
  const isShape = type === "shape";
  const isFloorZone = floorZoneInteractive && isShape && isZoneShape(obj);
  const hasValidLink =
    isLink &&
    linkTarget?.type &&
    (linkTarget.type === "layout" || linkTarget.type === "equipment" ? linkTarget.id : linkTarget.type === "url" ? linkTarget.url : linkTarget.type === "route" ? linkTarget.path : false);

  const handleLinkClick = (e) => {
    if (!hasValidLink || !onLinkClick) return;
    e.stopPropagation();
    onLinkClick(linkTarget);
  };

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type} graphics-canvas-object--preview${valueStateClass}`}
      style={{
        left: x,
        top: y,
        width,
        minHeight: height,
        fontSize: Number.isFinite(Number(fontSize)) ? Number(fontSize) : 14,
        cursor: isFloorZone ? "pointer" : isLink && hasValidLink ? "pointer" : "default",
        pointerEvents:
          isFloorZone || (isLink && hasValidLink) ? "auto" : "none",
        border: isShape ? "1px solid" : "none",
        borderRadius: isShape ? (Number.isFinite(Number(borderRadius)) ? Number(borderRadius) : 4) : 0,
        boxShadow: zoneShapeStyle?.boxShadow || "none",
        padding: isShape ? 0 : 0,
        backgroundColor: isShape
          ? zoneShapeStyle?.fill ?? fill ?? "rgba(255,255,255,0.2)"
          : "transparent",
        borderColor: isShape ? zoneShapeStyle?.stroke ?? stroke ?? "rgba(255,255,255,0.6)" : "transparent",
        color: !isShape && type !== "value" ? color || undefined : undefined,
        opacity: zoneShapeStyle?.opacity != null ? zoneShapeStyle.opacity : opacity != null ? opacity : 1,
        ...(type === "text" || type === "value" || type === "link"
          ? (() => {
              const align = (textAlign || "center").toLowerCase();
              return {
                textAlign: align === "left" ? "left" : align === "right" ? "right" : "center",
                alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
              };
            })()
          : {}),
      }}
      onClick={
        isFloorZone
          ? (e) => {
              e.stopPropagation();
              if (onZoneClick) onZoneClick(obj);
            }
          : handleLinkClick
      }
      onMouseEnter={isFloorZone ? () => onZoneMouseEnter?.(obj) : undefined}
      onMouseLeave={isFloorZone ? () => onZoneMouseLeave?.(obj) : undefined}
      onKeyDown={isLink && hasValidLink ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLinkClick(linkTarget); } } : undefined}
      role={isLink && hasValidLink ? "button" : undefined}
      tabIndex={isLink && hasValidLink ? 0 : undefined}
    >
      {isShape ? null : displayText}
    </div>
  );
}

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 500;

export const DEPLOYED_GRAPHIC_PRESENTATION = {
  /** Equipment detail / operator equipment graphics — existing viewport + fit behavior. */
  equipment: "equipment",
  /** Site / building / floor layout graphics — fill operator site layout workspace. */
  layout: "layout",
};

/**
 * For layout graphics, always include the full engineering canvas in the fit rect so floorplans
 * use the full canvas (not a tight crop around overlays only).
 */
function mergeLayoutScalingBounds(bounds, canvasWidth, canvasHeight) {
  return {
    minX: Math.min(bounds.minX, 0),
    minY: Math.min(bounds.minY, 0),
    maxX: Math.max(bounds.maxX, canvasWidth),
    maxY: Math.max(bounds.maxY, canvasHeight),
  };
}

export default function DeployedGraphicPreview({
  graphic,
  points = [],
  onLinkClick,
  maxWidth,
  maxHeight,
  zoomFactor = 1,
  presentation = DEPLOYED_GRAPHIC_PRESENTATION.equipment,
  onOpenEquipmentDetail,
  enableFloorZones = true,
  resolveEquipmentLabel,
}) {
  const objects = graphic?.objects ?? [];
  const backgroundImage = graphic?.backgroundImage;
  const canvasWidth = graphic?.canvasSize?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = graphic?.canvasSize?.height ?? DEFAULT_CANVAS_HEIGHT;
  const isLayoutPresentation = presentation === DEPLOYED_GRAPHIC_PRESENTATION.layout;
  // Viewport size (how big the preview rectangle is in the operator UI).
  // Decoupled from canvas world size so we can keep the graphic readable without
  // expanding the card to match engineering canvas dimensions.
  // Layout mode fills the parent; equipment uses explicit or canvas-sized viewport.
  const viewportWidth = maxWidth ?? canvasWidth;
  const viewportHeight = maxHeight ?? canvasHeight;
  const pointsByPointId = useMemo(() => {
    const map = {};
    points.forEach((p) => {
      map[p.pointId] = p;
    });
    return map;
  }, [points]);

  const floorZonesActive = Boolean(isLayoutPresentation && enableFloorZones);

  const pointsAsAuthoringList = useMemo(
    () =>
      (points || []).map((p) => ({
        id: p.pointId,
        displayValue: p.value,
        presentValue: p.value,
        valueState: p.status === "OFFLINE" || p.status === "Unbound" ? "offline" : "mapped",
      })),
    [points]
  );

  const zonePointValuesById = useMemo(() => {
    const map = {};
    (objects || []).forEach((o) => {
      if (!isZoneShape(o)) return;
      const raw = resolveZonePointValuesForDisplay(o.zoneConfig, pointsAsAuthoringList);
      const sim = buildSimulatedPointValuesForObjectId(o.id);
      map[o.id] = { ...sim, ...raw };
    });
    return map;
  }, [objects, pointsAsAuthoringList]);

  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [expandedGlassZoneId, setExpandedGlassZoneId] = useState(null);

  const getZoneShapeAppearance = useCallback(
    (obj) => {
      if (!floorZonesActive || !isZoneShape(obj)) return null;
      const zc = obj.zoneConfig || {};
      const pv = zonePointValuesById[obj.id] || {};
      const derived = deriveZoneVisualState(zc, pv);
      let stateKey = derived;
      if (expandedGlassZoneId === obj.id) stateKey = "selected";
      else if (hoveredZoneId === obj.id) stateKey = "hover";
      return getStyleForZoneState(zc, stateKey);
    },
    [floorZonesActive, zonePointValuesById, expandedGlassZoneId, hoveredZoneId]
  );

  const resolveEquipmentLabelFn = useCallback(
    (equipmentId) => {
      if (!equipmentId) return "";
      if (typeof resolveEquipmentLabel === "function") return resolveEquipmentLabel(equipmentId) || equipmentId;
      return equipmentId;
    },
    [resolveEquipmentLabel]
  );

  const handleZoneMouseEnter = useCallback((o) => {
    if (!isZoneShape(o)) return;
    setHoveredZoneId(o.id);
  }, []);

  const handleZoneMouseLeave = useCallback((o) => {
    if (!isZoneShape(o)) return;
    setHoveredZoneId(null);
  }, []);

  const handleZoneActivate = useCallback((o) => {
    if (!isZoneShape(o) || o.zoneConfig?.wedgeEnabled === false) return;
    setExpandedGlassZoneId((prev) => (prev === o.id ? null : o.id));
  }, []);

  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) {
        setContainerSize({ width: w, height: h });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerStyle = isLayoutPresentation
    ? {
        width: "100%",
        height: "100%",
        minHeight: 0,
        flex: "1 1 auto",
        alignSelf: "stretch",
        background: "transparent",
        boxSizing: "border-box",
        position: "relative",
      }
    : {
        width: viewportWidth,
        height: viewportHeight,
        minWidth: viewportWidth,
        minHeight: viewportHeight,
        flexShrink: 0,
        background: "transparent",
        boxSizing: "border-box",
      };

  const contentBounds = useMemo(() => {
    // Tight bounds of what’s actually “used” by this graphic:
    // - backgroundImage rectangle (if present)
    // - visible objects rectangles (using width/height)
    if (objects.length === 0 && !backgroundImage?.dataUrl) {
      return { minX: 0, minY: 0, maxX: canvasWidth, maxY: canvasHeight };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const includeRect = (x, y, w, h) => {
      const ww = Number.isFinite(Number(w)) ? Number(w) : 0;
      const hh = Number.isFinite(Number(h)) ? Number(h) : 0;
      const xx = Number.isFinite(Number(x)) ? Number(x) : 0;
      const yy = Number.isFinite(Number(y)) ? Number(y) : 0;
      minX = Math.min(minX, xx);
      minY = Math.min(minY, yy);
      maxX = Math.max(maxX, xx + ww);
      maxY = Math.max(maxY, yy + hh);
    };

    if (backgroundImage?.dataUrl) {
      const bgPad = 24;
      includeRect(
        (backgroundImage.x ?? 0) - bgPad,
        (backgroundImage.y ?? 0) - bgPad,
        (backgroundImage.width ?? canvasWidth) + bgPad * 2,
        (backgroundImage.height ?? canvasHeight) + bgPad * 2
      );
    }

    objects
      .filter((o) => o.visible !== false)
      .forEach((obj) => {
        const w = obj.width ?? 60;
        const h = obj.height ?? 24;
        const x = obj.x ?? 0;
        const y = obj.y ?? 0;
        // Text-like objects (text/value/link) are visually larger than their stored width/height.
        // Inflate bounds so they don't get clipped by the tight content fit.
        if (obj.type === "text" || obj.type === "value" || obj.type === "link") {
          const fs = Number.isFinite(Number(obj.fontSize)) ? Number(obj.fontSize) : 14;
          const extraW = Math.max(12, fs * 1.55);
          const extraH = Math.max(10, fs * 1.05);
          includeRect(x - extraW * 0.15, y - extraH * 0.35, w + extraW, h + extraH);
          return;
        }

        includeRect(x, y, w, h);
      });

    // Avoid invalid bounds if data is malformed.
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return { minX: 0, minY: 0, maxX: canvasWidth, maxY: canvasHeight };
    }

    // Inflate bounds so text rendering doesn't get clipped.
    // The editor stores width/height, but text can visually exceed it.
    // We use a base padding plus extra inflation for text-like objects.
    const basePadding = 50;
    minX -= basePadding;
    minY -= basePadding;
    maxX += basePadding;
    maxY += basePadding;

    // Ensure non-zero sizes.
    if (maxX - minX < 1) maxX = minX + 1;
    if (maxY - minY < 1) maxY = minY + 1;

    const bounds = { minX, minY, maxX, maxY };
    if (isLayoutPresentation) {
      return mergeLayoutScalingBounds(bounds, canvasWidth, canvasHeight);
    }
    return bounds;
  }, [objects, backgroundImage, canvasWidth, canvasHeight, isLayoutPresentation]);

  const contentCenter = useMemo(() => {
    return {
      x: (contentBounds.minX + contentBounds.maxX) / 2,
      y: (contentBounds.minY + contentBounds.maxY) / 2,
    };
  }, [contentBounds]);

  const contentSize = useMemo(() => {
    return {
      width: Math.max(1, contentBounds.maxX - contentBounds.minX),
      height: Math.max(1, contentBounds.maxY - contentBounds.minY),
    };
  }, [contentBounds]);

  // Recompute scale whenever container size or content bounds change.
  useEffect(() => {
    const w = containerSize.width;
    const h = containerSize.height;
    if (!w || !h) return;
    // Allow zoom-in so the graphic can fill the operator card area.
    // We intentionally do NOT clamp to 1 — if content bounds are smaller than the card,
    // scaling up makes the graphic occupy the intended space (cropping/overflow is handled by parent overflow).
    // Fit scale * additional zoom factor.
    // Keep a separate zoom so we can zoom in without changing the viewport rectangle size.
    const s = Math.min(w / contentSize.width, h / contentSize.height) * zoomFactor;
    setScale(s);
  }, [containerSize.width, containerSize.height, contentSize.width, contentSize.height, zoomFactor]);

  if (objects.length === 0 && !backgroundImage) {
    return (
      <div
        className={`d-flex align-items-center justify-content-center text-white-50 small${
          isLayoutPresentation ? " deployed-graphic-preview deployed-graphic-preview--layout" : ""
        }`}
        style={containerStyle}
      >
        No graphic defined. Create one in Engineering → Graphics Manager and deploy.
      </div>
    );
  }

  // Translate so contentBounds center lands at container center (in unscaled coordinates).
  const safeScale = scale || 1;
  const safeContainerW = containerSize.width || canvasWidth;
  const safeContainerH = containerSize.height || canvasHeight;
  const translateX = safeContainerW / (2 * safeScale) - contentCenter.x;
  const translateY = safeContainerH / (2 * safeScale) - contentCenter.y;

  return (
    <div
      ref={containerRef}
      className={`deployed-graphic-preview${isLayoutPresentation ? " deployed-graphic-preview--layout" : ""}`}
      style={{
        ...containerStyle,
        ...(isLayoutPresentation
          ? {
              overflow: "hidden",
              maxWidth: "100%",
            }
          : {
              // Equipment: viewport is fixed; allow overflow so labels are not clipped.
              overflow: "visible",
              maxWidth: "100%",
              margin: "0 auto",
            }),
      }}
    >
      <div
        className="graphics-canvas deployed-graphic-preview-canvas"
        style={{
          position: "relative",
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: "0 0",
          background: "transparent",
        }}
      >
        {backgroundImage?.dataUrl && (
          <div
            style={{
              position: "absolute",
              left: backgroundImage.x ?? 0,
              top: backgroundImage.y ?? 0,
              width: backgroundImage.width ?? canvasWidth,
              height: backgroundImage.height ?? canvasHeight,
              zIndex: 0,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            {(() => {
              const crop = backgroundImage?.crop;
              const hasCrop =
                crop &&
                Number.isFinite(Number(crop.width)) &&
                Number.isFinite(Number(crop.height)) &&
                Number.isFinite(Number(crop.x)) &&
                Number.isFinite(Number(crop.y));

              const bgW = backgroundImage.width ?? canvasWidth;
              const bgH = backgroundImage.height ?? canvasHeight;

              if (!hasCrop) {
                return (
                  <img
                    src={backgroundImage.dataUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: (backgroundImage.fit || "contain") === "cover" ? "cover" : "contain",
                      objectPosition:
                        (backgroundImage.fit || "contain") === "cover"
                          ? `${Number.isFinite(Number(backgroundImage.objectPositionX)) ? Number(backgroundImage.objectPositionX) : 50}% ${
                              Number.isFinite(Number(backgroundImage.objectPositionY)) ? Number(backgroundImage.objectPositionY) : 50
                            }%`
                          : "center",
                      display: "block",
                    }}
                  />
                );
              }

              const cropX = Number.isFinite(Number(crop.x)) ? Number(crop.x) : 0;
              const cropY = Number.isFinite(Number(crop.y)) ? Number(crop.y) : 0;
              const cropW = Math.max(1, Number(crop.width));
              const cropH = Math.max(1, Number(crop.height));

              const cropIsFull =
                cropX === 0 &&
                cropY === 0 &&
                cropW === bgW &&
                cropH === bgH;

              // If crop is full, keep original look (contain/cover) to avoid distortion.
              if (cropIsFull) {
                return (
                  <img
                    src={backgroundImage.dataUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: (backgroundImage.fit || "contain") === "cover" ? "cover" : "contain",
                      objectPosition:
                        (backgroundImage.fit || "contain") === "cover"
                          ? `${Number.isFinite(Number(backgroundImage.objectPositionX)) ? Number(backgroundImage.objectPositionX) : 50}% ${
                              Number.isFinite(Number(backgroundImage.objectPositionY)) ? Number(backgroundImage.objectPositionY) : 50
                            }%`
                          : "center",
                      display: "block",
                    }}
                  />
                );
              }

              // Cutout crop: apply a clip-mask so the picture is "cut" without zoom/distortion.
              const w = Math.max(1, bgW);
              const h = Math.max(1, bgH);
              const topPct = (cropY / h) * 100;
              const bottomPct = ((h - (cropY + cropH)) / h) * 100;
              const leftPct = (cropX / w) * 100;
              const rightPct = ((w - (cropX + cropW)) / w) * 100;
              const clip = `inset(${topPct}% ${rightPct}% ${bottomPct}% ${leftPct}%)`;

              return (
                <img
                  src={backgroundImage.dataUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: (backgroundImage.fit || "contain") === "cover" ? "cover" : "contain",
                    objectPosition:
                      (backgroundImage.fit || "contain") === "cover"
                        ? `${Number.isFinite(Number(backgroundImage.objectPositionX)) ? Number(backgroundImage.objectPositionX) : 50}% ${
                            Number.isFinite(Number(backgroundImage.objectPositionY)) ? Number(backgroundImage.objectPositionY) : 50
                          }%`
                        : "center",
                    display: "block",
                    clipPath: clip,
                    WebkitClipPath: clip,
                    position: "relative",
                  }}
                />
              );
            })()}
          </div>
        )}
        <div
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
          onClick={floorZonesActive ? () => setExpandedGlassZoneId(null) : undefined}
          role="presentation"
        >
          {objects.filter((obj) => obj.visible !== false).map((obj) => (
            <GraphicObject
              key={obj.id}
              obj={obj}
              pointsByPointId={pointsByPointId}
              onLinkClick={onLinkClick}
              floorZoneInteractive={floorZonesActive}
              zoneShapeStyle={getZoneShapeAppearance(obj)}
              onZoneMouseEnter={handleZoneMouseEnter}
              onZoneMouseLeave={handleZoneMouseLeave}
              onZoneClick={handleZoneActivate}
            />
          ))}
          {floorZonesActive &&
            objects
              .filter((obj) => obj.visible !== false)
              .map((obj) =>
                isZoneShape(obj) ? (
                  <FloorZoneGlassChip
                    key={`zone-glass-${obj.id}`}
                    zoneObject={obj}
                    mergedValues={zonePointValuesById[obj.id]}
                    equipmentTitle={resolveEquipmentLabelFn(obj.zoneConfig?.linkedEquipmentId)}
                    expanded={
                      expandedGlassZoneId === obj.id && obj.zoneConfig?.wedgeEnabled !== false
                    }
                    onToggleExpand={() =>
                      setExpandedGlassZoneId((prev) => (prev === obj.id ? null : obj.id))
                    }
                    onOpenEquipmentDetail={onOpenEquipmentDetail}
                  />
                ) : null
              )}
        </div>
      </div>
    </div>
  );
}
