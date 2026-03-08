import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dropdown, Form, InputGroup } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

/**
 * Searchable point selector for Bind Point in Graphics Manager.
 * Shows all available points for the equipment with their current values.
 */
export default function SearchablePointSelect({
  points = [],
  value,
  onChange,
  placeholder = "Select point to bind…",
  disabled = false,
}) {
  const [show, setShow] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  const selectedPoint = points.find((p) => p.id === value);

  const displayLabel = selectedPoint
    ? `${selectedPoint.displayName}${selectedPoint.presentValue != null ? ` (${formatValue(selectedPoint)})` : ""}`
    : placeholder;

  const filteredPoints = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return points;
    return points.filter((p) =>
      (p.displayName || "").toLowerCase().includes(q) ||
      (p.bacnetRef || "").toLowerCase().includes(q)
    );
  }, [points, searchQuery]);

  useEffect(() => {
    if (show) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onDocClick = (e) => {
      const inContainer = containerRef.current?.contains(e.target);
      const inDropdown = e.target.closest?.(".dropdown-menu, .equipment-select-dropdown");
      if (!inContainer && !inDropdown) setShow(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [show]);

  const handleSelect = (p) => {
    if (onChange) onChange(p.id);
    setShow(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setShow(false);
  };

  return (
    <div ref={containerRef} className="equipment-select-wrapper">
      <Dropdown show={show} onToggle={(next) => !disabled && setShow(next)}>
        <Dropdown.Toggle
          type="button"
          variant="link"
          as="button"
          disabled={disabled}
          className="equipment-select-toggle legion-form-select-toggle"
        >
          <span className={!selectedPoint ? "text-white-50" : ""}>
            {displayLabel}
          </span>
          <span className="legion-form-select-chevron">▾</span>
        </Dropdown.Toggle>
        <Dropdown.Menu className="equipment-select-dropdown legion-dropdown-menu legion-form-select-menu">
          <div className="equipment-select-search-wrap p-2 border-bottom border-light border-opacity-10">
            <InputGroup size="sm" className="input-group-merge legion-search-bar">
              <InputGroup.Text className="legion-search-bar-addon">
                <FontAwesomeIcon icon={faSearch} />
              </InputGroup.Text>
              <Form.Control
                ref={searchInputRef}
                type="text"
                placeholder="Search points…"
                className="legion-search-bar-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            </InputGroup>
          </div>
          <div className="equipment-select-list" style={{ maxHeight: 280, overflowY: "auto" }}>
            {filteredPoints.length === 0 ? (
              <div className="p-3 text-center text-white-50 small">
                {searchQuery ? "No points match your search" : "No points available"}
              </div>
            ) : (
              filteredPoints.map((p) => {
                const isSelected = p.id === value;
                const valueStr = formatValue(p);
                return (
                  <Dropdown.Item
                    key={p.id}
                    active={isSelected}
                    onClick={() => handleSelect(p)}
                    className="equipment-select-item d-flex justify-content-between align-items-center"
                  >
                    <span>{p.displayName}</span>
                    {p.presentValue != null && (
                      <span className="text-white-50 small ms-2">{valueStr}</span>
                    )}
                  </Dropdown.Item>
                );
              })
            )}
          </div>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

function formatValue(p) {
  if (p.presentValue == null) return "—";
  if (typeof p.presentValue === "number") {
    return p.units ? `${p.presentValue} ${p.units}` : String(p.presentValue);
  }
  return String(p.presentValue);
}
