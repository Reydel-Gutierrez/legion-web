import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";

function haystack(parts) {
  return parts
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase())
    .join(" ");
}

function walkTree(node, visit) {
  if (!node) return;
  visit(node);
  (node.children || []).forEach((child) => walkTree(child, visit));
}

export default function EngineeringGlobalSearch() {
  const { siteTree, equipmentList, handleSelectNode, handleSelectEquipment } = useEngineeringSiteTree();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];
    const out = [];

    walkTree(siteTree, (n) => {
      if (n.type === "site") return;
      if (haystack([n.name, n.displayLabel, n.type]).includes(needle)) {
        out.push({ id: `${n.type}-${n.id}`, label: n.displayLabel || n.name, meta: n.type, node: n, kind: "node" });
      }
    });

    (equipmentList || []).forEach((eq) => {
      if (haystack([eq.displayLabel, eq.name, eq.instanceNumber, eq.type, eq.address]).includes(needle)) {
        out.push({
          id: `equipment-${eq.id}`,
          label: eq.displayLabel || eq.name,
          meta: "equipment",
          equipment: eq,
          kind: "equipment",
        });
      }
    });

    return out.slice(0, 20);
  }, [needle, siteTree, equipmentList]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const go = (item) => {
    if (item.kind === "equipment") handleSelectEquipment(item.equipment);
    else handleSelectNode(item.node);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="operator-search" ref={wrapRef}>
      <FontAwesomeIcon icon={faSearch} className="operator-search__icon" />
      <input
        type="search"
        className="operator-search__input"
        placeholder="Search equipment, points, templates..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(Boolean(query.trim()))}
      />
      {open && needle ? (
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
