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
      <button type="button" className="btn btn-sm legion-hero-btn legion-hero-btn--secondary" title="Add Shape">
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

/**
 * Canvas object: text, value (point display), or shape
 * - text: user-entered label; double-click to edit inline
 * - value: shows "Point" until bound, then shows actual point value
 * - Draggable via mousedown
 */
function CanvasObject({
  obj,
  isSelected,
  zoom,
  onSelect,
  onUpdateObject,
  onObjectMouseDown,
  availablePoints = [],
  isEditingLabel,
  onStartEditLabel,
  onFinishEditLabel,
}) {
  const { type, label, x, y, width = 60, height = 24, bindings = [], color, stroke } = obj;
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
    type === "value"
      ? boundPoint && pointInfo
        ? displayValue != null
          ? typeof displayValue === "number"
            ? `${displayValue}${pointInfo?.units || ""}`
            : String(displayValue)
          : (valueState === "offline" ? "Offline" : "—")
        : "Point"
      : label || "Text";

  const showInlineEdit = type === "text" && isEditingLabel;

  const valueStateClass =
    type === "value" && valueState
      ? ` graphics-canvas-object--${valueState}`
      : "";

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type}${valueStateClass} ${isSelected ? "graphics-canvas-object--selected" : ""}`}
      style={{
        left: scaled.x,
        top: scaled.y,
        width: scaled.w,
        minHeight: scaled.h,
        fontSize,
        color: color || undefined,
        borderColor: stroke || undefined,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {showInlineEdit ? (
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
  onDeleteObject,
  availablePoints = [],
  previewMode = false,
  emptyMessage = "Select a graphic from the library to edit",
}) {
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [editingLabelObjectId, setEditingLabelObjectId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const canvasRef = React.useRef(null);
  const objects = graphic?.objects || [];
  const selectedObject = objects.find((o) => o.id === selectedObjectId) || null;
  const canBindPoint = selectedObject ? selectedObject.type !== "text" : false;

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
      className={`graphics-canvas-container border border-light border-opacity-10 rounded overflow-hidden bg-primary ${dragState ? "graphics-canvas-container--dragging" : ""}`}
    >
      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onAddText={onAddText}
        onAddValue={onAddValue}
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
            width: 800,
            height: 500,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {objects.map((obj) => (
            <CanvasObject
              key={obj.id}
              obj={obj}
              isSelected={selectedObjectId === obj.id}
              zoom={1}
              onSelect={() => onSelectObject?.(obj)}
              onUpdateObject={onUpdateObject}
              onObjectMouseDown={handleObjectMouseDown}
              availablePoints={availablePoints}
              isEditingLabel={editingLabelObjectId === obj.id}
              onStartEditLabel={setEditingLabelObjectId}
              onFinishEditLabel={handleFinishEditLabel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
