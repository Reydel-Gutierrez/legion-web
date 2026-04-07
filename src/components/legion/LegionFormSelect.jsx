/**
 * LegionFormSelect - Custom select with dark-themed dropdown.
 * Replaces native Form.Select for consistent dark UI; native select dropdowns
 * cannot be styled in most browsers.
 */
import React, { useState, useRef, useEffect } from "react";
import { Dropdown } from "@themesberg/react-bootstrap";

export default function LegionFormSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  size = "sm",
  className = "",
  disabled = false,
  /** Popper strategy: "fixed" escapes overflow:auto/hidden ancestors (tables, drawers). */
  menuPopperStrategy = "fixed",
}) {
  const [show, setShow] = useState(false);
  const containerRef = useRef(null);

  const strVal = value !== undefined && value !== null ? String(value) : "";
  const selectedOption = options.find((o) => String(o.value) === strVal);
  const displayLabel = selectedOption ? selectedOption.label : strVal.trim() ? strVal : placeholder;

  const handleSelect = (opt) => {
    if (onChange) onChange({ target: { value: opt.value } });
    setShow(false);
  };

  // Close on outside click (exclude clicks inside the dropdown menu - it's portaled outside containerRef)
  useEffect(() => {
    if (!show) return;
    const onDocClick = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inDropdownMenu = e.target.closest?.(".legion-form-select-menu, .dropdown-menu");
      if (!inContainer && !inDropdownMenu) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [show]);

  const height = size === "sm" ? "31px" : size === "lg" ? "47px" : "38px";
  const fontSize = size === "sm" ? "0.875rem" : "1rem";

  return (
    <div ref={containerRef} className="legion-form-select">
      <Dropdown show={show} onToggle={(next) => !disabled && setShow(next)}>
        <Dropdown.Toggle
          type="button"
          variant="link"
          as="button"
          disabled={disabled}
          className={`legion-form-select-toggle ${className}`.trim()}
          style={{
            height,
            fontSize,
            minHeight: height,
          }}
        >
          <span className={!selectedOption && !strVal.trim() ? "text-white-50" : ""}>
            {displayLabel}
          </span>
          <span className="legion-form-select-chevron">▾</span>
        </Dropdown.Toggle>
        <Dropdown.Menu
          className="legion-form-select-menu"
          popperConfig={{
            strategy: menuPopperStrategy,
          }}
        >
          {options.map((opt) => (
            <Dropdown.Item
              key={opt.value}
              active={String(opt.value) === strVal}
              onClick={() => handleSelect(opt)}
            >
              {opt.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
