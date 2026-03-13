import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * Read-only preview of a deployed equipment graphic.
 * Renders the same layout as Graphics Manager: fixed rectangle, transparent background,
 * text and value objects at their positions. Value objects show live point values from workspace rows.
 */
function GraphicObject({ obj, pointsByPointId }) {
  const { type, label, x, y, width = 60, height = 24, bindings = [] } = obj;
  const boundPoint = bindings[0];
  const pointRow = boundPoint ? pointsByPointId[boundPoint.pointId] : null;

  const displayText =
    type === "value"
      ? boundPoint && pointRow
        ? pointRow.value ?? "—"
        : "Point"
      : label || "Text";

  const isOffline = type === "value" && pointRow && (pointRow.status === "Unbound" || pointRow.status === "OFFLINE");
  const valueStateClass = type === "value" && isOffline ? " graphics-canvas-object--offline" : "";

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type} graphics-canvas-object--preview${valueStateClass}`}
      style={{
        left: x,
        top: y,
        width,
        minHeight: height,
        fontSize: 14,
        cursor: "default",
        pointerEvents: "none",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        padding: 0,
      }}
    >
      {displayText}
    </div>
  );
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

export default function DeployedGraphicPreview({ graphic, points = [] }) {
  const objects = graphic?.objects ?? [];
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
        const s = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT, 1);
        setScale(s);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerStyle = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    minWidth: CANVAS_WIDTH,
    minHeight: CANVAS_HEIGHT,
    flexShrink: 0,
    background: "transparent",
    boxSizing: "border-box",
  };

  const contentCenter = useMemo(() => {
    if (objects.length === 0) return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
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
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
  }, [objects]);

  if (objects.length === 0) {
    return (
      <div
        className="rounded border border-light border-opacity-10 d-flex align-items-center justify-content-center text-white-50 small"
        style={containerStyle}
      >
        No graphic defined. Create one in Engineering → Graphics Manager and deploy.
      </div>
    );
  }

  const canvasCenterX = CANVAS_WIDTH / 2;
  const canvasCenterY = CANVAS_HEIGHT / 2;
  const translateX = canvasCenterX / scale - contentCenter.x;
  const translateY = canvasCenterY / scale - contentCenter.y;

  return (
    <div
      ref={containerRef}
      className="rounded border border-light border-opacity-10"
      style={{ ...containerStyle, overflow: "visible" }}
    >
      <div
        className="graphics-canvas deployed-graphic-preview-canvas"
        style={{
          position: "relative",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: "0 0",
          background: "transparent",
        }}
      >
        {objects.map((obj) => (
          <GraphicObject key={obj.id} obj={obj} pointsByPointId={pointsByPointId} />
        ))}
      </div>
    </div>
  );
}
