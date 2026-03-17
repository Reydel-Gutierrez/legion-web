import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * Read-only preview of a deployed equipment graphic.
 * Renders the same layout as Graphics Manager: background image/SVG, text, value, and link objects.
 * Value objects show live point values; link objects are clickable and call onLinkClick.
 */
function GraphicObject({ obj, pointsByPointId, onLinkClick }) {
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
        fontSize: 14,
        cursor: isLink && hasValidLink ? "pointer" : "default",
        pointerEvents: isLink && hasValidLink ? "auto" : "none",
        border: isShape ? "1px solid" : "none",
        borderRadius: isShape ? 0 : 0,
        boxShadow: "none",
        padding: isShape ? 0 : 0,
        backgroundColor: isShape ? (fill || "rgba(255,255,255,0.2)") : "transparent",
        borderColor: isShape ? (stroke || "rgba(255,255,255,0.6)") : "transparent",
        color: !isShape && type !== "value" ? color || undefined : undefined,
        opacity: isShape && opacity != null ? opacity : 1,
      }}
      onClick={handleLinkClick}
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

export default function DeployedGraphicPreview({ graphic, points = [], onLinkClick }) {
  const objects = graphic?.objects ?? [];
  const backgroundImage = graphic?.backgroundImage;
  const canvasWidth = graphic?.canvasSize?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = graphic?.canvasSize?.height ?? DEFAULT_CANVAS_HEIGHT;
  const pointsByPointId = useMemo(() => {
    const map = {};
    points.forEach((p) => {
      map[p.pointId] = p;
    });
    return map;
  }, [points]);

  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) {
        const s = Math.min(w / canvasWidth, h / canvasHeight, 1);
        setScale(s);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerStyle = {
    width: canvasWidth,
    height: canvasHeight,
    minWidth: canvasWidth,
    minHeight: canvasHeight,
    flexShrink: 0,
    background: "transparent",
    boxSizing: "border-box",
  };

  const contentCenter = useMemo(() => {
    if (objects.length === 0 && !backgroundImage) return { x: canvasWidth / 2, y: canvasHeight / 2 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((obj) => {
      const w = obj.width ?? 60;
      const h = obj.height ?? 24;
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    if (objects.length === 0 && backgroundImage) {
      return { x: canvasWidth / 2, y: canvasHeight / 2 };
    }
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }, [objects, backgroundImage, canvasWidth, canvasHeight]);

  if (objects.length === 0 && !backgroundImage) {
    return (
      <div
        className="d-flex align-items-center justify-content-center text-white-50 small"
        style={containerStyle}
      >
        No graphic defined. Create one in Engineering → Graphics Manager and deploy.
      </div>
    );
  }

  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  const translateX = canvasCenterX / scale - contentCenter.x;
  const translateY = canvasCenterY / scale - contentCenter.y;

  return (
    <div
      ref={containerRef}
      style={{ ...containerStyle, overflow: "visible" }}
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
              width: canvasWidth,
              height: canvasHeight,
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            <img
              src={backgroundImage.dataUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
              }}
            />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          {objects.map((obj) => (
            <GraphicObject
              key={obj.id}
              obj={obj}
              pointsByPointId={pointsByPointId}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
