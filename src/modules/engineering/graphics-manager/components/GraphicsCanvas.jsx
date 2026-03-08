import React, { useCallback, useState } from "react";
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
} from "@fortawesome/free-solid-svg-icons";

/**
 * Canvas toolbar: Select, Pan, Zoom, Add Shape, Add Text, Add Value, Bind Point
 */
function CanvasToolbar({ tool, onToolChange, zoom, onZoomIn, onZoomOut, onAddText, onAddValue }) {
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
      <button type="button" className="btn btn-sm legion-hero-btn legion-hero-btn--secondary" title="Bind Point">
        <FontAwesomeIcon icon={faLink} className="me-1" />
        Bind Point
      </button>
    </div>
  );
}

/**
 * Canvas object: text, value (point display), or shape
 * - text: user-entered label
 * - value: shows "Point" until bound, then shows actual point value
 */
function CanvasObject({
  obj,
  isSelected,
  zoom,
  onSelect,
  availablePoints = [],
}) {
  const { type, label, x, y, width = 60, height = 24, bindings = [] } = obj;
  const boundPoint = bindings[0];
  const pointInfo = boundPoint ? availablePoints.find((p) => p.id === boundPoint.pointId) : null;
  const displayValue = pointInfo?.presentValue ?? null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(obj);
  };

  const scaled = { x: x * zoom, y: y * zoom, w: width * zoom, h: height * zoom };
  const fontSize = 14 * zoom;

  // Value type: "Point" when unbound, actual value when bound
  const displayText =
    type === "value"
      ? boundPoint && pointInfo && displayValue != null
        ? typeof displayValue === "number"
          ? `${displayValue}${pointInfo?.units || ""}`
          : String(displayValue)
        : "Point"
      : label || "Text";

  return (
    <div
      className={`graphics-canvas-object graphics-canvas-object--${type} ${isSelected ? "graphics-canvas-object--selected" : ""}`}
      style={{
        left: scaled.x,
        top: scaled.y,
        width: scaled.w,
        minHeight: scaled.h,
        fontSize,
      }}
      onClick={handleClick}
    >
      {displayText}
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
  onAddText,
  onAddValue,
  availablePoints = [],
  previewMode = false,
  emptyMessage = "Select a graphic from the library to edit",
}) {
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const objects = graphic?.objects || [];

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 2));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  const handleCanvasClick = () => {
    if (onSelectObject) onSelectObject(null);
  };

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
    <div className="graphics-canvas-container border border-light border-opacity-10 rounded overflow-hidden bg-primary">
      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onAddText={onAddText}
        onAddValue={onAddValue}
      />
      <div
        className="graphics-canvas-wrapper graphics-canvas-grid"
        style={{ minHeight: 400, position: "relative", overflow: "auto" }}
        onClick={handleCanvasClick}
      >
        <div
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
              availablePoints={availablePoints}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
