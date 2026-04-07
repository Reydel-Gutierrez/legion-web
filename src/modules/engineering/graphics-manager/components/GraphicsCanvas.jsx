import React, { useCallback, useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMousePointer,
  faHandPaper,
  faSearchPlus,
  faSearchMinus,
  faSquare,
  faFont,
  faLink,
  faHashtag,
  faTrash,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import FloorZoneGlassChip from "./FloorZoneGlassChip";
import * as engineeringRepository from "../../../../lib/data/repositories/engineeringRepository";
import {
  isZoneShape,
  getStyleForZoneState,
  deriveZoneVisualState,
  resolveZonePointValuesForDisplay,
  buildSimulatedPointValuesForObjectId,
} from "../floorZoneModel";

/**
 * Canvas toolbar: Select, Pan, Zoom, Add Shape, Add Text, Add Value, Bind Point, Delete
 */
function CanvasToolbar({
  tool,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
  hasBackgroundImage,
  isBackgroundSelected,
  hasBackgroundCrop,
  isCroppingBackground,
  onToggleBackgroundCrop,
  onRevertBackgroundCrop,
  canRevertBackgroundCrop,
  onAddText,
  onAddValue,
  onAddLink,
  onAddShape,
  onDeleteObject,
  hasSelection,
  canBindPoint,
  liveZonePreview = false,
}) {
  return (
    <div className="graphics-canvas-toolbar d-flex align-items-center gap-2 p-2 border-bottom border-light border-opacity-10">
      <button
        type="button"
        className={`btn btn-sm ${tool === "select" ? "legion-hero-btn legion-hero-btn--primary" : "legion-hero-btn legion-hero-btn--secondary"}`}
        onClick={() => onToolChange("select")}
        title="Select"
      >
        <FontAwesomeIcon icon={faMousePointer} className="me-1" />
        Select
      </button>
      <button
        type="button"
        className={`btn btn-sm ${tool === "pan" ? "legion-hero-btn legion-hero-btn--primary" : "legion-hero-btn legion-hero-btn--secondary"}`}
        onClick={() => onToolChange("pan")}
        title="Pan"
      >
        <FontAwesomeIcon icon={faHandPaper} />
      </button>
      <div className="site-builder-toolbar-divider" />
      <button type="button" className="btn btn-sm legion-hero-btn legion-hero-btn--secondary" onClick={onZoomOut} title="Zoom out">
        <FontAwesomeIcon icon={faSearchMinus} />
      </button>
      <span className="text-white-50 small" style={{ minWidth: 48 }}>
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className="btn btn-sm legion-hero-btn legion-hero-btn--secondary" onClick={onZoomIn} title="Zoom in">
        <FontAwesomeIcon icon={faSearchPlus} />
      </button>
      <div className="site-builder-toolbar-divider" />
      {!liveZonePreview && (
        <>
      <button
        type="button"
        className={`btn btn-sm ${
          isCroppingBackground ? "legion-hero-btn legion-hero-btn--primary" : "legion-hero-btn legion-hero-btn--secondary"
        } ${!hasBackgroundImage || !isBackgroundSelected ? "disabled" : ""}`}
        onClick={onToggleBackgroundCrop}
        title={isCroppingBackground ? "Exit crop mode" : "Crop the selected picture"}
        disabled={!hasBackgroundImage || !isBackgroundSelected}
      >
        {isCroppingBackground ? "Done Cropping" : "Crop Picture"}
      </button>
      <button
        type="button"
        className={`btn btn-sm legion-hero-btn legion-hero-btn--secondary ${
          !canRevertBackgroundCrop ? "disabled" : ""
        }`}
        onClick={onRevertBackgroundCrop}
        title="Remove crop and show the full picture"
        disabled={!canRevertBackgroundCrop}
      >
        Revert
      </button>
      <div className="site-builder-toolbar-divider" />
      <button
        type="button"
        className="btn btn-sm legion-hero-btn legion-hero-btn--secondary"
        title="Add a square/rectangle shape (semi-transparent)"
        onClick={onAddShape}
      >
        <FontAwesomeIcon icon={faSquare} className="me-1" />
        Add Shape
      </button>
      <button
        type="button"
        className="btn btn-sm legion-hero-btn legion-hero-btn--secondary"
        title="Add Text"
        onClick={onAddText}
      >
        <FontAwesomeIcon icon={faFont} className="me-1" />
        Add Text
      </button>
      <button
        type="button"
        className="btn btn-sm legion-hero-btn legion-hero-btn--secondary"
        title="Add Value - displays Point until bound, then shows point value"
        onClick={onAddValue}
      >
        <FontAwesomeIcon icon={faHashtag} className="me-1" />
        Add Value
      </button>
      <button
        type="button"
        className="btn btn-sm legion-hero-btn legion-hero-btn--secondary"
        title="Add Link - button that links to another graphic or layout area"
        onClick={onAddLink}
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} className="me-1" />
        Add Link
      </button>
      <button
        type="button"
        className={`btn btn-sm ${canBindPoint ? "legion-hero-btn legion-hero-btn--secondary" : "legion-hero-btn legion-hero-btn--secondary disabled"}`}
        title={canBindPoint ? "Bind Point (Value objects only)" : "Bind Point — not available for Text objects"}
        disabled={!canBindPoint}
      >
        <FontAwesomeIcon icon={faLink} className="me-1" />
        Bind Point
      </button>
      <div className="site-builder-toolbar-divider" />
      <button
        type="button"
        className="btn btn-sm legion-hero-btn legion-hero-btn--secondary"
        title="Delete selected object"
        disabled={!hasSelection}
        onClick={onDeleteObject}
      >
        <FontAwesomeIcon icon={faTrash} className="me-1" />
        Delete
      </button>
        </>
      )}
    </div>
  );
}

const RESIZE_HANDLE_SIZE = 8;
const MIN_SHAPE_SIZE = 20;

/** Resize handle positions for shape: corners + edges */
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * Canvas object: text, value (point display), or shape
 * - text: user-entered label; double-click to edit inline
 * - value: shows "Point" until bound, then shows actual point value
 * - shape: draggable and resizable by corners/sides
 */
function CanvasObject({
  obj,
  isSelected,
  zoom,
  onSelect,
  onUpdateObject,
  onObjectMouseDown,
  onResizeHandleMouseDown,
  availablePoints = [],
  isEditingLabel,
  onStartEditLabel,
  onFinishEditLabel,
  liveZonePreview = false,
  shapeAppearance = null,
  zoneShowHoverChip = false,
  onZoneMouseEnter,
  onZoneMouseLeave,
  onZoneClick,
  noPointerEvents = false,
}) {
  const {
    type,
    label,
    x,
    y,
    width = 60,
    height = 24,
    bindings = [],
    color,
    stroke,
    fill,
    opacity,
    borderRadius,
    fontSize,
    textAlign,
  } = obj;
  const boundPoint = bindings[0];
  const pointInfo = boundPoint ? availablePoints.find((p) => p.id === boundPoint.pointId) : null;
  // Resolved from template point: displayValue (live, placeholder, or null for offline)
  const displayValue = pointInfo?.displayValue ?? pointInfo?.presentValue ?? null;
  const valueState = pointInfo?.valueState ?? null;
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  const zoneEnabled = isZoneShape(obj);

  const handleClick = (e) => {
    e.stopPropagation();
    if (liveZonePreview && zoneEnabled && onZoneClick) {
      onZoneClick(obj, e);
      return;
    }
    if (onSelect) onSelect(obj);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (type === "text" && onStartEditLabel) onStartEditLabel(obj.id);
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    if (liveZonePreview) return;
    if (onObjectMouseDown && e.button === 0) onObjectMouseDown(obj, e);
  };

  const handleLabelBlur = () => {
    if (!onFinishEditLabel || !inputRef.current) return;
    const value = inputRef.current.value.trim();
    onFinishEditLabel(obj.id, value || "Text");
  };

  const handleLabelKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputRef.current) inputRef.current.blur();
    }
    if (e.key === "Escape") {
      inputRef.current.value = label || "Text";
      inputRef.current.blur();
    }
  };

  const scaled = { x: x * zoom, y: y * zoom, w: width * zoom, h: height * zoom };
  const fontSizePxRaw = fontSize != null ? Number(fontSize) : 14;
  const fontSizePx = Number.isFinite(fontSizePxRaw) ? fontSizePxRaw : 14;
  const scaledFontSize = fontSizePx * zoom;

  // Value type: "Point" when unbound; when bound show live/placeholder/offline
  const displayText =
    type === "link"
      ? label || "Link"
      : type === "value"
        ? boundPoint && pointInfo
          ? displayValue != null
            ? typeof displayValue === "number"
              ? `${displayValue}${pointInfo?.units || ""}`
              : String(displayValue)
            : (valueState === "offline" ? "Offline" : "—")
          : "Point"
        : label || "Text";

  const showInlineEdit = type === "text" && isEditingLabel;
  const isLink = type === "link";

  const valueStateClass =
    type === "value" && valueState
      ? ` graphics-canvas-object--${valueState}`
      : "";
  const isShape = type === "shape";

  const baseStyle = {
    left: scaled.x,
    top: scaled.y,
    width: scaled.w,
    minHeight: scaled.h,
    fontSize: scaledFontSize,
    // Opacity is used by all objects (not only shapes) so inspector changes are visible.
    opacity: opacity != null ? opacity : 1,
    color: color || undefined,
    borderColor: stroke || undefined,
  };
  if (isShape) {
    const app = shapeAppearance;
    baseStyle.backgroundColor = app?.fill ?? fill ?? "rgba(255, 255, 255, 0.2)";
    baseStyle.border = "1px solid";
    baseStyle.borderColor = app?.stroke ?? stroke ?? "rgba(255, 255, 255, 0.6)";
    if (app?.opacity != null) baseStyle.opacity = app.opacity;
    if (app?.boxShadow) baseStyle.boxShadow = app.boxShadow;
    baseStyle.pointerEvents = noPointerEvents ? "none" : "auto";
    // Optional rounding override (defaults to the CSS radius)
    if (borderRadius != null) {
      const br = Number(borderRadius);
      if (Number.isFinite(br)) baseStyle.borderRadius = br;
    }
    if (shapeAppearance?.pulse) {
      baseStyle.animation = "floorZonePulse 1.4s ease-in-out infinite";
    }
  } else {
    // Text-like objects: allow alignment to match inspector.
    const align = (textAlign || "center").toLowerCase();
    if (type === "text" || type === "value" || type === "link") {
      baseStyle.textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
      baseStyle.alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
    }
    if (noPointerEvents) baseStyle.pointerEvents = "none";
  }

  const showResizeHandles =
    isShape && isSelected && onResizeHandleMouseDown && !obj?.locked && !liveZonePreview;

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type}${valueStateClass} ${isSelected ? "graphics-canvas-object--selected" : ""} ${isLink ? "graphics-canvas-object--link" : ""} ${isShape ? "graphics-canvas-object--shape" : ""}`}
      style={baseStyle}
      onClick={handleClick}
      onDoubleClick={isLink ? undefined : handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={zoneEnabled && liveZonePreview ? () => onZoneMouseEnter?.(obj) : undefined}
      onMouseLeave={zoneEnabled && liveZonePreview ? () => onZoneMouseLeave?.(obj) : undefined}
    >
      {zoneEnabled && liveZonePreview && zoneShowHoverChip && obj.zoneConfig?.hoverPreviewEnabled !== false && (
        <div
          className="position-absolute badge bg-dark border border-info border-opacity-40 text-info"
          style={{
            top: -22,
            left: 0,
            fontSize: 10,
            fontWeight: 600,
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          {obj.zoneConfig?.zoneName || "Zone"}
        </div>
      )}
      {showResizeHandles &&
        RESIZE_HANDLES.map((handle) => {
          const cursor =
            handle === "n" || handle === "s" ? "ns-resize" : handle === "e" || handle === "w" ? "ew-resize" : handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
          return (
            <div
              key={handle}
              className="graphics-canvas-resize-handle"
              data-handle={handle}
              style={{
                position: "absolute",
                width: RESIZE_HANDLE_SIZE,
                height: RESIZE_HANDLE_SIZE,
                marginLeft: -RESIZE_HANDLE_SIZE / 2,
                marginTop: -RESIZE_HANDLE_SIZE / 2,
                cursor,
                ...(handle === "nw" && { left: 0, top: 0 }),
                ...(handle === "n" && { left: "50%", top: 0 }),
                ...(handle === "ne" && { left: "100%", top: 0 }),
                ...(handle === "e" && { left: "100%", top: "50%" }),
                ...(handle === "se" && { left: "100%", top: "100%" }),
                ...(handle === "s" && { left: "50%", top: "100%" }),
                ...(handle === "sw" && { left: 0, top: "100%" }),
                ...(handle === "w" && { left: 0, top: "50%" }),
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeHandleMouseDown(obj, handle, e);
              }}
            />
          );
        })}
      {isShape ? null : showInlineEdit ? (
        <input
          ref={inputRef}
          type="text"
          className="graphics-canvas-object-input"
          defaultValue={label || "Text"}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            minWidth: 0,
            fontSize: "inherit",
            color: "inherit",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 2,
            padding: "2px 4px",
          }}
        />
      ) : (
        displayText
      )}
    </div>
  );
}

/**
 * Main graphics canvas with grid background
 */
export default function GraphicsCanvas({
  graphic,
  selectedObjectId,
  onSelectObject,
  onUpdateObject,
  onAddText,
  onAddValue,
  onAddLink,
  onAddShape,
  onBackgroundPositionChange,
  onBackgroundSizeChange,
  onBackgroundCropChange,
  onUpdateBackgroundImage,
  onDeleteObject,
  availablePoints = [],
  equipmentList = [],
  templates = null,
  previewMode = false,
  emptyMessage = "Select a graphic from the library to edit",
  canvasWidth = 800,
  canvasHeight = 500,
  liveZonePreview = false,
  onOpenEquipmentDetail,
  resolveEquipmentLabel,
}) {
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [editingLabelObjectId, setEditingLabelObjectId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [backgroundDragState, setBackgroundDragState] = useState(false);
  const [backgroundResizeState, setBackgroundResizeState] = useState(null);
  const [backgroundSelected, setBackgroundSelected] = useState(false);
  const [isCroppingBackground, setIsCroppingBackground] = useState(false);
  const [backgroundCropResizeState, setBackgroundCropResizeState] = useState(null);
  const backgroundDragRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [expandedGlassZoneId, setExpandedGlassZoneId] = useState(null);
  const onBackgroundPositionChangeRef = React.useRef(onBackgroundPositionChange);
  const onBackgroundSizeChangeRef = React.useRef(onBackgroundSizeChange);
  const onBackgroundCropChangeRef = React.useRef(onBackgroundCropChange);

  React.useEffect(() => {
    onBackgroundPositionChangeRef.current = onBackgroundPositionChange;
  }, [onBackgroundPositionChange]);

  React.useEffect(() => {
    onBackgroundSizeChangeRef.current = onBackgroundSizeChange;
  }, [onBackgroundSizeChange]);

  React.useEffect(() => {
    onBackgroundCropChangeRef.current = onBackgroundCropChange;
  }, [onBackgroundCropChange]);
  const objects = graphic?.objects || [];
  const selectedObject = objects.find((o) => o.id === selectedObjectId) || null;

  useEffect(() => {
    if (!liveZonePreview) {
      setHoveredZoneId(null);
      setExpandedGlassZoneId(null);
    }
  }, [liveZonePreview]);

  const zonePointValuesById = useMemo(() => {
    const map = {};
    objects.forEach((o) => {
      if (!isZoneShape(o)) return;
      const eqId = o.zoneConfig?.linkedEquipmentId;
      let pts = availablePoints;
      if (eqId && Array.isArray(equipmentList) && equipmentList.length) {
        const eq = equipmentList.find((e) => e.id === eqId);
        if (eq) {
          pts = engineeringRepository.getPointDisplayInfoForEquipment(eq, templates);
        }
      }
      const raw = resolveZonePointValuesForDisplay(o.zoneConfig, pts);
      const sim = buildSimulatedPointValuesForObjectId(o.id);
      map[o.id] = { ...sim, ...raw };
    });
    return map;
  }, [objects, availablePoints, equipmentList, templates]);

  const getZoneShapeAppearance = useCallback(
    (obj) => {
      if (!liveZonePreview || !isZoneShape(obj)) return null;
      const zc = obj.zoneConfig || {};
      const pv = zonePointValuesById[obj.id] || {};
      const derived = deriveZoneVisualState(zc, pv);
      let stateKey = derived;
      if (expandedGlassZoneId === obj.id) stateKey = "selected";
      else if (hoveredZoneId === obj.id) stateKey = "hover";
      return getStyleForZoneState(zc, stateKey);
    },
    [liveZonePreview, zonePointValuesById, expandedGlassZoneId, hoveredZoneId]
  );

  const handleZoneMouseEnter = useCallback((o) => {
    if (!isZoneShape(o)) return;
    setHoveredZoneId(o.id);
  }, []);

  const handleZoneMouseLeave = useCallback((o) => {
    if (!isZoneShape(o)) return;
    setHoveredZoneId(null);
  }, []);

  const handleZoneClick = useCallback(
    (o, e) => {
      if (!isZoneShape(o)) return;
      e.stopPropagation();
      if (!liveZonePreview) return;
      if (o.zoneConfig?.wedgeEnabled === false) return;
      setExpandedGlassZoneId((prev) => (prev === o.id ? null : o.id));
    },
    [liveZonePreview]
  );

  const canBindPoint = selectedObject ? selectedObject.type !== "text" && selectedObject.type !== "link" : false;

  const backgroundMinSize = 30;

  const backgroundImage = graphic?.backgroundImage || null;
  const hasBackgroundImage = !!backgroundImage?.dataUrl;
  const backgroundW = backgroundImage?.width ?? canvasWidth;
  const backgroundH = backgroundImage?.height ?? canvasHeight;

  const normalizedCrop = (() => {
    const c = backgroundImage?.crop;
    const cw = Number.isFinite(Number(c?.width)) ? Number(c.width) : backgroundW;
    const ch = Number.isFinite(Number(c?.height)) ? Number(c.height) : backgroundH;
    const x = Number.isFinite(Number(c?.x)) ? Number(c.x) : 0;
    const y = Number.isFinite(Number(c?.y)) ? Number(c.y) : 0;
    const w = Math.max(1, Math.min(backgroundW, cw));
    const h = Math.max(1, Math.min(backgroundH, ch));
    const nx = Math.max(0, Math.min(backgroundW - w, x));
    const ny = Math.max(0, Math.min(backgroundH - h, y));
    return { x: nx, y: ny, width: w, height: h };
  })();

  const hasBackgroundCrop =
    !!(
      backgroundImage?.crop &&
      Number.isFinite(Number(backgroundImage.crop.width)) &&
      Number.isFinite(Number(backgroundImage.crop.height)) &&
      Number.isFinite(Number(backgroundImage.crop.x)) &&
      Number.isFinite(Number(backgroundImage.crop.y))
    );

  const cropIsFull =
    hasBackgroundCrop &&
    normalizedCrop.x === 0 &&
    normalizedCrop.y === 0 &&
    normalizedCrop.width === backgroundW &&
    normalizedCrop.height === backgroundH;

  const useCropRender = hasBackgroundCrop && !cropIsFull;

  const cropClipPath = (() => {
    if (!useCropRender) return null;
    const w = Math.max(1, backgroundW);
    const h = Math.max(1, backgroundH);
    const topPx = normalizedCrop.y;
    const leftPx = normalizedCrop.x;
    const rightPx = w - (normalizedCrop.x + normalizedCrop.width);
    const bottomPx = h - (normalizedCrop.y + normalizedCrop.height);
    const topPct = (topPx / h) * 100;
    const bottomPct = (bottomPx / h) * 100;
    const leftPct = (leftPx / w) * 100;
    const rightPct = (rightPx / w) * 100;
    // inset(top right bottom left)
    return `inset(${topPct}% ${rightPct}% ${bottomPct}% ${leftPct}%)`;
  })();

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 2));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  const handleCanvasClick = () => {
    setExpandedGlassZoneId(null);
    if (onSelectObject) onSelectObject(null);
    setEditingLabelObjectId(null);
    setBackgroundSelected(false);
    setIsCroppingBackground(false);
  };

  const handleObjectMouseDown = useCallback(
    (obj, e) => {
      if (liveZonePreview) return;
      // Lock prevents dragging/resizing while still allowing selection.
      if (obj?.locked) return;
      if (!canvasRef.current || !onUpdateObject) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const startLogicalX = (e.clientX - rect.left) / zoom;
      const startLogicalY = (e.clientY - rect.top) / zoom;
      setDragState({
        objectId: obj.id,
        object: obj,
        startObjX: obj.x ?? 0,
        startObjY: obj.y ?? 0,
        startLogicalX,
        startLogicalY,
        canvasRect: rect,
      });
    },
    [zoom, onUpdateObject, liveZonePreview]
  );

  const handleResizeHandleMouseDown = useCallback(
    (obj, handle, e) => {
      if (liveZonePreview) return;
      // Lock prevents moving/resizing while still allowing selection.
      if (obj?.locked) return;
      if (!canvasRef.current || !onUpdateObject || obj.type !== "shape") return;
      const rect = canvasRef.current.getBoundingClientRect();
      setResizeState({
        objectId: obj.id,
        object: obj,
        handle,
        startX: obj.x ?? 0,
        startY: obj.y ?? 0,
        startWidth: obj.width ?? 80,
        startHeight: obj.height ?? 80,
        canvasRect: rect,
      });
    },
    [onUpdateObject, liveZonePreview]
  );

  const handleFinishEditLabel = useCallback(
    (objectId, newLabel) => {
      setEditingLabelObjectId(null);
      if (!onUpdateObject) return;
      const obj = objects.find((o) => o.id === objectId);
      if (obj) onUpdateObject(objectId, { ...obj, label: newLabel });
    },
    [onUpdateObject, objects]
  );

  useEffect(() => {
    if (!dragState || !onUpdateObject) return;
    const onMouseMove = (e) => {
      const { object, startObjX, startObjY, startLogicalX, startLogicalY, canvasRect } = dragState;
      const currentLogicalX = (e.clientX - canvasRect.left) / zoom;
      const currentLogicalY = (e.clientY - canvasRect.top) / zoom;
      const offsetX = startLogicalX - startObjX;
      const offsetY = startLogicalY - startObjY;
      const newX = Math.round(currentLogicalX - offsetX);
      const newY = Math.round(currentLogicalY - offsetY);
      onUpdateObject(object.id, { ...object, x: newX, y: newY });
    };
    const onMouseUp = () => setDragState(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragState, zoom, onUpdateObject]);

  useEffect(() => {
    if (!resizeState || !onUpdateObject) return;
    const { object, handle, startX, startY, startWidth, startHeight, canvasRect } = resizeState;
    const onMouseMove = (e) => {
      const curX = (e.clientX - canvasRect.left) / zoom;
      const curY = (e.clientY - canvasRect.top) / zoom;
      let newX = startX;
      let newY = startY;
      let newW = startWidth;
      let newH = startHeight;
      const right = startX + startWidth;
      const bottom = startY + startHeight;
      switch (handle) {
        case "se":
          newW = Math.max(MIN_SHAPE_SIZE, curX - startX);
          newH = Math.max(MIN_SHAPE_SIZE, curY - startY);
          break;
        case "s":
          newH = Math.max(MIN_SHAPE_SIZE, curY - startY);
          break;
        case "e":
          newW = Math.max(MIN_SHAPE_SIZE, curX - startX);
          break;
        case "sw":
          newX = Math.min(curX, right - MIN_SHAPE_SIZE);
          newY = startY;
          newW = right - newX;
          newH = Math.max(MIN_SHAPE_SIZE, curY - startY);
          break;
        case "w":
          newX = Math.min(curX, right - MIN_SHAPE_SIZE);
          newW = right - newX;
          break;
        case "n":
          newY = Math.min(curY, bottom - MIN_SHAPE_SIZE);
          newH = bottom - newY;
          break;
        case "nw":
          newX = Math.min(curX, right - MIN_SHAPE_SIZE);
          newY = Math.min(curY, bottom - MIN_SHAPE_SIZE);
          newW = right - newX;
          newH = bottom - newY;
          break;
        case "ne":
          newY = Math.min(curY, bottom - MIN_SHAPE_SIZE);
          newW = Math.max(MIN_SHAPE_SIZE, curX - startX);
          newH = bottom - newY;
          break;
        default:
          break;
      }
      onUpdateObject(object.id, { ...object, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) });
    };
    const onMouseUp = () => setResizeState(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizeState, zoom, onUpdateObject]);

  useEffect(() => {
    if (!backgroundDragState) return;
    const onMouseMove = (e) => {
      const prev = backgroundDragRef.current;
      if (!prev) return;
      const deltaX = (e.clientX - prev.lastClientX) / zoom;
      const deltaY = (e.clientY - prev.lastClientY) / zoom;
      if (onBackgroundPositionChangeRef.current) onBackgroundPositionChangeRef.current(deltaX, deltaY);
      backgroundDragRef.current = { lastClientX: e.clientX, lastClientY: e.clientY };
    };
    const onMouseUp = () => {
      setBackgroundDragState(false);
      backgroundDragRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [backgroundDragState, zoom]);

  useEffect(() => {
    if (!backgroundResizeState) return;

    const { handle, startX, startY, startW, startH, startLogicalX, startLogicalY, canvasRect } = backgroundResizeState;

    const onMouseMove = (e) => {
      const curLogicalX = (e.clientX - canvasRect.left) / zoom;
      const curLogicalY = (e.clientY - canvasRect.top) / zoom;
      const dx = curLogicalX - startLogicalX;
      const dy = curLogicalY - startLogicalY;

      let newX = startX;
      let newY = startY;
      let newW = startW;
      let newH = startH;

      const minW = backgroundMinSize;
      const minH = backgroundMinSize;

      const clampWidthFromLeft = (proposedW, proposedX) => {
        if (proposedW < minW) return { w: minW, x: proposedX + (proposedW - minW) };
        return { w: proposedW, x: proposedX };
      };

      const clampHeightFromTop = (proposedH, proposedY) => {
        if (proposedH < minH) return { h: minH, y: proposedY + (proposedH - minH) };
        return { h: proposedH, y: proposedY };
      };

      switch (handle) {
        case "e": {
          newW = Math.max(minW, startW + dx);
          break;
        }
        case "w": {
          const proposedW = startW - dx;
          const proposedX = startX + dx;
          const clamped = clampWidthFromLeft(proposedW, proposedX);
          newW = clamped.w;
          newX = clamped.x;
          break;
        }
        case "s": {
          newH = Math.max(minH, startH + dy);
          break;
        }
        case "n": {
          const proposedH = startH - dy;
          const proposedY = startY + dy;
          const clamped = clampHeightFromTop(proposedH, proposedY);
          newH = clamped.h;
          newY = clamped.y;
          break;
        }
        case "ne": {
          newW = Math.max(minW, startW + dx);
          const proposedH = startH - dy;
          const proposedY = startY + dy;
          const clamped = clampHeightFromTop(proposedH, proposedY);
          newH = clamped.h;
          newY = clamped.y;
          break;
        }
        case "nw": {
          const proposedW = startW - dx;
          const proposedX = startX + dx;
          const clampedW = clampWidthFromLeft(proposedW, proposedX);
          newW = clampedW.w;
          newX = clampedW.x;

          const proposedH = startH - dy;
          const proposedY = startY + dy;
          const clampedH = clampHeightFromTop(proposedH, proposedY);
          newH = clampedH.h;
          newY = clampedH.y;
          break;
        }
        case "se": {
          newW = Math.max(minW, startW + dx);
          newH = Math.max(minH, startH + dy);
          break;
        }
        case "sw": {
          const proposedW = startW - dx;
          const proposedX = startX + dx;
          const clampedW = clampWidthFromLeft(proposedW, proposedX);
          newW = clampedW.w;
          newX = clampedW.x;

          newH = Math.max(minH, startH + dy);
          break;
        }
        default:
          break;
      }

      if (onBackgroundSizeChangeRef.current) {
        onBackgroundSizeChangeRef.current({ x: newX, y: newY, width: newW, height: newH });
      }
    };

    const onMouseUp = () => setBackgroundResizeState(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [backgroundResizeState, zoom]);

  useEffect(() => {
    if (!backgroundCropResizeState) return;
    const { handle, startCrop, startLogicalX, startLogicalY, canvasRect, bgW, bgH } = backgroundCropResizeState;

    const minCropSize = 20;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const onMouseMove = (e) => {
      const curLogicalX = (e.clientX - canvasRect.left) / zoom;
      const curLogicalY = (e.clientY - canvasRect.top) / zoom;
      const dx = curLogicalX - startLogicalX;
      const dy = curLogicalY - startLogicalY;

      const right0 = startCrop.x + startCrop.width;
      const bottom0 = startCrop.y + startCrop.height;
      const left0 = startCrop.x;
      const top0 = startCrop.y;

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.width;
      let newH = startCrop.height;

      switch (handle) {
        case "e":
          newW = clamp(startCrop.width + dx, minCropSize, bgW - left0);
          newX = left0;
          break;
        case "w": {
          const proposedX = startCrop.x + dx;
          newX = clamp(proposedX, 0, right0 - minCropSize);
          newW = right0 - newX;
          break;
        }
        case "s":
          newH = clamp(startCrop.height + dy, minCropSize, bgH - top0);
          newY = top0;
          break;
        case "n": {
          const proposedY = startCrop.y + dy;
          newY = clamp(proposedY, 0, bottom0 - minCropSize);
          newH = bottom0 - newY;
          break;
        }
        case "se":
          newW = clamp(startCrop.width + dx, minCropSize, bgW - left0);
          newH = clamp(startCrop.height + dy, minCropSize, bgH - top0);
          newX = left0;
          newY = top0;
          break;
        case "sw": {
          const proposedX = startCrop.x + dx;
          newX = clamp(proposedX, 0, right0 - minCropSize);
          newW = right0 - newX;
          newH = clamp(startCrop.height + dy, minCropSize, bgH - top0);
          newY = top0;
          break;
        }
        case "ne": {
          newW = clamp(startCrop.width + dx, minCropSize, bgW - left0);
          newX = left0;
          const proposedY = startCrop.y + dy;
          newY = clamp(proposedY, 0, bottom0 - minCropSize);
          newH = bottom0 - newY;
          break;
        }
        case "nw": {
          const proposedX = startCrop.x + dx;
          newX = clamp(proposedX, 0, right0 - minCropSize);
          newW = right0 - newX;
          const proposedY = startCrop.y + dy;
          newY = clamp(proposedY, 0, bottom0 - minCropSize);
          newH = bottom0 - newY;
          break;
        }
        default:
          break;
      }

      if (!onBackgroundCropChangeRef.current) return;
      onBackgroundCropChangeRef.current({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    };

    const onMouseUp = () => setBackgroundCropResizeState(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [backgroundCropResizeState, zoom]);

  const handleKeyDown = useCallback(
    (e) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isInput) return;
      if (!selectedObjectId || !onDeleteObject) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDeleteObject(selectedObjectId);
      }
    },
    [selectedObjectId, onDeleteObject]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!graphic) {
    return (
      <div
        className="graphics-canvas-wrapper bg-dark bg-opacity-25 rounded d-flex align-items-center justify-content-center border border-light border-opacity-10"
        style={{ minHeight: Math.max(400, canvasHeight) }}
      >
        <div className="text-center text-white-50 py-5">
          <p className="mb-0">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`graphics-canvas-container border border-light border-opacity-10 rounded overflow-hidden bg-primary ${dragState || backgroundDragState ? "graphics-canvas-container--dragging" : ""}`}
    >
      {liveZonePreview && (
        <div className="px-2 py-1 small text-info bg-dark border-bottom border-info border-opacity-25">
          Live zone preview — hover zones for highlight; click a zone to open the wedge. Click empty floor to close.
        </div>
      )}
      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        hasBackgroundImage={hasBackgroundImage}
        isBackgroundSelected={backgroundSelected}
        hasBackgroundCrop={hasBackgroundCrop}
        isCroppingBackground={isCroppingBackground}
        onToggleBackgroundCrop={() => {
          if (!hasBackgroundImage) return;
          if (!onBackgroundCropChangeRef.current) return;
          setBackgroundSelected(true);
          setIsCroppingBackground((prev) => {
            const next = !prev;
            if (next && !graphic?.backgroundImage?.crop) {
              onBackgroundCropChangeRef.current({
                x: 0,
                y: 0,
                width: backgroundW,
                height: backgroundH,
              });
            }
            return next;
          });
        }}
        canRevertBackgroundCrop={
          !!onUpdateBackgroundImage && hasBackgroundImage && backgroundSelected && hasBackgroundCrop
        }
        onRevertBackgroundCrop={() => {
          if (!onUpdateBackgroundImage || !hasBackgroundImage || !backgroundSelected || !hasBackgroundCrop) return;
          onUpdateBackgroundImage({ crop: null });
          setIsCroppingBackground(false);
        }}
        onAddText={onAddText}
        onAddValue={onAddValue}
        onAddLink={onAddLink}
        onAddShape={onAddShape}
        onDeleteObject={selectedObjectId ? () => onDeleteObject(selectedObjectId) : undefined}
        hasSelection={!!selectedObjectId}
        canBindPoint={canBindPoint}
        liveZonePreview={liveZonePreview}
      />
      <div
        className="graphics-canvas-wrapper graphics-canvas-grid"
        style={{ minHeight: Math.max(400, canvasHeight), position: "relative", overflow: "auto" }}
        onClick={handleCanvasClick}
      >
        <div
          ref={canvasRef}
          className="graphics-canvas"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {graphic?.backgroundImage?.dataUrl && (
            <div
              className="graphics-canvas-background"
              style={{
                position: "absolute",
                  left: backgroundImage?.x ?? 0,
                  top: backgroundImage?.y ?? 0,
                  width: backgroundW ?? canvasWidth,
                  height: backgroundH ?? canvasHeight,
                zIndex: 0,
                pointerEvents: previewMode ? "none" : "auto",
                  cursor: isCroppingBackground ? "crosshair" : backgroundDragState ? "grabbing" : "grab",
                  overflow: "visible",
                  border: backgroundSelected && !isCroppingBackground ? "1px solid rgba(13, 202, 240, 0.8)" : "none",
              }}
              onMouseDown={(e) => {
                  if (
                    previewMode ||
                    !onBackgroundPositionChange ||
                    !backgroundImage ||
                    backgroundResizeState ||
                    isCroppingBackground ||
                    e.button !== 0
                  )
                    return;
                  setBackgroundSelected(true);
                e.stopPropagation();
                backgroundDragRef.current = { lastClientX: e.clientX, lastClientY: e.clientY };
                setBackgroundDragState(true);
              }}
              onClick={(e) => e.stopPropagation()}
            >
                <img
                  src={backgroundImage.dataUrl}
                  alt=""
                  draggable={false}
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
                    pointerEvents: "none",
                    clipPath: cropClipPath || undefined,
                    WebkitClipPath: cropClipPath || undefined,
                  }}
                />

                {isCroppingBackground && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: normalizedCrop.x,
                        top: normalizedCrop.y,
                        width: normalizedCrop.width,
                        height: normalizedCrop.height,
                        boxSizing: "border-box",
                        border: "1px solid rgba(13, 202, 240, 0.95)",
                        zIndex: 4,
                        pointerEvents: "none",
                      }}
                    />
                    {RESIZE_HANDLES.map((handle) => {
                      const cursor =
                        handle === "n" || handle === "s"
                          ? "ns-resize"
                          : handle === "e" || handle === "w"
                            ? "ew-resize"
                            : handle === "nw" || handle === "se"
                              ? "nwse-resize"
                              : "nesw-resize";
                      const left =
                        handle === "nw" || handle === "w" || handle === "sw"
                          ? normalizedCrop.x
                          : handle === "ne" || handle === "e" || handle === "se"
                            ? normalizedCrop.x + normalizedCrop.width
                            : normalizedCrop.x + normalizedCrop.width / 2;
                      const top =
                        handle === "nw" || handle === "n" || handle === "ne"
                          ? normalizedCrop.y
                          : handle === "sw" || handle === "s" || handle === "se"
                            ? normalizedCrop.y + normalizedCrop.height
                            : normalizedCrop.y + normalizedCrop.height / 2;

                      return (
                        <div
                          key={handle}
                          className="graphics-canvas-background-resize-handle graphics-canvas-resize-handle"
                          data-handle={handle}
                          style={{
                            position: "absolute",
                            width: RESIZE_HANDLE_SIZE,
                            height: RESIZE_HANDLE_SIZE,
                            marginLeft: -RESIZE_HANDLE_SIZE / 2,
                            marginTop: -RESIZE_HANDLE_SIZE / 2,
                            cursor,
                            left,
                            top,
                            zIndex: 5,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!canvasRef.current) return;
                            if (!onBackgroundCropChangeRef.current) return;
                            if (e.button !== 0) return;
                            const rect = canvasRef.current.getBoundingClientRect();
                            const startLogicalX = (e.clientX - rect.left) / zoom;
                            const startLogicalY = (e.clientY - rect.top) / zoom;
                            setBackgroundCropResizeState({
                              handle,
                              startCrop: normalizedCrop,
                              startLogicalX,
                              startLogicalY,
                              canvasRect: rect,
                              bgW: backgroundW,
                              bgH: backgroundH,
                            });
                          }}
                        />
                      );
                    })}
                  </>
                )}

                {!previewMode && onBackgroundSizeChange && !isCroppingBackground && (
                <>
                  {RESIZE_HANDLES.map((handle) => {
                    const cursor =
                      handle === "n" || handle === "s"
                        ? "ns-resize"
                        : handle === "e" || handle === "w"
                          ? "ew-resize"
                          : handle === "nw" || handle === "se"
                            ? "nwse-resize"
                            : "nesw-resize";

                    return (
                      <div
                        key={handle}
                        className="graphics-canvas-background-resize-handle graphics-canvas-resize-handle"
                        data-handle={handle}
                        style={{
                          position: "absolute",
                          width: RESIZE_HANDLE_SIZE,
                          height: RESIZE_HANDLE_SIZE,
                          marginLeft: -RESIZE_HANDLE_SIZE / 2,
                          marginTop: -RESIZE_HANDLE_SIZE / 2,
                          cursor,
                          ...(handle === "nw" && { left: 0, top: 0 }),
                          ...(handle === "n" && { left: "50%", top: 0 }),
                          ...(handle === "ne" && { left: "100%", top: 0 }),
                          ...(handle === "e" && { left: "100%", top: "50%" }),
                          ...(handle === "se" && { left: "100%", top: "100%" }),
                          ...(handle === "s" && { left: "50%", top: "100%" }),
                          ...(handle === "sw" && { left: 0, top: "100%" }),
                          ...(handle === "w" && { left: 0, top: "50%" }),
                          zIndex: 3,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!canvasRef.current) return;
                          const rect = canvasRef.current.getBoundingClientRect();
                          const startLogicalX = (e.clientX - rect.left) / zoom;
                          const startLogicalY = (e.clientY - rect.top) / zoom;
                          const bg = graphic.backgroundImage || {};
                          setBackgroundResizeState({
                            handle,
                            startX: bg.x ?? 0,
                            startY: bg.y ?? 0,
                            startW: bg.width ?? canvasWidth,
                            startH: bg.height ?? canvasHeight,
                            startLogicalX,
                            startLogicalY,
                            canvasRect: rect,
                          });
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1 }}>
          {objects.map((obj) => (
            obj.visible === false ? null : (
              <CanvasObject
                key={obj.id}
                obj={obj}
                isSelected={selectedObjectId === obj.id}
                zoom={1}
                onSelect={() => {
                  setBackgroundSelected(false);
                  setIsCroppingBackground(false);
                  if (onSelectObject) onSelectObject(obj);
                }}
                onUpdateObject={onUpdateObject}
                onObjectMouseDown={handleObjectMouseDown}
                onResizeHandleMouseDown={handleResizeHandleMouseDown}
                availablePoints={availablePoints}
                isEditingLabel={editingLabelObjectId === obj.id}
                onStartEditLabel={setEditingLabelObjectId}
                onFinishEditLabel={handleFinishEditLabel}
                liveZonePreview={liveZonePreview}
                shapeAppearance={getZoneShapeAppearance(obj)}
                zoneShowHoverChip={false}
                onZoneMouseEnter={handleZoneMouseEnter}
                onZoneMouseLeave={handleZoneMouseLeave}
                onZoneClick={handleZoneClick}
                noPointerEvents={!!liveZonePreview && !isZoneShape(obj)}
              />
            )
          ))}
          {objects.map((obj) =>
            obj.visible === false || !isZoneShape(obj) ? null : (
              <FloorZoneGlassChip
                key={`zone-glass-${obj.id}`}
                zoneObject={obj}
                mergedValues={zonePointValuesById[obj.id]}
                equipmentTitle={resolveEquipmentLabel?.(obj.zoneConfig?.linkedEquipmentId)}
                expanded={
                  expandedGlassZoneId === obj.id && obj.zoneConfig?.wedgeEnabled !== false
                }
                onToggleExpand={() =>
                  setExpandedGlassZoneId((prev) => (prev === obj.id ? null : obj.id))
                }
                onOpenEquipmentDetail={onOpenEquipmentDetail}
              />
            )
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
