import React from "react";
import { Form, InputGroup } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faChevronRight, faSearch } from "@fortawesome/free-solid-svg-icons";

function statusClass(status) {
  if (status === "alert") return "legion-site-layout-status--alert";
  if (status === "warning") return "legion-site-layout-status--warning";
  return "legion-site-layout-status--normal";
}

function statusLabel(status) {
  if (status === "alert") return "Alert";
  if (status === "warning") return "Warning";
  return "Normal";
}

export default function SiteLayoutBuildingsPanel({
  buildings,
  allCount,
  search,
  onSearchChange,
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
}) {
  return (
    <aside className="site-layout-buildings-panel">
      <div className="site-layout-buildings-panel-card rounded border border-light border-opacity-10 shadow-sm">
        <div className="site-layout-buildings-panel-header d-flex align-items-center justify-content-between gap-2 px-3 py-2 border-bottom border-light border-opacity-10">
          <span className="text-white fw-semibold small d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faBuilding} className="text-white-50" />
            Buildings
          </span>
          <span className="text-white-50 small">
            {buildings.length}
            {allCount !== buildings.length ? ` / ${allCount}` : ""}
          </span>
        </div>
        <div className="px-3 py-2 border-bottom border-light border-opacity-10">
          <InputGroup size="sm" className="site-layout-buildings-search">
            <InputGroup.Text className="bg-dark border-light border-opacity-10 text-white-50">
              <FontAwesomeIcon icon={faSearch} className="fa-sm" />
            </InputGroup.Text>
            <Form.Control
              type="search"
              placeholder="Search buildings…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-dark border-light border-opacity-10 text-white placeholder-secondary"
            />
          </InputGroup>
        </div>
        <div className="site-layout-buildings-list">
          {buildings.length === 0 ? (
            <div className="text-white-50 small px-3 py-4 text-center">No buildings match your search.</div>
          ) : (
            buildings.map((b) => {
              const active = selectedBuildingId === b.id;
              return (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  className={`site-layout-building-row w-100 text-start ${active ? "site-layout-building-row--active" : ""}`}
                  onClick={() => onSelectBuilding(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectBuilding(b.id);
                    }
                  }}
                >
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="min-w-0">
                      <div className="text-white fw-semibold small text-truncate">{b.name}</div>
                      <div className="text-white-50 small text-truncate">{b.addressLine || b.city}</div>
                    </div>
                    <span className={`badge rounded-pill flex-shrink-0 align-self-center ${statusClass(b.status)}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-info text-decoration-none p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBuilding(b.id);
                      }}
                    >
                      Open
                      <FontAwesomeIcon icon={faChevronRight} className="ms-1 fa-xs" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
