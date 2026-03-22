import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { useActiveDeployment } from "../../../hooks/useEngineeringDraft";
import { activeDeploymentToEquipmentTree } from "../../../lib/activeDeploymentUtils";
import { Container, Row, Col, Card, Button, Form, Table, Modal, Toast } from "@themesberg/react-bootstrap";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight, faLayerGroup, faSnowflake, faFolder, faFilter, faSearch } from "@fortawesome/free-solid-svg-icons";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import { operatorRepository } from "../../../lib/data";

// ---------------------------------------
// Operator equipment tree row — simple, clear hierarchy + offline pill
// ---------------------------------------
const NODE_ICONS = {
  group: faSnowflake,
  floor: faLayerGroup,
  equip: faFolder,
};

/** Short status label for the offline/warn pill in the tree */
function getStatusPillLabel(status) {
  const s = (status || "").toString().trim().toLowerCase();
  if (["offline", "down", "disabled"].includes(s)) return "Offline";
  if (s === "unbound") return "Unbound";
  if (["warn", "warning"].includes(s)) return "Warn";
  if (["alarm", "fault", "critical"].includes(s)) return "Fault";
  return "Offline";
}

function EquipmentTreeRow({ level = 0, active, onClick, isGroup, isOpen, node, isLeaf, isDraggable, onDragStart }) {
  const pad = 8 + level * 20;
  const showCaret = isGroup;
  const Icon = NODE_ICONS[node.type] || faFolder;
  const status = (node.status || "Normal").toString().trim().toLowerCase();
  const isOfflineOrWarn = ["offline", "unbound", "down", "disabled", "warn", "warning", "alarm", "fault"].includes(status);

  const content = (
    <>
      <span className="site-tree-caret">
        {showCaret ? (
          <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} className="fa-sm" />
        ) : (
          <span className="site-tree-caret-placeholder" />
        )}
      </span>
      <span className="site-tree-icon">
        {isLeaf ? (
          <StatusDotLabel value={node.status || "Normal"} kind="status" dotOnly />
        ) : (
          <FontAwesomeIcon icon={Icon} className="fa-sm" />
        )}
      </span>
      <span className="site-tree-name-wrap">
        <span className="site-tree-name">{node.label}</span>
        {!isLeaf && node.sub ? (
          <span className="site-tree-subtext text-white-50"> · {node.sub}</span>
        ) : null}
        {isLeaf && isOfflineOrWarn && (
          <span className="operator-equipment-status-pill" data-status={status}>
            {getStatusPillLabel(node.status)}
          </span>
        )}
        <span className="site-tree-type-badge">
          {node.type === "group" ? "GROUP" : node.type === "floor" ? "FLOOR" : "EQUIPMENT"}
        </span>
      </span>
    </>
  );

  const commonProps = {
    className: [
      "site-tree-row",
      "operator-equipment-tree-row",
      active ? "site-tree-row--active" : "",
      isDraggable ? "site-tree-row--draggable" : "",
      isLeaf && isOfflineOrWarn ? "site-tree-row--offline" : "",
    ].filter(Boolean).join(" "),
    style: { paddingLeft: `${pad}px` },
    onClick,
  };

  if (isDraggable) {
    return (
      <div {...commonProps} draggable onDragStart={onDragStart}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" {...commonProps}>
      {content}
    </button>
  );
}

// ---------------------------------------
// Flatten tree to get all equipment leaf nodes
// ---------------------------------------
function flattenEquipmentNodes(nodes) {
  const out = [];
  const walk = (n) => {
    if (n.type === "equip") out.push(n);
    (n.children || []).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/** Get all equipment nodes under a node (for floors: AHU + all VAVs) */
function getEquipmentUnderNode(node) {
  if (node.type === "equip") return [node];
  const out = [];
  const walk = (n) => {
    if (n.type === "equip") out.push(n);
    (n.children || []).forEach(walk);
  };
  (node.children || []).forEach(walk);
  return out;
}

// ---------------------------------------
// Workspace Panel (per-workspace)
// ---------------------------------------
function WorkspacePanel({
  workspace,
  setWorkspace,
  dropActive,
  setDropActive,
  treeData,
  onAddPointsToWorkspace,
  handleDragStart,
  onRemove,
  showRemove,
  activeDeployment,
}) {
  const pointsOptions = useMemo(() => (activeDeployment ? { activeDeployment } : undefined), [activeDeployment]);
  const tableRef = useRef(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandConfirmStep, setCommandConfirmStep] = useState(false);
  const [showToast, setShowToast] = useState({ show: false, msg: "" });
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchSelected, setGlobalSearchSelected] = useState(new Set());
  const [showGlobalResults, setShowGlobalResults] = useState(false);

  const zone = workspace.id;

  const rows = workspace.rows || [];
  const scopeEquipment = workspace.scopeEquipment || [];
  const selectedRowIds = workspace.selectedRowIds || [];
  const existingRowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  // Filter mode: filter rows by equipmentName, pointName, value, status
  const filteredRows = useMemo(() => {
    if (workspace.searchMode !== "filter") return rows;
    const q = String(workspace.filterText || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.equipmentName || "").toLowerCase().includes(q) ||
        String(r.pointId || "").toLowerCase().includes(q) ||
        String(r.pointName || "").toLowerCase().includes(q) ||
        String(r.value || "").toLowerCase().includes(q) ||
        String(r.status || "").toLowerCase().includes(q)
    );
  }, [rows, workspace.searchMode, workspace.filterText]);

  // Global search results (scoped query)
  const globalSearchResultsMemo = useMemo(() => {
    const gq = String(workspace.globalQuery || "").trim();
    if (workspace.searchMode !== "global" || !gq) return [];
    const scopeEquipIds = new Set(scopeEquipment.map((e) => e.equipmentId));
    if (scopeEquipIds.size === 0) return [];

    const q = workspace.globalQuery.trim().toLowerCase().replace(/\*/g, "");
    const matches = (str) => (q ? String(str || "").toLowerCase().includes(q) : true);

    const equipNodes = flattenEquipmentNodes(treeData);
    const results = [];
    for (const node of equipNodes) {
      if (!scopeEquipIds.has(node.id)) continue;
      const points = operatorRepository.getWorkspacePointsForEquipment(
        node.id,
        node.label,
        node.status,
        pointsOptions
      );
      const matched = points.filter(
        (p) => matches(p.pointId) || matches(p.pointName) || matches(p.units)
      );
      if (matched.length) results.push({ equipment: node, points: matched });
    }
    return results;
  }, [workspace.searchMode, workspace.globalQuery, scopeEquipment, treeData, pointsOptions]);

  useEffect(() => {
    setGlobalSearchResults(globalSearchResultsMemo);
    setGlobalSearchSelected(new Set());
  }, [globalSearchResultsMemo]);

  const selectedCount = selectedRowIds.length;
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedRowIds.includes(r.id)),
    [rows, selectedRowIds]
  );

  const addAllPointsForEquipment = useCallback(
    (equipmentId, equipmentName, status) => {
      const points = operatorRepository.getWorkspacePointsForEquipment(
        equipmentId,
        equipmentName,
        status,
        pointsOptions
      );
      setWorkspace((prev) => {
        const prevRows = prev.rows || [];
        const existing = new Set(prevRows.map((r) => r.id));
        const toAdd = points.filter((p) => !existing.has(p.id));
        if (toAdd.length === 0) return prev;
        return { ...prev, rows: [...prevRows, ...toAdd] };
      });
      return points.filter((p) => !existingRowIds.has(p.id)).length;
    },
    [setWorkspace, existingRowIds, pointsOptions]
  );

  const addSinglePointToWorkspace = useCallback(
    (row) => {
      if (existingRowIds.has(row.id)) return false;
      setWorkspace((prev) => ({ ...prev, rows: [...(prev.rows || []), row] }));
      return true;
    },
    [setWorkspace, existingRowIds]
  );

  const toggleRowSelection = useCallback(
    (rowIdToToggle, modifiers) => {
      const idx = filteredRows.findIndex((r) => r.id === rowIdToToggle);
      if (idx < 0) return;

      setWorkspace((prev) => {
        const ids = new Set(prev.selectedRowIds);
        if (modifiers.ctrlKey || modifiers.metaKey) {
          if (ids.has(rowIdToToggle)) ids.delete(rowIdToToggle);
          else ids.add(rowIdToToggle);
        } else if (modifiers.shiftKey) {
          const from = lastClickedIndex != null ? lastClickedIndex : idx;
          const lo = Math.min(from, idx);
          const hi = Math.max(from, idx);
          for (let i = lo; i <= hi; i++) ids.add(filteredRows[i].id);
        } else {
          ids.clear();
          ids.add(rowIdToToggle);
        }
        return { ...prev, selectedRowIds: Array.from(ids) };
      });
      setLastClickedIndex(idx);
    },
    [filteredRows, setWorkspace, lastClickedIndex]
  );

  const handleRowClick = useCallback(
    (e, row) => {
      toggleRowSelection(row.id, { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
    },
    [toggleRowSelection]
  );

  const handleTableKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setWorkspace((prev) => ({
          ...prev,
          selectedRowIds: filteredRows.map((r) => r.id),
        }));
      }
    },
    [filteredRows, setWorkspace]
  );

  const clearSelection = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, selectedRowIds: [] }));
  }, [setWorkspace]);

  const removeSelected = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      rows: (prev.rows || []).filter((r) => !(prev.selectedRowIds || []).includes(r.id)),
      selectedRowIds: [],
    }));
  }, [setWorkspace]);

  const clearTable = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, rows: [], selectedRowIds: [] }));
  }, [setWorkspace]);

  const clearSearch = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      filterText: "",
      globalQuery: "",
    }));
  }, [setWorkspace]);

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropActive((p) => ({ ...p, [zone]: true }));
    },
    [zone, setDropActive]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setDropActive((p) => ({ ...p, [zone]: false }));
      }
    },
    [zone, setDropActive]
  );

  const handleDropOnTable = useCallback(
    (e) => {
      e.preventDefault();
      setDropActive((p) => ({ ...p, [zone]: false }));
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
        const equipmentList = data.equipment && Array.isArray(data.equipment)
          ? data.equipment
          : (data.id && data.label
            ? [{ id: data.id, label: data.label, status: data.status || "OK" }]
            : []);
        if (equipmentList.length === 0) return;
        const existing = new Set(rows.map((r) => r.id));
        let newPointCount = 0;
        equipmentList.forEach((eq) => {
          const points = operatorRepository.getWorkspacePointsForEquipment(
            eq.id,
            eq.label,
            eq.status || "OK",
            pointsOptions
          );
          newPointCount += points.filter((p) => !existing.has(p.id)).length;
        });
        if (newPointCount === 0) {
          if (data.type === "floor") setShowToast({ show: true, msg: "All equipment from this floor already in workspace" });
          else if (equipmentList.length === 1 && rows.some((r) => String(r.equipmentId) === String(equipmentList[0].id))) setShowToast({ show: true, msg: "Equipment already in workspace" });
          return;
        }
        setPendingAdd({ equipmentList, data });
        setShowAddConfirm(true);
      } catch (_) {}
    },
    [zone, setDropActive, rows, pointsOptions]
  );

  const confirmAddToWorkspace = useCallback(() => {
    if (!pendingAdd) return;
    const { equipmentList } = pendingAdd;
    equipmentList.forEach((eq) => addAllPointsForEquipment(eq.id, eq.label, eq.status || "OK"));
    setShowAddConfirm(false);
    setPendingAdd(null);
  }, [pendingAdd, addAllPointsForEquipment]);

  const handleDropOnScope = useCallback(
    (e) => {
      e.preventDefault();
      setDropActive((p) => ({ ...p, [`${zone}-scope`]: false }));
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
        const equipmentList = data.equipment && Array.isArray(data.equipment) ? data.equipment : (data.id && data.label ? [{ id: data.id, label: data.label }] : []);
        if (equipmentList.length === 0) return;
        setWorkspace((prev) => {
          const prevScope = prev.scopeEquipment || [];
          const existing = new Set(prevScope.map((s) => String(s.equipmentId)));
          const toAdd = equipmentList.filter((eq) => !existing.has(String(eq.id)));
          if (toAdd.length === 0) return prev;
          const newChips = toAdd.map((eq) => ({ equipmentId: eq.id, equipmentName: eq.label }));
          return {
            ...prev,
            scopeEquipment: [...prevScope, ...newChips],
          };
        });
      } catch (_) {}
    },
    [setWorkspace, zone, setDropActive]
  );

  const removeScopeChip = useCallback(
    (equipmentId) => {
      setWorkspace((prev) => ({
        ...prev,
        scopeEquipment: (prev.scopeEquipment || []).filter((e) => String(e.equipmentId) !== String(equipmentId)),
      }));
    },
    [setWorkspace]
  );

  const clearScope = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, scopeEquipment: [] }));
  }, [setWorkspace]);

  const runGlobalSearch = useCallback(() => {
    setShowGlobalResults(!!workspace.globalQuery.trim());
  }, [workspace.globalQuery]);

  const toggleGlobalResult = useCallback((row) => {
    setGlobalSearchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }, []);

  const addGlobalSelectedToWorkspace = useCallback(() => {
    const toAdd = globalSearchResults.flatMap((g) => g.points).filter((p) => globalSearchSelected.has(p.id));
    let added = 0;
    toAdd.forEach((row) => {
      if (addSinglePointToWorkspace(row)) added++;
    });
    setShowToast({ show: true, msg: `Added ${added} point(s) to workspace` });
    setGlobalSearchSelected(new Set());
    setShowGlobalResults(false);
  }, [globalSearchResults, globalSearchSelected, addSinglePointToWorkspace]);

  const addAllGlobalResultsToWorkspace = useCallback(() => {
    const all = globalSearchResults.flatMap((g) => g.points);
    let added = 0;
    all.forEach((row) => {
      if (addSinglePointToWorkspace(row)) added++;
    });
    setShowToast({ show: true, msg: `Added ${added} point(s) to workspace` });
    setGlobalSearchSelected(new Set());
    setShowGlobalResults(false);
  }, [globalSearchResults, addSinglePointToWorkspace]);

  const openCommandModal = useCallback(() => {
    setCommandConfirmStep(selectedCount > 10);
    setShowCommandModal(true);
    setCommandInput("");
  }, [selectedCount]);

  const handleCommandApply = useCallback(() => {
    if (commandConfirmStep) {
      setCommandConfirmStep(false);
      return;
    }
    console.log("Command Selected:", {
      points: selectedRows.map((r) => ({ id: r.id, equipment: r.equipmentName, point: r.pointId })),
      command: commandInput,
    });
    setShowCommandModal(false);
    clearSelection();
  }, [commandConfirmStep, selectedRows, commandInput, clearSelection]);

  const scopeTrayDropActive = dropActive[`${zone}-scope`];

  return (
    <div className="workspace-panel">
      {/* Header row */}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="text-white fw-semibold">{workspace.name}</span>
          {showRemove && onRemove && (
            <Button size="sm" variant="outline-secondary" className="text-white-50 py-0 px-1" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="workspace-toolbar workspace-toolbar--structured mb-3">
        <div className="workspace-toolbar__row workspace-toolbar__row--modes">
          <div
            className="workspace-mode-segmented"
            role="tablist"
            aria-label="Workspace search mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspace.searchMode === "filter"}
              className={`workspace-mode-segmented__opt ${workspace.searchMode === "filter" ? "workspace-mode-segmented__opt--active" : ""}`}
              onClick={() => setWorkspace((p) => ({ ...p, searchMode: "filter" }))}
            >
              <FontAwesomeIcon icon={faFilter} className="workspace-mode-segmented__icon" aria-hidden />
              <span className="workspace-mode-segmented__text">
                <span className="workspace-mode-segmented__title">Workspace filter</span>
                <span className="workspace-mode-segmented__hint">Narrow rows in this table</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace.searchMode === "global"}
              className={`workspace-mode-segmented__opt ${workspace.searchMode === "global" ? "workspace-mode-segmented__opt--active" : ""}`}
              onClick={() => setWorkspace((p) => ({ ...p, searchMode: "global" }))}
            >
              <FontAwesomeIcon icon={faSearch} className="workspace-mode-segmented__icon" aria-hidden />
              <span className="workspace-mode-segmented__text">
                <span className="workspace-mode-segmented__title">Scoped search</span>
                <span className="workspace-mode-segmented__hint">Find points across equipment in scope</span>
              </span>
            </button>
          </div>
          <div className="workspace-toolbar__meta">
            <span className="workspace-toolbar__count">{rows.length}</span>
            <span className="workspace-toolbar__count-label">points in workspace</span>
          </div>
        </div>
        <div className="workspace-toolbar__row workspace-toolbar__row--actions">
          <div className="workspace-toolbar__search-wrap">
            {workspace.searchMode === "filter" ? (
              <Form.Control
                size="sm"
                className="workspace-toolbar__input bg-primary border border-light border-opacity-10 text-white"
                placeholder="Filter by equipment, point, value, status..."
                value={workspace.filterText ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setWorkspace((p) => ({ ...p, filterText: value }));
                }}
              />
            ) : (
              <Form.Control
                size="sm"
                className="workspace-toolbar__input bg-primary border border-light border-opacity-10 text-white"
                placeholder="Query within scope (e.g. DA-T, Flow, Damper) — press Enter or Run"
                value={workspace.globalQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setWorkspace((p) => ({ ...p, globalQuery: value }));
                }}
                onKeyDown={(e) => e.key === "Enter" && runGlobalSearch()}
                disabled={scopeEquipment.length === 0}
              />
            )}
            {workspace.searchMode === "global" && (
              <Button
                size="sm"
                variant="dark"
                className="workspace-action-btn workspace-action-btn--brand workspace-toolbar__run"
                disabled={workspace.scopeEquipment.length === 0}
                onClick={runGlobalSearch}
              >
                Run
              </Button>
            )}
          </div>
          <div className="workspace-toolbar__right workspace-toolbar__right--compact">
            <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={clearTable}>
              Clear table
            </Button>
            <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={removeSelected} disabled={selectedCount === 0}>
              Remove selected
            </Button>
            <Button size="sm" variant="dark" className="workspace-table-action-btn">
              Refresh
            </Button>
            <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={clearSearch}>
              Clear search
            </Button>
          </div>
        </div>
      </div>

      {/* Global mode: Scope tray + Query input */}
      {workspace.searchMode === "global" && (
        <div className="mb-3 legion-global-search">
          <div className="small text-white mb-1">Search Scope</div>
          <div
            className={`legion-scope-tray mb-2 ${scopeTrayDropActive ? "legion-scope-tray--active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDropActive((p) => ({ ...p, [`${zone}-scope`]: true }));
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget)) setDropActive((p) => ({ ...p, [`${zone}-scope`]: false }));
            }}
            onDrop={handleDropOnScope}
          >
            {scopeEquipment.length === 0 ? (
              <div className="text-white-50 small py-2">Drag equipment or floors here to define scope</div>
            ) : (
              <div className="d-flex flex-wrap gap-1 align-items-center">
                {scopeEquipment.map((s) => (
                  <span key={s.equipmentId} className="legion-scope-chip">
                    {s.equipmentName}
                    <button type="button" className="legion-scope-chip-remove" onClick={() => removeScopeChip(s.equipmentId)} aria-label="Remove">
                      ✕
                    </button>
                  </span>
                ))}
                <Button size="sm" variant="outline-light" className="border-opacity-25 py-0" onClick={clearScope}>
                  Clear Scope
                </Button>
              </div>
            )}
          </div>
          <div className="position-relative">
            {scopeEquipment.length === 0 && (
              <div className="small text-white-50 mt-1">Add equipment to scope to run search</div>
            )}

            {/* Global search results dropdown */}
            {showGlobalResults && (
              <div className="legion-global-results-panel mt-2">
                {globalSearchResults.length === 0 ? (
                  <div className="text-white-50 small">No matches for your query.</div>
                ) : (
                  <>
                {globalSearchResults.map(({ equipment, points }) => (
                  <div key={equipment.id} className="mb-2">
                    <div className="text-white fw-semibold small">
                      {equipment.label} ({points.length} matches)
                    </div>
                    <div className="ps-2">
                      {points.map((p) => (
                        <label key={p.id} className="d-flex align-items-center gap-2 legion-global-result-row">
                          <Form.Check
                            type="checkbox"
                            checked={globalSearchSelected.has(p.id)}
                            onChange={() => toggleGlobalResult(p)}
                          />
                          <span className="text-white">{p.pointId}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="d-flex gap-2 mt-2 pt-2 border-top border-light border-opacity-10">
                  <Button size="sm" variant="success" onClick={addGlobalSelectedToWorkspace} disabled={globalSearchResults.length === 0}>
                    Add Selected to Workspace
                  </Button>
                  <Button size="sm" variant="outline-success" onClick={addAllGlobalResultsToWorkspace} disabled={globalSearchResults.length === 0}>
                    Add All Results
                  </Button>
                  <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={() => setShowGlobalResults(false)}>
                    Clear Results
                  </Button>
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection action bar */}
      {selectedCount > 0 && (
        <div className="legion-selection-bar mb-2">
          <span className="text-white fw-semibold">{selectedCount} Selected</span>
          <div className="d-flex gap-2">
            <Button size="sm" variant="success" onClick={openCommandModal}>
              Command Selected
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={removeSelected}>
              Remove Selected
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={clearSelection}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        ref={tableRef}
        tabIndex={0}
        role="grid"
        aria-label="Workspace points table"
        className={[
          "legion-workspace-dropzone border border-light border-opacity-10 rounded",
          dropActive[zone] ? "legion-workspace-dropzone--active" : "",
          rows.length === 0 ? "legion-workspace-dropzone--empty" : "legion-workspace-dropzone--has-rows",
        ].filter(Boolean).join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnTable}
        onKeyDown={handleTableKeyDown}
        onClick={(e) => e.currentTarget.focus()}
        style={{ outline: "none" }}
      >
        <div className="legion-workspace-table-scroll">
          <Table hover className="bg-primary border-0 legion-workspace-table mb-0">
            <thead>
              <tr>
                <th className="legion-workspace-th legion-workspace-th--check" scope="col" />
                <th className="legion-workspace-th" scope="col">Equipment</th>
                <th className="legion-workspace-th" scope="col">Point</th>
                <th className="legion-workspace-th" scope="col">Value</th>
                <th className="legion-workspace-th legion-workspace-th--narrow" scope="col">Status</th>
                <th className="legion-workspace-th legion-workspace-th--actions text-end" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={
                      rows.length === 0
                        ? "legion-workspace-empty legion-workspace-empty--drop-hint"
                        : "legion-workspace-empty"
                    }
                  >
                    {rows.length === 0 ? (
                      <p className="legion-workspace-empty-hint text-white-50 mb-0">
                        Drag equipment from the tree into this table to add points. You can drop one unit or an entire floor.
                      </p>
                    ) : (
                      <span className="legion-workspace-empty-filter-hint text-white-50">No matches</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`legion-workspace-row ${selectedRowIds.includes(row.id) ? "table-active" : ""}`}
                    onClick={(e) => handleRowClick(e, row)}
                  >
                    <td className="legion-workspace-td legion-workspace-td--check">
                      <Form.Check
                        type="checkbox"
                        checked={workspace.selectedRowIds.includes(row.id)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="legion-workspace-td text-white fw-semibold">{row.equipmentName}</td>
                    <td className="legion-workspace-td legion-workspace-point text-white">{row.pointId}</td>
                    <td className="legion-workspace-td text-white">{row.value}</td>
                    <td className="legion-workspace-td legion-workspace-td--status">
                      <StatusDotLabel
                        value={row.status || "Normal"}
                        kind="status"
                        dotOnly={["ok", "normal", "online"].includes((row.status || "").toLowerCase())}
                      />
                    </td>
                    <td className="legion-workspace-td text-end">
                      <Button size="sm" variant="outline-light" className="legion-workspace-cmd-btn border-opacity-10">
                        Command
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Add to Workspace Confirmation Modal */}
      <Modal
        centered
        show={showAddConfirm}
        onHide={() => { setShowAddConfirm(false); setPendingAdd(null); }}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Add to Workspace</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-white">
          {pendingAdd && (() => {
            const { equipmentList } = pendingAdd;
            const existing = new Set(rows.map((r) => r.id));
            let newPointCount = 0;
            equipmentList.forEach((eq) => {
              const pts = operatorRepository.getWorkspacePointsForEquipment(
                eq.id,
                eq.label,
                eq.status || "OK",
                pointsOptions
              );
              newPointCount += pts.filter((p) => !existing.has(p.id)).length;
            });
            return (
              <p className="mb-0">
                Are you sure you want to add <strong>{equipmentList.length} device{equipmentList.length !== 1 ? "s" : ""}</strong> ({newPointCount} point{newPointCount !== 1 ? "s" : ""}) to this workspace?
              </p>
            );
          })()}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={() => { setShowAddConfirm(false); setPendingAdd(null); }}>Cancel</Button>
          <Button variant="success" onClick={confirmAddToWorkspace}>Add</Button>
        </Modal.Footer>
      </Modal>

      {/* Command Selected Modal */}
      <Modal
        centered
        show={showCommandModal}
        onHide={() => {
          setShowCommandModal(false);
          setCommandConfirmStep(false);
        }}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">
            {commandConfirmStep ? "Confirm Command" : "Command Selected Points"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-white">
          {commandConfirmStep ? (
            <p className="mb-0">
              You are about to send a command to {selectedCount} points. This action cannot be undone. Continue?
            </p>
          ) : (
            <>
              <div className="mb-2 small text-white-50">Selected points:</div>
              <div className="legion-command-points-list mb-3">
                {selectedRows.slice(0, 15).map((r) => (
                  <div key={r.id} className="small">
                    {r.equipmentName} — {r.pointId}
                  </div>
                ))}
                {selectedRows.length > 15 && <div className="small text-white-50">... and {selectedRows.length - 15} more</div>}
              </div>
              <Form.Group>
                <Form.Label className="text-white small">Command</Form.Label>
                <Form.Control
                  className="bg-primary border border-light border-opacity-10 text-white"
                  placeholder="Enter command..."
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={() => setShowCommandModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleCommandApply}>
            {commandConfirmStep ? "Continue" : "Apply"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast */}
      {showToast.show && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1100 }}>
          <Toast show={showToast.show} onClose={() => setShowToast({ show: false, msg: "" })}>
            <Toast.Header className="bg-success text-white">
              <strong className="me-auto">Workspace</strong>
            </Toast.Header>
            <Toast.Body>{showToast.msg}</Toast.Body>
          </Toast>
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  const history = useHistory();
  const { site } = useSite();
  const activeDeployment = useActiveDeployment();
  const goToEquipment = (node) =>
    history.push(`/legion/equipment/${node.instanceNumber ? encodeURIComponent(node.instanceNumber) : node.id}`);

  const treeData = useMemo(
    () => activeDeploymentToEquipmentTree(activeDeployment),
    [activeDeployment]
  );

  const [treeSearch, setTreeSearch] = useState("");
  const [openMap, setOpenMap] = useState({ plant: true, f1: true, ahu1: true });
  const [selectedEquipId, setSelectedEquipId] = useState(null);
  const [dropActive, setDropActive] = useState({});

  const toggleOpen = (id) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  const filteredTree = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return treeData;
    const matches = (v) => String(v || "").toLowerCase().includes(q);
    const walk = (node) => {
      if (!node.children) return matches(node.label) || matches(node.id) ? node : null;
      const kids = node.children.map(walk).filter(Boolean);
      if (kids.length || matches(node.label) || matches(node.sub) || matches(node.id)) return { ...node, children: kids };
      return null;
    };
    return treeData.map(walk).filter(Boolean);
  }, [treeData, treeSearch]);

  const initialWorkspace = (id, name) => ({
    id,
    name,
    rows: [],
    searchMode: "filter",
    filterText: "",
    globalQuery: "",
    scopeEquipment: [],
    selectedRowIds: [],
  });

  const [mainWorkspace, setMainWorkspace] = useState(() => initialWorkspace("main", "Main Workspace"));
  const [secondaryWorkspace, setSecondaryWorkspace] = useState(() => initialWorkspace("secondary", "Secondary Workspace"));
  const [showSecondaryWorkspace, setShowSecondaryWorkspace] = useState(false);

  const handleDragStart = useCallback((e, node, tree) => {
    const equipment = node.type === "floor" ? getEquipmentUnderNode(node) : [node];
    e.dataTransfer.setData("text/plain", JSON.stringify({
      type: node.type === "floor" ? "floor" : "equip",
      id: node.id,
      label: node.label,
      status: node.status || "OK",
      equipment,
    }));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const TreeNode = ({ node, level = 0 }) => {
    const isGroup = node.type === "group";
    const isFloor = node.type === "floor";
    const isLeaf = node.type === "equip";
    const isExpandable = isGroup || isFloor;
    const isOpen = !!openMap[node.id];
    const isActive = selectedEquipId === node.id;
    const isDraggable = isLeaf || isFloor;

    const onClick = () => {
      if (isExpandable) return toggleOpen(node.id);
      setSelectedEquipId(node.id);
      goToEquipment(node);
    };

    const onDragStart = isDraggable ? (e) => handleDragStart(e, node, treeData) : undefined;

    return (
      <div className="site-tree-node">
        <EquipmentTreeRow level={level} active={isActive} onClick={onClick} isGroup={isExpandable} isOpen={isOpen} node={node} isLeaf={isLeaf} isDraggable={isDraggable} onDragStart={onDragStart} />
        {isExpandable && isOpen && node.children?.length ? (
          <div className="site-tree-children">
            {node.children.map((c) => (
              <TreeNode key={c.id} node={c} level={level + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="legion-equipment-page px-3 px-md-4 pb-4 mt-3">
        <Row className="g-3 align-items-start">
          <Col xs={12} lg={4} xl={3}>
            <Card className="legion-equipment-sidebar-card bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body className="p-0">
                <div className="px-3 pt-2 pb-2 d-flex align-items-center justify-content-between">
                  <div className="text-white fw-bold">Equipment</div>
                  <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50 py-0" style={{ height: 24 }}>
                    Collapse
                  </Button>
                </div>
                <div className="px-3 pb-2">
                  <Form.Control
                    size="sm"
                    placeholder="Search equipment..."
                    className="bg-primary border border-light border-opacity-10 text-white"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                  />
                </div>
                <div className="border-top border-light border-opacity-10" style={{ height: 1 }} />
                <div className="legion-equipment-tree site-builder-tree operator-equipment-tree legion-equipment-tree--scroll pb-2">
                  {filteredTree.map((n) => (
                    <TreeNode key={n.id} node={n} level={0} />
                  ))}
                  {filteredTree.length === 0 ? <div className="px-3 py-3 text-white-50 small">No matches.</div> : null}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={8} xl={9}>
            <Card className="legion-equipment-workspaces bg-primary text-white border border-light border-opacity-10 shadow-sm">
              <Card.Body className="text-white">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                  <div>
                    <div className="text-white fw-bold fs-5 mb-1">Workspaces</div>
                    <div className="text-white-50 small">
                      Drag equipment from the tree to add points to a workspace or scope. Each workspace has its own search and selection.
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Button size="sm" variant="dark" className="workspace-action-btn workspace-action-btn--brand">
                      Filters
                    </Button>
                    <Button
                      size="sm"
                      variant="dark"
                      className="border border-light border-opacity-10 text-white-50"
                      onClick={() => {
                        setMainWorkspace((p) => ({ ...p, rows: [], selectedRowIds: [] }));
                        setSecondaryWorkspace((p) => ({ ...p, rows: [], selectedRowIds: [] }));
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <WorkspacePanel
                  workspace={mainWorkspace}
                  setWorkspace={setMainWorkspace}
                  dropActive={dropActive}
                  setDropActive={setDropActive}
                  treeData={treeData}
                  handleDragStart={handleDragStart}
                  activeDeployment={activeDeployment}
                />

                {showSecondaryWorkspace ? (
                  <div className="mt-4 pt-3 border-top border-light border-opacity-10">
                    <WorkspacePanel
                      workspace={secondaryWorkspace}
                      setWorkspace={setSecondaryWorkspace}
                      dropActive={dropActive}
                      setDropActive={setDropActive}
                      treeData={treeData}
                      handleDragStart={handleDragStart}
                      onRemove={() => setShowSecondaryWorkspace(false)}
                      showRemove
                      activeDeployment={activeDeployment}
                    />
                  </div>
                ) : (
                  <div className="mt-4 pt-3 border-top border-light border-opacity-10">
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="border border-light border-opacity-25 text-white-50"
                      onClick={() => setShowSecondaryWorkspace(true)}
                    >
                      Add Secondary Workspace
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}
