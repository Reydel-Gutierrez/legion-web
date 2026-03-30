import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { Form, InputGroup } from "@themesberg/react-bootstrap";

import { useActiveDeployment } from "../../hooks/useWorkingVersion";
import { resolveEquipmentLocationInRelease } from "../../lib/activeReleaseUtils";
import { Routes } from "../../routes";

const MAX_RESULTS = 40;

/**
 * @param {object} eq
 * @param {string} needle - lowercased trimmed query
 */
function equipmentSearchHaystack(eq) {
  return [
    eq.displayLabel,
    eq.name,
    eq.id != null ? String(eq.id) : "",
    eq.instanceNumber != null ? String(eq.instanceNumber) : "",
    eq.locationLabel,
    eq.address,
    eq.type,
    eq.equipmentType,
  ]
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase());
}

/**
 * @param {object} eq
 * @param {string} needle
 */
function equipmentMatches(eq, needle) {
  if (!needle) return false;
  return equipmentSearchHaystack(eq).some((h) => h.includes(needle));
}

/**
 * @param {object} eq
 * @param {string} needle
 */
function equipmentMatchRank(eq, needle) {
  const label = String(eq.displayLabel || eq.name || eq.id || "").toLowerCase();
  if (label.startsWith(needle)) return 0;
  if (label.includes(needle)) return 1;
  return 2;
}

/**
 * Header search (operator mode): filter active deployment equipment, open detail on pick.
 */
export default function LegionOperatorGlobalSearch() {
  const history = useHistory();
  const { deployment, loading } = useActiveDeployment();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    const list = deployment?.equipment;
    if (!Array.isArray(list) || !needle) return [];
    const filtered = list.filter((eq) => equipmentMatches(eq, needle));
    filtered.sort(
      (a, b) =>
        equipmentMatchRank(a, needle) - equipmentMatchRank(b, needle) ||
        String(a.displayLabel || a.name || a.id).localeCompare(String(b.displayLabel || b.name || b.id))
    );
    return filtered.slice(0, MAX_RESULTS);
  }, [deployment, needle]);

  const showPanel = open && needle.length > 0;

  useEffect(() => {
    if (!showPanel) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showPanel]);

  const goToEquipment = useCallback(
    (equipmentId) => {
      const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(equipmentId));
      history.push(path);
      setQuery("");
      setOpen(false);
    },
    [history]
  );

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      e.target.blur();
    }
  };

  return (
    <div ref={wrapRef} className="legion-global-search-wrap position-relative">
      <Form className="navbar-search">
        <Form.Group id="topbarSearch">
          <InputGroup className="input-group-merge legion-search-bar">
            <InputGroup.Text className="legion-search-bar-addon">
              <FontAwesomeIcon icon={faSearch} />
            </InputGroup.Text>
            <Form.Control
              type="search"
              autoComplete="off"
              placeholder="Search Equipment, Rooms, etc..."
              className="legion-search-bar-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              aria-expanded={showPanel}
              aria-controls="legion-global-search-results"
              aria-autocomplete="list"
            />
          </InputGroup>
        </Form.Group>
      </Form>

      {showPanel && (
        <div
          id="legion-global-search-results"
          className="legion-global-search-results dropdown-menu show"
          role="listbox"
        >
          {loading && (
            <div className="legion-global-search-empty legion-global-search-muted px-3 py-2 small">Loading…</div>
          )}
          {!loading && !deployment?.equipment?.length && (
            <div className="legion-global-search-empty legion-global-search-muted px-3 py-2 small">
              No site data loaded yet.
            </div>
          )}
          {!loading && deployment?.equipment?.length > 0 && results.length === 0 && (
            <div className="legion-global-search-empty legion-global-search-muted px-3 py-2 small">
              No equipment matches “{query.trim()}”.
            </div>
          )}
          {results.map((eq) => {
            const title = eq.displayLabel || eq.name || String(eq.id);
            const loc = deployment ? resolveEquipmentLocationInRelease(deployment, eq.id) : null;
            const sub = [loc?.buildingName, loc?.floorName].filter(Boolean).join(" · ");
            return (
              <button
                key={String(eq.id)}
                type="button"
                role="option"
                className="dropdown-item legion-global-search-item text-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goToEquipment(eq.id)}
              >
                <span className="legion-global-search-item-title d-block text-truncate">{title}</span>
                {sub ? (
                  <span className="legion-global-search-item-sub d-block text-truncate">{sub}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
