import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { getDashboardModeOptions } from "../../../lib/access/operatorPermissions";

export default function DashboardModeSelector({ currentUser, value, onChange }) {
  const options = getDashboardModeOptions(currentUser);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (options.length <= 1) {
    return (
      <div className="dashboard-mode-selector dashboard-mode-selector--static">
        {current?.label || "Operator Dashboard"}
      </div>
    );
  }

  return (
    <div className="dashboard-mode-selector" ref={wrapRef}>
      <button
        type="button"
        className="dashboard-mode-selector__toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current?.label}</span>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      {open ? (
        <ul className="dashboard-mode-selector__menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className={`dashboard-mode-selector__option${opt.id === value ? " is-active" : ""}`}
                onClick={() => {
                  setOpen(false);
                  onChange(opt.id);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
