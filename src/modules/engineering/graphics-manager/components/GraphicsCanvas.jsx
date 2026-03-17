import React, { useCallback, useState, useEffect } from "react";
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

/**
 * Canvas toolbar: Select, Pan, Zoom, Add Shape, Add Text, Add Value, Bind Point, Delete
 */
function CanvasToolbar({
  tool,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onAddText,
  onAddValue,
  onAddLink,
  onAddShape,
  onDeleteObject,
  hasSelection,
  canBindPoint,
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
}) {
  const { type, label, x, y, width = 60, height = 24, bindings = [], color, stroke, fill, opacity } = obj;
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

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(obj);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (type === "text" && onStartEditLabel) onStartEditLabel(obj.id);
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
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
  const fontSize = 14 * zoom;

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
    fontSize,
    color: color || undefined,
    borderColor: stroke || undefined,
  };
  if (isShape) {
    baseStyle.backgroundColor = fill || "rgba(255, 255, 255, 0.2)";
    baseStyle.border = "1px solid";
    baseStyle.borderColor = stroke || "rgba(255, 255, 255, 0.6)";
    baseStyle.opacity = opacity != null ? opacity : 1;
    baseStyle.pointerEvents = "auto";
  }

  const showResizeHandles = isShape && isSelected && onResizeHandleMouseDown;

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type}${valueStateClass} ${isSelected ? "graphics-canvas-object--selected" : ""} ${isLink ? "graphics-canvas-object--link" : ""} ${isShape ? "graphics-canvas-object--shape" : ""}`}
      style={baseStyle}
      onClick={handleClick}
      onDoubleClick={isLink ? undefined : handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
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
  onDeleteObject,
  availablePoints = [],
  previewMode = false,
  emptyMessage = "Select a graphic from the library to edit",
  canvasWidth = 800,
  canvasHeight = 500,
}) {
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [editingLabelObjectId, setEditingLabelObjectId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [backgroundDragState, setBackgroundDragState] = useState(false);
  const backgroundDragRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const objects = graphic?.objects || [];
  const selectedObject = objects.find((o) => o.id === selectedObjectId) || null;
  const canBindPoint = selectedObject ? selectedObject.type !== "text" && selectedObject.type !== "link" : false;

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 2));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  const handleCanvasClick = () => {
    if (onSelectObject) onSelectObject(null);
    setEditingLabelObjectId(null);
  };

  const handleObjectMouseDown = useCallback(
    (obj, e) => {
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
    [zoom, onUpdateObject]
  );

  const handleResizeHandleMouseDown = useCallback(
    (obj, handle, e) => {
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
    [onUpdateObject]
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
    if (!backgroundDragState || !onBackgroundPositionChange) return;
    const onMouseMove = (e) => {
      const prev = backgroundDragRef.current;
      if (!prev) return;
      const deltaX = (e.clientX - prev.lastClientX) / zoom;
      const deltaY = (e.clientY - prev.lastClientY) / zoom;
      onBackgroundPositionChange(deltaX, deltaY);
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
  }, [backgroundDragState, zoom, onBackgroundPositionChange]);

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
      <div className="graphics-canvas-wrapper bg-dark bg-opacity-25 rounded d-flex align-items-center justify-content-center border border-light border-opacity-10" style={{ minHeight: 400 }}>
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
      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onAddText={onAddText}
        onAddValue={onAddValue}
        onAddLink={onAddLink}
        onAddShape={onAddShape}
        onDeleteObject={selectedObjectId ? () => onDeleteObject(selectedObjectId) : undefined}
        hasSelection={!!selectedObjectId}
        canBindPoint={canBindPoint}
      />
      <div
        className="graphics-canvas-wrapper graphics-canvas-grid"
        style={{ minHeight: 400, position: "relative", overflow: "auto" }}
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
                left: graphic.backgroundImage.x ?? 0,
                top: graphic.backgroundImage.y ?? 0,
                width: canvasWidth,
                height: canvasHeight,
                zIndex: 0,
                pointerEvents: previewMode ? "none" : "auto",
                cursor: backgroundDragState ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => {
                if (previewMode || !onBackgroundPositionChange || e.button !== 0) return;
                e.stopPropagation();
                backgroundDragRef.current = { lastClientX: e.clientX, lastClientY: e.clientY };
                setBackgroundDragState(true);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={graphic.backgroundImage.dataUrl}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "center",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1 }}>
          {objects.map((obj) => (
            <CanvasObject
              key={obj.id}
              obj={obj}
              isSelected={selectedObjectId === obj.id}
              zoom={1}
              onSelect={() => onSelectObject?.(obj)}
              onUpdateObject={onUpdateObject}
              onObjectMouseDown={handleObjectMouseDown}
              onResizeHandleMouseDown={handleResizeHandleMouseDown}
              availablePoints={availablePoints}
              isEditingLabel={editingLabelObjectId === obj.id}
              onStartEditLabel={setEditingLabelObjectId}
              onFinishEditLabel={handleFinishEditLabel}
            />
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
