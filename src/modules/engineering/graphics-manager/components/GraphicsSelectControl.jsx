import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card, Dropdown, Form, InputGroup, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSitemap } from "@fortawesome/free-solid-svg-icons";

/**
 * Single "select where to work" control for Graphics Manager.
 * Search by name, floor, or building to pick a site/building/floor or equipment,
 * or use "View tree" to open the tree modal. Sets selection before assigning/editing graphics.
 * inline: render without Card for use inside the toolbar (one top bar).
 */
export default function GraphicsSelectControl({
  layoutNodes = [],
  equipmentList = [],
  selectedLayoutNodeId,
  selectedEquipmentId,
  selectedLayoutNode,
  selectedEquipment,
  onSelectLayoutNode,
  onSelectEquipment,
  onOpenTreeModal,
  disabled = false,
  inline = false,
}) {
  const [show, setShow] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const displayLabel = useMemo(() => {
    if (selectedEquipment) {
      const parts = [selectedEquipment.site, selectedEquipment.building, selectedEquipment.floor, selectedEquipment.name].filter(Boolean);
      return parts.length ? parts.join(" / ") : selectedEquipment.displayLabel || selectedEquipment.name || "Equipment";
    }
    if (selectedLayoutNode) {
      const typeLabel = (selectedLayoutNode.type || "").toLowerCase();
      return `${typeLabel ? typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) + ": " : ""}${selectedLayoutNode.name || selectedLayoutNode.id}`;
    }
    return null;
  }, [selectedLayoutNode, selectedEquipment]);

  const options = useMemo(() => {
    const layout = (layoutNodes || []).map((n) => ({
      type: "layout",
      id: n.id,
      name: n.name || n.id,
      nodeType: n.type,
      searchText: [n.name, n.id, n.type].filter(Boolean).join(" ").toLowerCase(),
      label: `${(n.type || "").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}: ${n.name || n.id}`,
    }));
    const equipment = (equipmentList || []).map((e) => {
      const parts = [e.site, e.building, e.floor, e.name].filter(Boolean);
      const label = parts.length ? parts.join(" / ") : (e.displayLabel || e.name || e.id);
      const searchText = [e.site, e.building, e.floor, e.name, e.displayLabel, e.type].filter(Boolean).join(" ").toLowerCase();
      return { type: "equipment", id: e.id, label, searchText };
    });
    return [...layout, ...equipment];
  }, [layoutNodes, equipmentList]);

  const filteredOptions = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchText.includes(q));
  }, [options, searchQuery]);

  useEffect(() => {
    if (show) {
      setSearchQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target) && !e.target.closest?.(".dropdown-menu")) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [show]);

  const handleSelectLayout = (id) => {
    if (onSelectLayoutNode) onSelectLayoutNode(id);
    setShow(false);
  };

  const handleSelectEquip = (id) => {
    if (onSelectEquipment) onSelectEquipment(id);
    setShow(false);
  };

  const layoutGroup = filteredOptions.filter((o) => o.type === "layout");
  const equipmentGroup = filteredOptions.filter((o) => o.type === "equipment");

  const dropdownToggleClass = inline
    ? "d-flex align-items-center justify-content-between text-start bg-dark bg-opacity-50 border-0 border-start border border-light border-opacity-10 legion-search-bar-input rounded-end"
    : "d-flex align-items-center justify-content-between w-100 text-start bg-dark bg-opacity-25 border border-light border-opacity-10";

  const content = (
    <>
      <div ref={containerRef} className={inline ? "input-group input-group-merge legion-search-bar" : "flex-grow-1"} style={inline ? { minWidth: 280 } : { minWidth: 200 }}>
        {inline && (
          <InputGroup.Text className="legion-search-bar-addon bg-dark border border-light border-opacity-10 rounded-start">
            <FontAwesomeIcon icon={faSearch} className="text-white-50" />
          </InputGroup.Text>
        )}
        <Dropdown show={show} onToggle={(next) => !disabled && setShow(!!next)} align="start" className={inline ? "flex-grow-1" : "w-100"}>
          <Dropdown.Toggle
            variant="outline-light"
            size="sm"
            className={dropdownToggleClass}
            id="graphics-select-toggle"
          >
            <span className="text-truncate">
              {displayLabel || "Select where to work…"}
            </span>
          </Dropdown.Toggle>
              <Dropdown.Menu className="bg-primary border border-light border-opacity-10 p-0" style={{ minWidth: 320 }}>
                <div className="p-2 border-bottom border-light border-opacity-10">
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-dark border-light border-opacity-10">
                      <FontAwesomeIcon icon={faSearch} className="text-white-50" />
                    </InputGroup.Text>
                    <Form.Control
                      ref={inputRef}
                      className="bg-dark border-light border-opacity-10 text-white"
                      placeholder="Search by name, floor, or building…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setShow(false)}
                    />
                  </InputGroup>
                </div>
                <div style={{ maxHeight: 280 }} className="overflow-auto">
                  {layoutGroup.length > 0 && (
                    <div className="px-2 pt-2">
                      <div className="text-white-50 small text-uppercase mb-1">Sites & layout</div>
                      {layoutGroup.map((o) => (
                        <Dropdown.Item
                          key={`layout-${o.id}`}
                          className="text-white bg-transparent border-0"
                          active={selectedLayoutNodeId === o.id}
                          onClick={() => handleSelectLayout(o.id)}
                        >
                          {o.label}
                        </Dropdown.Item>
                      ))}
                    </div>
                  )}
                  {equipmentGroup.length > 0 && (
                    <div className="px-2 pt-2 pb-2">
                      <div className="text-white-50 small text-uppercase mb-1">Equipment</div>
                      {equipmentGroup.map((o) => (
                        <Dropdown.Item
                          key={`equipment-${o.id}`}
                          className="text-white bg-transparent border-0"
                          active={selectedEquipmentId === o.id}
                          onClick={() => handleSelectEquip(o.id)}
                        >
                          {o.label}
                        </Dropdown.Item>
                      ))}
                    </div>
                  )}
                  {filteredOptions.length === 0 && (
                    <div className="p-3 text-white-50 small text-center">No matches</div>
                  )}
                </div>
                <div className="p-2 border-top border-light border-opacity-10">
                  <Button
                    variant="outline-light"
                    size="sm"
                    className="w-100"
                    onClick={() => {
                      setShow(false);
                      if (onOpenTreeModal) onOpenTreeModal();
                    }}
                  >
                    <FontAwesomeIcon icon={faSitemap} className="me-2" />
                    View tree (site → building → floor → equipment)
                  </Button>
                </div>
              </Dropdown.Menu>
            </Dropdown>
          </div>
      <Button
        size="sm"
        className="legion-hero-btn legion-hero-btn--secondary d-inline-flex align-items-center flex-row flex-nowrap flex-shrink-0 gap-1 text-nowrap"
        title="Open tree to pick site, building, floor, or equipment"
        onClick={onOpenTreeModal}
        disabled={disabled}
      >
        <FontAwesomeIcon icon={faSitemap} className="fa-fw flex-shrink-0" aria-hidden />
        <span>View tree</span>
      </Button>
    </>
  );

  if (inline) {
    return (
      <div className="d-flex align-items-center flex-nowrap gap-2 graphics-manager-select-inline">
        {content}
      </div>
    );
  }

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-3">
        <div className="d-flex align-items-center flex-wrap gap-2">
          <span className="text-white-50 small text-nowrap">Select where to work:</span>
          {content}
        </div>
        <div className="text-white-50 small mt-2">
          Pick a location or equipment before assigning or editing a graphic. Search by name, floor, or building, or use the tree.
        </div>
      </Card.Body>
    </Card>
  );
}
