import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import { locationForFacilityNode } from "../../../lib/operator/operatorSelection";
import { walkFacilityTree } from "../../../lib/operator/facilityTree";

const PAGE_TARGETS = [
  { id: "alarms", label: "Alarms", path: Routes.LegionAlarms.path, kind: "page" },
  { id: "trends", label: "Trends", path: Routes.LegionTrends.path, kind: "page" },
  { id: "schedules", label: "Schedules", path: Routes.LegionSchedules.path, kind: "page" },
  { id: "events", label: "Event log", path: Routes.LegionEvents.path, kind: "page" },
  { id: "settings", label: "Settings", path: Routes.LegionSettings.path, kind: "page" },
  { id: "users", label: "Users", path: Routes.LegionUsers.path, kind: "page" },
  { id: "insights", label: "Insights", path: Routes.LegionDashboard.path, kind: "page" },
  { id: "workspace", label: "Point workspace", path: Routes.LegionEquipment.path, kind: "page" },
];

function haystack(parts) {
  return parts
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase())
    .join(" ");
}

export default function OperatorGlobalSearch({ tree, releaseData }) {
  const history = useHistory();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];
    const out = [];

    walkFacilityTree(tree, (n) => {
      if (haystack([n.label, n.name, n.kind, n.type]).includes(needle)) {
        out.push({
          id: `${n.kind}-${n.id}`,
          label: n.label,
          meta: n.kind,
          kind: n.kind,
          node: n,
        });
      }
    });

    (releaseData?.equipment || []).forEach((eq) => {
      const text = haystack([
        eq.displayLabel,
        eq.name,
        eq.id,
        eq.instanceNumber,
        eq.locationLabel,
        eq.address,
        eq.type,
        eq.equipmentType,
      ]);
      if (text.includes(needle) && !out.some((r) => r.id === `equipment-${eq.id}`)) {
        out.push({
          id: `equipment-${eq.id}`,
          label: eq.displayLabel || eq.name || String(eq.id),
          meta: eq.type || eq.equipmentType || "equipment",
          kind: "equipment",
          node: { kind: "equipment", id: String(eq.id), label: eq.displayLabel || eq.name },
        });
      }
    });

    PAGE_TARGETS.forEach((p) => {
      if (p.label.toLowerCase().includes(needle) || p.id.includes(needle)) {
        out.push({ id: `page-${p.id}`, label: p.label, meta: "page", kind: "page", path: p.path });
      }
    });

    return out.slice(0, 40);
  }, [needle, tree, releaseData]);

  const showPanel = open && needle.length > 0;

  useEffect(() => {
    if (!showPanel) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showPanel]);

  const go = (item) => {
    setOpen(false);
    setQuery("");
    if (item.kind === "page") {
      history.push(item.path);
      return;
    }
    history.push(locationForFacilityNode(item.node));
  };

  return (
    <div className="operator-search" ref={wrapRef}>
      <FontAwesomeIcon icon={faSearch} className="operator-search__icon" />
      <input
        type="search"
        className="operator-search__input"
        placeholder="Search equipment, points, or pages..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search equipment, points, or pages"
      />
      {showPanel ? (
        <ul className="operator-search__results" role="listbox">
          {results.length === 0 ? (
            <li className="operator-search__empty">No matches</li>
          ) : (
            results.map((item) => (
              <li key={item.id}>
                <button type="button" className="operator-search__hit" onClick={() => go(item)}>
                  <span className="operator-search__hit-label">{item.label}</span>
                  <span className="operator-search__hit-meta">{item.meta}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
