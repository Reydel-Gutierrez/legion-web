import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsAltV, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { Routes } from "../../../routes";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { hierarchyRepository } from "../../../lib/data";
import { canMutateFacilityHierarchy } from "../../../lib/access/operatorPermissions";

export default function SidebarUtilityControls({
  currentUser,
  selectedNode,
  onRefresh,
  reorderMode,
  onToggleReorderMode,
}) {
  const navigate = useNavigate();
  const canMutate = canMutateFacilityHierarchy(currentUser);
  const [plusOpen, setPlusOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const childCount = selectedNode?.children?.length || 0;

  const plusItems = useMemo(() => {
    const items = [];
    if (canMutate) {
      items.push({ id: "site-builder", label: "Add hierarchy object (Site Builder)" });
      items.push({ id: "discovery", label: "Network discovery" });
    }
    items.push({ id: "workspace", label: "Open point workspace" });
    if (selectedNode?.kind === "equipment") {
      items.push({ id: "trends", label: "New trend for selection" });
    }
    return items;
  }, [canMutate, selectedNode]);

  const runPlus = (id) => {
    setPlusOpen(false);
    if (id === "site-builder") navigate(Routes.EngineeringSiteBuilder.path);
    else if (id === "discovery") navigate(Routes.EngineeringNetworkDiscovery.path);
    else if (id === "workspace") navigate(Routes.LegionEquipment.path);
    else if (id === "trends") navigate(Routes.LegionTrends.path);
  };

  const handleDelete = async () => {
    if (!canMutate || !selectedNode || selectedNode.kind === "site") return;
    if (childCount > 0) {
      setNotice("This object has children. Remove or move them first.");
      setConfirmDelete(false);
      return;
    }
    if (!USE_HIERARCHY_API) {
      setNotice("Hierarchy deletion is not persisted without the hierarchy API.");
      setConfirmDelete(false);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      if (selectedNode.kind === "equipment") {
        await hierarchyRepository.deleteEquipment(selectedNode.id);
      } else if (selectedNode.kind === "floor") {
        await hierarchyRepository.deleteFloor(selectedNode.id);
      } else {
        setNotice("Deleting this object type is not available from Operator.");
        setBusy(false);
        setConfirmDelete(false);
        return;
      }
      setConfirmDelete(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setNotice(err?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sidebar-utils">
      <div className="sidebar-utils__row">
        <button
          type="button"
          className="sidebar-utils__icon"
          title="Add"
          aria-label="Add"
          onClick={() => {
            setPlusOpen((v) => !v);
            setConfirmDelete(false);
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
        <button
          type="button"
          className="sidebar-utils__icon"
          title="Remove"
          aria-label="Remove"
          disabled={!canMutate || !selectedNode || selectedNode.kind === "site"}
          onClick={() => {
            setConfirmDelete((v) => !v);
            setPlusOpen(false);
          }}
        >
          <FontAwesomeIcon icon={faMinus} />
        </button>
        <button
          type="button"
          className={`sidebar-utils__icon${reorderMode ? " is-active" : ""}`}
          title={reorderMode ? "Done organizing" : "Organize"}
          aria-label={reorderMode ? "Done organizing equipment order" : "Organize equipment order"}
          aria-pressed={reorderMode}
          onClick={() => {
            onToggleReorderMode();
            setPlusOpen(false);
            setConfirmDelete(false);
          }}
        >
          <FontAwesomeIcon icon={faArrowsAltV} />
        </button>
      </div>

      {reorderMode ? (
        <p className="sidebar-utils__hint">
          Use the arrows next to each equipment in the tree to move it up or down within its floor.
        </p>
      ) : null}

      {plusOpen ? (
        <ul className="sidebar-utils__menu">
          {plusItems.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => runPlus(item.id)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {confirmDelete ? (
        <div className="sidebar-utils__panel">
          <p>
            Remove <strong>{selectedNode?.label}</strong>? This cannot be undone.
          </p>
          {childCount > 0 ? (
            <p className="sidebar-utils__warn">Has {childCount} child object(s).</p>
          ) : null}
          <div className="sidebar-utils__panel-actions">
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button type="button" className="is-danger" disabled={busy || childCount > 0} onClick={handleDelete}>
              Confirm
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="sidebar-utils__warn">{notice}</p> : null}
    </div>
  );
}
