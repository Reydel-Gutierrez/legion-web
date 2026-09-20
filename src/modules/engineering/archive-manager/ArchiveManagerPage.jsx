import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Form, InputGroup } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArchive, faBuilding, faMicrochip, faClock, faSearch } from "@fortawesome/free-solid-svg-icons";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { useEngineeringArchive } from "../../../app/providers/EngineeringArchiveProvider";
import { loadWorkingVersionForSite } from "../../../lib/data/persistence/engineeringVersionPersistence";
import { fetchWorkingVersion } from "../../../lib/data/repositories/engineeringRepository";
import { isLocalArchiveSiteKey } from "../../../lib/data/archiveConstants";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import {
  buildFacilityTree,
  countFacilityBuildings,
  countFacilityFloors,
  countFacilityEquipment,
} from "../../../lib/operator/facilityTree";
import { Routes } from "../../../routes";

/** Two-line "Today, 3:45 PM" / "Sep 16, 2026" — matches the table's date-cell prototype. */
function formatDateLines(iso) {
  if (!iso) return { primary: "—", secondary: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { primary: "—", secondary: "" };
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const primary =
    d.toDateString() === now.toDateString()
      ? `Today, ${time}`
      : d.toDateString() === yesterday.toDateString()
        ? `Yesterday, ${time}`
        : d.toLocaleDateString([], { month: "short", day: "numeric" });
  const secondary = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  return { primary, secondary };
}

function summarize(payload) {
  const tree = payload ? buildFacilityTree(payload) : null;
  return {
    buildings: tree ? countFacilityBuildings(tree) : 0,
    floors: tree ? countFacilityFloors(tree) : 0,
    devices: tree ? countFacilityEquipment(tree) : 0,
  };
}

const SORT_OPTIONS = [
  { value: "updated", label: "Sort by: Updated" },
  { value: "created", label: "Sort by: Created" },
  { value: "name", label: "Sort by: Name" },
  { value: "buildings", label: "Sort by: Buildings" },
  { value: "devices", label: "Sort by: Devices" },
];

/**
 * Manage Archives — the same Building(s)-style panel used on Operator/Engineering's Site Overview,
 * pointed at the archive catalog instead of a site's buildings. Rows are click-only (no per-row
 * action buttons); clicking one opens a small summary with Open/Delete/Close.
 */
export default function ArchiveManagerPage() {
  const navigate = useNavigate();
  const { archiveEntries, activeArchive, openArchive, deleteArchive } = useEngineeringArchive();
  const [expandedId, setExpandedId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("updated");

  // Local archives keep their data in localStorage (read synchronously); an archive still bound to
  // a real backend site (e.g. one adopted before this feature existed) needs an API round trip.
  useEffect(() => {
    let cancelled = false;
    archiveEntries.forEach((entry) => {
      if (isLocalArchiveSiteKey(entry.id)) {
        setSummaries((prev) => ({ ...prev, [entry.id]: summarize(loadWorkingVersionForSite(entry.id)) }));
      } else if (USE_HIERARCHY_API) {
        fetchWorkingVersion(entry.id)
          .then((payload) => {
            if (!cancelled) setSummaries((prev) => ({ ...prev, [entry.id]: summarize(payload) }));
          })
          .catch(() => {
            if (!cancelled) setSummaries((prev) => ({ ...prev, [entry.id]: null }));
          });
      } else {
        setSummaries((prev) => ({ ...prev, [entry.id]: summarize(loadWorkingVersionForSite(entry.id)) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [archiveEntries]);

  const visibleEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? archiveEntries.filter((e) => e.name.toLowerCase().includes(q)) : archiveEntries;
    const withSummary = (id) => summaries[id] || { buildings: 0, devices: 0 };
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        case "created":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "buildings":
          return withSummary(b.id).buildings - withSummary(a.id).buildings;
        case "devices":
          return withSummary(b.id).devices - withSummary(a.id).devices;
        case "updated":
        default:
          return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
    });
  }, [archiveEntries, search, sortKey, summaries]);

  const selectedEntry = archiveEntries.find((e) => e.id === selectedId) || null;
  const selectedSummary = selectedId ? summaries[selectedId] : null;
  const selectedIsActive = selectedId != null && selectedId === activeArchive?.id;

  const handleClose = () => setSelectedId(null);

  const handleOpen = () => {
    if (!selectedId || selectedIsActive) return;
    openArchive(selectedId);
    setSelectedId(null);
    navigate(Routes.EngineeringHome.path);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (deleteArchive(selectedId)) setSelectedId(null);
  };

  const openRow = (id) => setSelectedId(id);
  const handleRowKeyDown = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openRow(id);
    }
  };

  return (
    <div className="site-workspace">
      <header className="equipment-header">
        <nav className="operator-breadcrumb" aria-label="Breadcrumb">
          <span className="operator-breadcrumb__item">
            <button type="button" className="operator-breadcrumb__link" onClick={() => navigate(Routes.EngineeringHome.path)}>
              Engineering
            </button>
          </span>
          <span className="operator-breadcrumb__item">
            <span className="operator-breadcrumb__sep">›</span>
            <span className="operator-breadcrumb__current">Manage Archives</span>
          </span>
        </nav>
        <div className="equipment-header__top">
          <div className="equipment-header__row">
            <span className="equipment-header__icon" aria-hidden="true">
              <FontAwesomeIcon icon={faArchive} />
            </span>
            <div>
              <div className="equipment-header__title-row">
                <h1 className="workspace-header__title">Manage Archives</h1>
              </div>
              <p className="workspace-header__meta">
                <span>
                  {archiveEntries.length} Archive{archiveEntries.length === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <InputGroup size="sm" style={{ maxWidth: 260 }}>
          <InputGroup.Text>
            <FontAwesomeIcon icon={faSearch} />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search archives..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Form.Select size="sm" style={{ width: 190 }} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
      </div>

      <ExpandableWorkspaceCard title="Archives" cardId="archives" expandedId={expandedId} onToggleExpand={setExpandedId}>
        {archiveEntries.length === 0 ? (
          <div className="operator-empty-graphic">No saved archives yet.</div>
        ) : visibleEntries.length === 0 ? (
          <div className="operator-empty-graphic">No archives match &quot;{search}&quot;.</div>
        ) : (
          <table className="site-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>
                  <FontAwesomeIcon icon={faBuilding} className="me-1" />
                  Buildings
                </th>
                <th>
                  <FontAwesomeIcon icon={faMicrochip} className="me-1" />
                  Devices
                </th>
                <th>
                  <FontAwesomeIcon icon={faClock} className="me-1" />
                  Updated
                </th>
                <th>
                  <FontAwesomeIcon icon={faClock} className="me-1" />
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => {
                const s = summaries[entry.id];
                const isActive = entry.id === activeArchive?.id;
                const updated = formatDateLines(entry.updatedAt);
                const created = formatDateLines(entry.createdAt);
                return (
                  <tr
                    key={entry.id}
                    className="site-table__row"
                    tabIndex={0}
                    role="button"
                    onClick={() => openRow(entry.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, entry.id)}
                  >
                    <td>
                      <span className="site-table__link">
                        {entry.name}
                        {isActive ? " — Open" : ""}
                      </span>
                    </td>
                    <td>{s ? s.buildings : "…"}</td>
                    <td>{s ? s.devices : "…"}</td>
                    <td>
                      <div className="fw-semibold">{updated.primary}</div>
                      <div className="site-table__date-secondary">{updated.secondary}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">{created.primary}</div>
                      <div className="site-table__date-secondary">{created.secondary}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ExpandableWorkspaceCard>

      <Modal
        show={Boolean(selectedId)}
        onHide={handleClose}
        centered
        className="engineering-light-form"
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">{selectedEntry?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSummary ? (
            <p className="workspace-header__meta mb-0">
              {selectedSummary.buildings} Building{selectedSummary.buildings === 1 ? "" : "s"}
              <span className="workspace-header__dot">|</span>
              {selectedSummary.floors} Floor{selectedSummary.floors === 1 ? "" : "s"}
              <span className="workspace-header__dot">|</span>
              {selectedSummary.devices} Device{selectedSummary.devices === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="text-white-50 small mb-0">Loading summary…</p>
          )}
          <p className="small text-white-50 mt-2 mb-0">Created {formatUpdatedAt(selectedEntry?.createdAt)}</p>
          <p className="small text-white-50 mt-1 mb-0">Updated {formatUpdatedAt(selectedEntry?.updatedAt)}</p>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10 justify-content-between">
          <Button variant="link" className="text-danger p-0" onClick={handleDelete}>
            Delete
          </Button>
          <div className="d-flex align-items-center gap-3">
            <Button variant="link" className="text-white-50 p-0" onClick={handleClose}>
              Close
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              disabled={selectedIsActive}
              onClick={handleOpen}
            >
              {selectedIsActive ? "Already Open" : "Open"}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function formatUpdatedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}
