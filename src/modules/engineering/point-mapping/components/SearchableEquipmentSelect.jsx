import React, { useState, useRef, useEffect } from "react";
import { Dropdown, Form, InputGroup } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

/**
 * Searchable equipment selector for Point Mapping.
 * Replaces long scrolling dropdown with type-to-filter UX.
 */
export default function SearchableEquipmentSelect({
  equipmentList = [],
  value,
  onChange,
  placeholder = "Select equipment to map…",
  disabled = false,
}) {
  const [show, setShow] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  const selectedEquipment = equipmentList.find((eq) => eq.id === value);
  const displayLabel = selectedEquipment
    ? `${selectedEquipment.site} / ${selectedEquipment.building} / ${selectedEquipment.floor} / ${selectedEquipment.name}`
    : placeholder;

  const filteredList = React.useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return equipmentList;
    return equipmentList.filter((eq) => {
      const searchText = [
        eq.site,
        eq.building,
        eq.floor,
        eq.name,
        eq.displayLabel,
        eq.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchText.includes(q);
    });
  }, [equipmentList, searchQuery]);

  useEffect(() => {
    if (show) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onDocClick = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inDropdown = e.target.closest?.(".dropdown-menu, .equipment-select-dropdown");
      if (!inContainer && !inDropdown) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [show]);

  const handleSelect = (eq) => {
    if (onChange) onChange(eq.id);
    setShow(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setShow(false);
    }
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
          <span className={!selectedEquipment ? "text-white-50" : ""}>
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
                placeholder="Search by name, floor, building…"
                className="legion-search-bar-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            </InputGroup>
          </div>
          <div className="equipment-select-list" style={{ maxHeight: 280, overflowY: "auto" }}>
            {filteredList.length === 0 ? (
              <div className="p-3 text-center text-white-50 small">
                {searchQuery ? "No equipment matches your search" : "No equipment available"}
              </div>
            ) : (
              filteredList.map((eq) => {
                const label = `${eq.site} / ${eq.building} / ${eq.floor} / ${eq.name}`;
                const isSelected = eq.id === value;
                return (
                  <Dropdown.Item
                    key={eq.id}
                    active={isSelected}
                    onClick={() => handleSelect(eq)}
                    className="equipment-select-item"
                  >
                    {label}
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
