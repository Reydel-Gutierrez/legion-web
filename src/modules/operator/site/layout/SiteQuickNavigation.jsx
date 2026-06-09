import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faBorderAll,
  faSearch,
  faBoxOpen,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
  sortedFloorsForBuilding,
  floorQuickNavSubtitle,
  floorQuickNavMetaLine,
} from "../../../../lib/siteBuildingOverviewUtils";

function useCloseOnOutside(open, close) {
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return rootRef;
}

/** Compact trigger; full panel opens on click or hover — close via X, outside click, or Escape. */
function CollapsibleQuickNavShell({ className = "", children, defaultOpen = true, navKey }) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useCloseOnOutside(open, close);
  /** React 17 — no useId(); stable id per mount for aria-controls */
  const panelIdRef = useRef(
    `site-quick-nav-flyout-${Math.random().toString(36).slice(2, 11)}`
  );
  const panelId = panelIdRef.current;

  useEffect(() => {
    setOpen(true);
  }, [navKey]);

  return (
    <div ref={rootRef} className={`site-quick-nav-collapsible ${className}`.trim()}>
      {!open ? (
        <button
          type="button"
          className="site-quick-nav-collapsible__trigger"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={panelId}
        >
          <FontAwesomeIcon icon={faBorderAll} className="site-quick-nav-collapsible__trigger-icon" fixedWidth />
          <span className="site-quick-nav-collapsible__trigger-label">Quick navigation</span>
          <FontAwesomeIcon icon={faChevronDown} className="site-quick-nav-collapsible__trigger-chevron" />
        </button>
      ) : (
        <div id={panelId} className="site-quick-nav-collapsible__flyout">
          {React.isValidElement(children) ? React.cloneElement(children, { onClose: close }) : children}
        </div>
      )}
    </div>
  );
}

function QuickNavCard({
  anchorClassName,
  backSlot,
  row,
  primaryButton,
  betweenRuleAndRow = null,
  afterRow = null,
  onClose = null,
}) {
  return (
    <aside className={`site-quick-nav ${anchorClassName}`} aria-label="Quick navigation">
      {backSlot}
      <div className="site-quick-nav__card legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
        <div className="site-quick-nav__head-row legion-operator-log-card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="text-white fw-bold text-uppercase">Quick Navigation</span>
          {onClose ? (
            <button
              type="button"
              className="site-quick-nav__close"
              onClick={onClose}
              aria-label="Close quick navigation"
            >
              <FontAwesomeIcon icon={faTimes} className="site-quick-nav__close-fa" />
            </button>
          ) : null}
        </div>
        <div className="site-quick-nav__body">
          {betweenRuleAndRow}
          {row}
          {afterRow}
          {primaryButton}
        </div>
      </div>
    </aside>
  );
}

/**
 * Map view: building selection + open building.
 * Building view: floor picker + view floor plan + back to map.
 * Floor view: floor context + searchable equipment list + back to building / map.
 */
export default function SiteQuickNavigation(props) {
  const { variant } = props;
  if (variant === "map") return <QuickNavMap {...props} />;
  if (variant === "building") return <QuickNavBuilding {...props} />;
  if (variant === "floor") return <QuickNavFloor {...props} />;
  return null;
}

function QuickNavMap({
  selectedBuildingId,
  onOpenBuilding,
  buildings,
  allBuildingsCount,
  search,
  onSearchChange,
  onSelectBuilding,
  navKey,
}) {
  const countLabel =
    allBuildingsCount != null && buildings && allBuildingsCount !== buildings.length
      ? `${buildings.length} / ${allBuildingsCount}`
      : String(buildings?.length ?? 0);

  const betweenRuleAndRow = (
    <>
      <div className="site-quick-nav__map-toolbar d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="site-quick-nav__map-toolbar-label text-white fw-semibold small">Buildings</span>
        <span className="badge bg-primary border border-light border-opacity-25 text-white tabular-nums">
          {countLabel}
        </span>
      </div>
      <div className="site-quick-nav__search mb-2">
        <label className="site-quick-nav__search-field w-100 mb-0">
          <FontAwesomeIcon icon={faSearch} className="site-quick-nav__search-icon text-white-50 fa-sm" />
          <input
            type="search"
            className="site-quick-nav__search-input legion-operator-log-field"
            placeholder="Search buildings…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            aria-label="Search buildings"
          />
        </label>
      </div>
      <div className="site-quick-nav__list-scroll legion-operator-log-table-wrap border border-light border-opacity-10 rounded overflow-hidden">
        {!buildings?.length ? (
          <div className="text-white-50 small px-3 py-3 text-center">No buildings match your search.</div>
        ) : (
          buildings.map((b) => {
            const active = selectedBuildingId === b.id;
            const address =
              b.addressLine || [b.address, b.city, b.state].filter(Boolean).join(", ") || "—";
            return (
              <div
                key={b.id}
                className={`site-quick-nav__list-row ${active ? "site-quick-nav__list-row--active" : ""}`}
              >
                <button
                  type="button"
                  className="site-quick-nav__list-row__body"
                  onClick={() => onSelectBuilding(b.id)}
                >
                  <span className="site-quick-nav__list-row__main">
                    <span className="site-quick-nav__list-row__name">{b.name}</span>
                    <span className="site-quick-nav__list-row__sub">{address}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="site-quick-nav__list-row__action"
                  onClick={() => onOpenBuilding(b.id)}
                >
                  Open
                  <FontAwesomeIcon icon={faChevronRight} className="fa-xs" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <CollapsibleQuickNavShell className="site-quick-nav--tr site-quick-nav--map" navKey={navKey}>
      <QuickNavCard
        anchorClassName="site-quick-nav--popout site-quick-nav--map"
        backSlot={null}
        betweenRuleAndRow={betweenRuleAndRow}
        row={null}
        primaryButton={null}
      />
    </CollapsibleQuickNavShell>
  );
}

function QuickNavBuilding({ building, floors: floorsProp, onSelectFloor, navKey }) {
  const floors = useMemo(() => floorsProp ?? sortedFloorsForBuilding(building), [floorsProp, building]);

  const betweenRuleAndRow = (
    <>
      <div className="site-quick-nav__map-toolbar d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="site-quick-nav__map-toolbar-label text-white fw-semibold small">Floors</span>
        <span className="badge bg-primary border border-light border-opacity-25 text-white tabular-nums">
          {floors.length}
        </span>
      </div>
      <div className="site-quick-nav__floor-list legion-operator-log-table-wrap border border-light border-opacity-10 rounded overflow-hidden">
        {!floors.length ? (
          <div className="text-white-50 small px-3 py-3 text-center">No floors yet. Add floors in Site Builder.</div>
        ) : (
          floors.map((f) => {
            const rowSub = floorQuickNavSubtitle(f);
            return (
              <button
                key={f.id}
                type="button"
                className="site-quick-nav__floor-row"
                onClick={() => onSelectFloor(f.id)}
              >
                <span className="site-quick-nav__floor-row__text">
                  <span className="site-quick-nav__floor-row__name">{f.name || "Floor"}</span>
                  {rowSub ? (
                    <>
                      <span className="site-quick-nav__floor-row__sep" aria-hidden>
                        ·
                      </span>
                      <span className="site-quick-nav__floor-row__sub">{rowSub}</span>
                    </>
                  ) : null}
                </span>
                <span className="site-quick-nav__floor-row__action">
                  View
                  <FontAwesomeIcon icon={faChevronRight} className="fa-xs" />
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <CollapsibleQuickNavShell className="site-quick-nav--tr site-quick-nav--building" navKey={navKey}>
      <QuickNavCard
        anchorClassName="site-quick-nav--popout site-quick-nav--building"
        backSlot={null}
        betweenRuleAndRow={betweenRuleAndRow}
        row={null}
        primaryButton={null}
      />
    </CollapsibleQuickNavShell>
  );
}

function QuickNavFloor({
  releaseData,
  floor,
  equipment = [],
  onOpenEquipmentDetail,
  navKey,
}) {
  const [equipmentSearch, setEquipmentSearch] = useState("");

  const rowTitle = floor ? String(floor.name || "Floor").toUpperCase() : "Floor";
  const rowSub = floor ? floorQuickNavSubtitle(floor) : "";
  const rowMeta = floor ? floorQuickNavMetaLine(releaseData, floor) : "";

  const filteredEquipment = useMemo(() => {
    const list = Array.isArray(equipment) ? equipment : [];
    const q = equipmentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((eq) => {
      const blob = [
        eq.displayLabel,
        eq.name,
        eq.id,
        eq.type,
        eq.equipmentType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [equipment, equipmentSearch]);

  const totalEq = Array.isArray(equipment) ? equipment.length : 0;
  const countLabel =
    totalEq > 0 && filteredEquipment.length !== totalEq
      ? `${filteredEquipment.length} / ${totalEq}`
      : String(totalEq);

  const row = (
    <div className="site-quick-nav__context mb-2">
      <div className="site-quick-nav__context-title">{rowTitle}</div>
      {rowSub ? <div className="site-quick-nav__context-sub">{rowSub}</div> : null}
      {rowMeta ? <div className="site-quick-nav__context-meta">{rowMeta}</div> : null}
    </div>
  );

  const afterRow = (
    <>
      <div className="site-quick-nav__map-toolbar d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="site-quick-nav__map-toolbar-label text-white fw-semibold small d-inline-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faBoxOpen} className="text-white-50" />
          Equipment on floor
        </span>
        <span className="badge bg-primary border border-light border-opacity-25 text-white tabular-nums">
          {countLabel}
        </span>
      </div>
      <div className="site-quick-nav__search mb-2">
        <label className="site-quick-nav__search-field w-100 mb-0">
          <FontAwesomeIcon icon={faSearch} className="site-quick-nav__search-icon text-white-50 fa-sm" />
          <input
            type="search"
            className="site-quick-nav__search-input legion-operator-log-field"
            placeholder="Search equipment…"
            value={equipmentSearch}
            onChange={(e) => setEquipmentSearch(e.target.value)}
            autoComplete="off"
            aria-label="Search equipment on this floor"
          />
        </label>
      </div>
      <div className="site-quick-nav__list-scroll site-quick-nav__floor-eq-list legion-operator-log-table-wrap border border-light border-opacity-10 rounded overflow-hidden">
        {totalEq === 0 ? (
          <div className="text-white-50 small px-3 py-3 text-center">No equipment on this floor.</div>
        ) : !filteredEquipment.length ? (
          <div className="text-white-50 small px-3 py-3 text-center">No equipment matches your search.</div>
        ) : (
          filteredEquipment.map((eq) => {
            const label = eq.displayLabel || eq.name || eq.id;
            const typeLine = String(eq.type || eq.equipmentType || "").trim();
            return (
              <button
                key={eq.id}
                type="button"
                className="site-quick-nav__floor-eq-item w-100 text-start"
                onClick={() => onOpenEquipmentDetail(eq.id)}
              >
                <span className="site-quick-nav__floor-eq-item__title text-truncate">{label}</span>
                {typeLine ? (
                  <span className="site-quick-nav__floor-eq-item__type text-truncate">{typeLine}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <CollapsibleQuickNavShell
      className="site-quick-nav--tr site-quick-nav--map site-quick-nav--floor"
      navKey={navKey}
    >
      <QuickNavCard
        anchorClassName="site-quick-nav--popout site-quick-nav--map site-quick-nav--floor"
        backSlot={null}
        row={row}
        afterRow={afterRow}
        primaryButton={null}
      />
    </CollapsibleQuickNavShell>
  );
}
