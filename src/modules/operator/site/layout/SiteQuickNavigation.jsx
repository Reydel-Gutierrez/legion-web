import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faChevronDown,
  faChevronRight,
  faBorderAll,
  faArrowLeft,
  faSearch,
  faBoxOpen,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
  formatBuildingHeroTitle,
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
function CollapsibleQuickNavShell({ className = "", children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useCloseOnOutside(open, close);
  /** React 17 — no useId(); stable id per mount for aria-controls */
  const panelIdRef = useRef(
    `site-quick-nav-flyout-${Math.random().toString(36).slice(2, 11)}`
  );
  const panelId = panelIdRef.current;

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
      <div className="site-quick-nav__card">
        <div className="site-quick-nav__head-row">
          <div className="site-quick-nav__head">Quick navigation</div>
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
        <div className="site-quick-nav__rule" aria-hidden />
        {betweenRuleAndRow ? (
          <>
            {betweenRuleAndRow}
            {row || afterRow || primaryButton ? (
              <div className="site-quick-nav__rule site-quick-nav__rule--after-list" aria-hidden />
            ) : null}
          </>
        ) : null}
        {row}
        {afterRow ? (
          <>
            <div className="site-quick-nav__rule site-quick-nav__rule--after-list" aria-hidden />
            {afterRow}
          </>
        ) : null}
        {primaryButton}
      </div>
    </aside>
  );
}

function mapStatusClass(status) {
  if (status === "alert") return "legion-site-layout-status--alert";
  if (status === "warning") return "legion-site-layout-status--warning";
  return "legion-site-layout-status--normal";
}

function mapStatusLabel(status) {
  if (status === "alert") return "Alert";
  if (status === "warning") return "Warning";
  return "Normal";
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
}) {
  const countLabel =
    allBuildingsCount != null && buildings && allBuildingsCount !== buildings.length
      ? `${buildings.length} / ${allBuildingsCount}`
      : String(buildings?.length ?? 0);

  const betweenRuleAndRow = (
    <>
      <div className="site-quick-nav__map-toolbar d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="site-quick-nav__map-toolbar-label text-white-50 small">Buildings</span>
        <span className="site-quick-nav__map-toolbar-count text-white-50 small tabular-nums">{countLabel}</span>
      </div>
      <div className="site-layout-buildings-search-wrap site-quick-nav__search-clip">
        <label className="site-layout-buildings-search-field w-100 mb-0">
          <FontAwesomeIcon icon={faSearch} className="site-layout-buildings-search-field__icon text-white-50 fa-sm" />
          <input
            type="search"
            className="site-layout-buildings-search-field__input"
            placeholder="Search buildings…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            aria-label="Search buildings"
          />
        </label>
      </div>
      <div className="site-quick-nav__map-buildings-scroll site-layout-buildings-list site-layout-buildings-list--styled">
        {!buildings?.length ? (
          <div className="text-white-50 small px-3 py-3 text-center">No buildings match your search.</div>
        ) : (
          buildings.map((b) => {
            const active = selectedBuildingId === b.id;
            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                className={`site-layout-building-card ${active ? "site-layout-building-card--active" : ""}`}
                onClick={() => onSelectBuilding(b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBuilding(b.id);
                  }
                }}
              >
                <div className="site-layout-building-card__accent" aria-hidden />
                <div className="site-layout-building-card__body">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="site-layout-building-card__title text-white fw-semibold small text-truncate min-w-0">
                      {b.name}
                    </div>
                    <span
                      className={`site-layout-building-card__badge badge rounded-pill flex-shrink-0 ${mapStatusClass(b.status)}`}
                    >
                      {mapStatusLabel(b.status)}
                    </span>
                  </div>
                  <div className="site-layout-building-card__address text-white-50 small text-truncate mt-1">
                    {b.addressLine || [b.address, b.city, b.state].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <button
                      type="button"
                      className="site-layout-building-card__open btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBuilding(b.id);
                      }}
                    >
                      Open
                      <FontAwesomeIcon icon={faChevronRight} className="fa-xs" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <CollapsibleQuickNavShell className="site-quick-nav--tr site-quick-nav--map" defaultOpen>
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

function QuickNavBuilding({ releaseData, building, floors: floorsProp, onSelectFloor, onBackToMap }) {
  const floors = useMemo(() => floorsProp ?? sortedFloorsForBuilding(building), [floorsProp, building]);
  const [open, setOpen] = useState(false);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useCloseOnOutside(open, close);

  useEffect(() => {
    const first = floors[0] ?? null;
    setActiveFloorId((prev) => {
      if (prev && floors.some((f) => String(f.id) === String(prev))) return prev;
      return first?.id ?? null;
    });
  }, [floors]);

  const activeFloor = floors.find((f) => String(f.id) === String(activeFloorId)) || floors[0] || null;

  const handleRowClick = () => {
    if (!floors.length) return;
    if (floors.length === 1) {
      onSelectFloor(floors[0].id);
      return;
    }
    setOpen((v) => !v);
  };

  const handleViewPlan = () => {
    const target = activeFloor || floors[0];
    if (target) onSelectFloor(target.id);
  };

  const backSlot = onBackToMap ? (
    <button type="button" className="site-quick-nav__back" onClick={onBackToMap}>
      <FontAwesomeIcon icon={faArrowLeft} className="site-quick-nav__back-icon" />
      Map view
    </button>
  ) : null;

  const rowTitle = activeFloor ? String(activeFloor.name || "Floor").toUpperCase() : "No floors";
  const rowSub = activeFloor ? floorQuickNavSubtitle(activeFloor) : "Add floors in Site Builder";
  const rowMeta = activeFloor ? floorQuickNavMetaLine(releaseData, activeFloor) : "";

  const row = (
    <div className="site-quick-nav__row-wrap" ref={rootRef}>
      <button
        type="button"
        className="site-quick-nav__row-btn"
        disabled={!floors.length}
        aria-expanded={floors.length > 1 ? open : undefined}
        aria-haspopup={floors.length > 1 ? "listbox" : undefined}
        onClick={handleRowClick}
      >
        <span className="site-quick-nav__row-icon" aria-hidden>
          <FontAwesomeIcon icon={faLayerGroup} />
        </span>
        <div className="site-quick-nav__row-text">
          <div className="site-quick-nav__row-title">{rowTitle}</div>
          <div className="site-quick-nav__row-sub">{rowSub}</div>
          {rowMeta ? <div className="site-quick-nav__row-meta">{rowMeta}</div> : null}
        </div>
        <span className="site-quick-nav__row-chevron" aria-hidden>
          {floors.length > 1 ? (
            <FontAwesomeIcon icon={faChevronDown} className={open ? "site-quick-nav__row-chevron--open" : ""} />
          ) : (
            <FontAwesomeIcon icon={faChevronRight} />
          )}
        </span>
      </button>
      {open && floors.length > 1 ? (
        <ul className="site-quick-nav__menu" role="listbox">
          {floors.map((f) => (
            <li key={f.id} role="none">
              <button
                type="button"
                role="option"
                className="site-quick-nav__menu-item"
                aria-selected={String(f.id) === String(activeFloorId)}
                onClick={() => {
                  setActiveFloorId(f.id);
                  onSelectFloor(f.id);
                  close();
                }}
              >
                {f.name || "Floor"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const primaryButton = (
    <button type="button" className="site-quick-nav__cta" disabled={!floors.length} onClick={handleViewPlan}>
      <FontAwesomeIcon icon={faBorderAll} className="site-quick-nav__cta-icon" />
      <span>View floor plan</span>
    </button>
  );

  return (
    <CollapsibleQuickNavShell className="site-quick-nav--tr" defaultOpen>
      <QuickNavCard anchorClassName="site-quick-nav--popout" backSlot={backSlot} row={row} primaryButton={primaryButton} />
    </CollapsibleQuickNavShell>
  );
}

function QuickNavFloor({
  releaseData,
  floor,
  buildingName,
  onBackToBuilding,
  onBackToMap,
  equipment = [],
  onOpenEquipmentDetail,
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

  const backSlot =
    onBackToBuilding || onBackToMap ? (
      <div className="site-quick-nav__backs">
        {onBackToBuilding ? (
          <button type="button" className="site-quick-nav__back" onClick={onBackToBuilding}>
            <FontAwesomeIcon icon={faArrowLeft} className="site-quick-nav__back-icon" />
            {buildingName ? formatBuildingHeroTitle(buildingName) : "Building"}
          </button>
        ) : null}
        {onBackToBuilding && onBackToMap ? <span className="site-quick-nav__backs-sep">·</span> : null}
        {onBackToMap ? (
          <button type="button" className="site-quick-nav__back site-quick-nav__back--inline" onClick={onBackToMap}>
            Map view
          </button>
        ) : null}
      </div>
    ) : null;

  const row = (
    <div className="site-quick-nav__row site-quick-nav__row--static">
      <span className="site-quick-nav__row-icon" aria-hidden>
        <FontAwesomeIcon icon={faLayerGroup} />
      </span>
      <div className="site-quick-nav__row-text">
        <div className="site-quick-nav__row-title">{rowTitle}</div>
        <div className="site-quick-nav__row-sub">{rowSub}</div>
        {rowMeta ? <div className="site-quick-nav__row-meta">{rowMeta}</div> : null}
      </div>
    </div>
  );

  const afterRow = (
    <>
      <div className="site-quick-nav__map-toolbar d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="site-quick-nav__map-toolbar-label text-white-50 small d-inline-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faBoxOpen} className="opacity-75" />
          Equipment on floor
        </span>
        <span className="site-quick-nav__map-toolbar-count text-white-50 small tabular-nums">{countLabel}</span>
      </div>
      <div className="site-layout-buildings-search-wrap site-quick-nav__search-clip">
        <label className="site-layout-buildings-search-field w-100 mb-0">
          <FontAwesomeIcon icon={faSearch} className="site-layout-buildings-search-field__icon text-white-50 fa-sm" />
          <input
            type="search"
            className="site-layout-buildings-search-field__input"
            placeholder="Search equipment…"
            value={equipmentSearch}
            onChange={(e) => setEquipmentSearch(e.target.value)}
            autoComplete="off"
            aria-label="Search equipment on this floor"
          />
        </label>
      </div>
      <div className="site-quick-nav__map-buildings-scroll site-quick-nav__floor-eq-list site-layout-buildings-list site-layout-buildings-list--styled">
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
    <CollapsibleQuickNavShell className="site-quick-nav--tr site-quick-nav--map site-quick-nav--floor">
      <QuickNavCard
        anchorClassName="site-quick-nav--popout site-quick-nav--map site-quick-nav--floor"
        backSlot={backSlot}
        row={row}
        afterRow={afterRow}
        primaryButton={null}
      />
    </CollapsibleQuickNavShell>
  );
}
