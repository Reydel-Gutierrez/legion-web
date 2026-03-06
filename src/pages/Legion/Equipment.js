// src/pages/Legion/Equipment.js
import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useSite } from "../../components/SiteContext";
import { Container, Row, Col, Card, Button, ButtonGroup, Form, Table, Modal, Toast } from "@themesberg/react-bootstrap";
import { useHistory } from "react-router-dom";
import LegionHeroHeader from "../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../components/legion/StatusDotLabel";

// ---------------------------------------
// Mock points per equipment type (4-5 points each)
// ---------------------------------------
const MOCK_POINTS = {
  vav: [
    { pointId: "DA-T", name: "Discharge Air Temp", value: "72.5", unit: "°F" },
    { pointId: "SA-T", name: "Supply Air Temp", value: "55.2", unit: "°F" },
    { pointId: "Space-T", name: "Space Temperature", value: "71.0", unit: "°F" },
    { pointId: "Flow", name: "Airflow", value: "245", unit: "CFM" },
    { pointId: "Damper-Cmd", name: "Damper Command", value: "62", unit: "%" },
  ],
  ahu: [
    { pointId: "SAT", name: "Supply Air Temp", value: "55.0", unit: "°F" },
    { pointId: "MAT", name: "Mixed Air Temp", value: "62.5", unit: "°F" },
    { pointId: "Fan-Cmd", name: "Fan Command", value: "85", unit: "%" },
    { pointId: "Status", name: "Run Status", value: "On", unit: "" },
    { pointId: "Economizer", name: "Economizer Pos", value: "45", unit: "%" },
  ],
  chiller: [
    { pointId: "CWST", name: "CHW Supply Temp", value: "44.0", unit: "°F" },
    { pointId: "CWRT", name: "CHW Return Temp", value: "54.2", unit: "°F" },
    { pointId: "Status", name: "Run Status", value: "On", unit: "" },
    { pointId: "Cap", name: "Capacity", value: "78", unit: "%" },
    { pointId: "Alarms", name: "Active Alarms", value: "0", unit: "" },
  ],
};

/** Unique row id: equipmentId + pointId */
function rowId(equipmentId, pointId) {
  return `${equipmentId}-${pointId}`;
}

function getPointsForEquipment(equipmentId, equipmentName, status) {
  const idStr = String(equipmentId || "").toLowerCase();
  const isChiller = typeof equipmentId === "number" && equipmentId >= 9000;
  const isAhu = idStr.includes("ahu");
  let points;
  if (isChiller) points = MOCK_POINTS.chiller;
  else if (isAhu) points = MOCK_POINTS.ahu;
  else points = MOCK_POINTS.vav;
  return points.map((pt) => ({
    id: rowId(equipmentId, pt.pointId),
    equipmentId,
    equipmentName,
    pointId: pt.pointId,
    pointName: pt.name,
    value: pt.unit ? `${pt.value} ${pt.unit}`.trim() : pt.value,
    units: pt.unit || "",
    status: status || "OK",
  }));
}

// ---------------------------------------
// Reusable tree row component
// ---------------------------------------
const ONLINE_STATUSES = ["ok", "normal", "online", "active", "enabled"];

function EquipmentTreeRow({ level = 0, active, onClick, isGroup, isOpen, node, isLeaf, isDraggable, onDragStart }) {
  const pad = 8 + level * 16;
  const rawStatus = (node.status || "Normal").toString().toLowerCase();
  const dotOnly = ONLINE_STATUSES.includes(rawStatus);
  const showCaret = isGroup;

  const content = (
    <>
      <span className="equipment-tree-caret">
        {showCaret ? (isOpen ? "▾" : "▸") : ""}
      </span>

      <div className="equipment-tree-content">
        {!showCaret ? <StatusDotLabel value={node.status || "Normal"} kind="status" dotOnly={dotOnly} /> : null}
        <span className="equipment-tree-name">{node.label}</span>
        {node.sub ? (
          <span className="equipment-tree-subtext text-white-50">• {node.sub}</span>
        ) : null}
      </div>
    </>
  );

  const commonProps = {
    className: [
      "equipment-tree-row",
      active ? "equipment-tree-row--active" : "",
      isDraggable ? "equipment-tree-row--draggable" : "",
    ].filter(Boolean).join(" "),
    style: { "--tree-pad": `${pad}px` },
    onClick,
  };

  if (isDraggable) {
    return (
      <div
        {...commonProps}
        draggable
        onDragStart={onDragStart}
      >
        {content}
      </div>
    );
  }

  return <button type="button" {...commonProps}>{content}</button>;
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
}) {
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
      const points = getPointsForEquipment(node.id, node.label, node.status);
      const matched = points.filter(
        (p) => matches(p.pointId) || matches(p.pointName) || matches(p.units)
      );
      if (matched.length) results.push({ equipment: node, points: matched });
    }
    return results;
  }, [workspace.searchMode, workspace.globalQuery, scopeEquipment, treeData]);

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
      const points = getPointsForEquipment(equipmentId, equipmentName, status);
      setWorkspace((prev) => {
        const prevRows = prev.rows || [];
        const existing = new Set(prevRows.map((r) => r.id));
        const toAdd = points.filter((p) => !existing.has(p.id));
        if (toAdd.length === 0) return prev;
        return { ...prev, rows: [...prevRows, ...toAdd] };
      });
      return points.filter((p) => !existingRowIds.has(p.id)).length;
    },
    [setWorkspace, existingRowIds]
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
        const equipmentList = data.equipment && Array.isArray(data.equipment) ? data.equipment : (data.id && data.label ? [{ id: data.id, label: data.label, status: data.status || "OK" }] : []);
        if (equipmentList.length === 0) return;
        const existing = new Set(rows.map((r) => r.id));
        let newPointCount = 0;
        equipmentList.forEach((eq) => {
          const points = getPointsForEquipment(eq.id, eq.label, eq.status || "OK");
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
    [zone, setDropActive, rows]
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
      {/* Header + Controls */}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="text-white fw-semibold">{workspace.name}</span>
          {showRemove && onRemove && (
            <Button size="sm" variant="outline-secondary" className="text-white-50 py-0 px-1" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
        <div className="d-flex align-items-center gap-1 flex-wrap">
          <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50" onClick={clearTable}>
            Clear Table
          </Button>
          <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50" onClick={removeSelected} disabled={selectedCount === 0}>
            Remove Selected
          </Button>
          <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50">
            Refresh
          </Button>
          <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50" onClick={clearSearch}>
            Clear Search
          </Button>
        </div>
      </div>
      <div className="text-white-50 small mb-2">{rows.length} points</div>

      {/* Search mode toggle */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <ButtonGroup size="sm">
          <Button
            variant={workspace.searchMode === "filter" ? "success" : "dark"}
            className={workspace.searchMode !== "filter" ? "border border-light border-opacity-10 text-white-50" : ""}
            onClick={() => setWorkspace((p) => ({ ...p, searchMode: "filter" }))}
          >
            Filter (Workspace)
          </Button>
          <Button
            variant={workspace.searchMode === "global" ? "success" : "dark"}
            className={workspace.searchMode !== "global" ? "border border-light border-opacity-10 text-white-50" : ""}
            onClick={() => setWorkspace((p) => ({ ...p, searchMode: "global" }))}
          >
            Global Search (Scoped)
          </Button>
        </ButtonGroup>
      </div>

      {/* Filter mode: simple search input */}
      {workspace.searchMode === "filter" && (
        <div className="mb-3">
          <Form.Control
            size="sm"
            className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
            placeholder="Filter by equipment, point, value, status..."
            value={workspace.filterText ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setWorkspace((p) => ({ ...p, filterText: value }));
            }}
            style={{ minWidth: 260 }}
          />
        </div>
      )}

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
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              placeholder="Query within scope (example: *DA-T*, *Flow*, *Damper*)"
              value={workspace.globalQuery}
              onChange={(e) => {
                const value = e.target.value;
                setWorkspace((p) => ({ ...p, globalQuery: value }));
              }}
              onKeyDown={(e) => e.key === "Enter" && runGlobalSearch()}
              disabled={scopeEquipment.length === 0}
              style={{ minWidth: 280 }}
            />
            {scopeEquipment.length === 0 && (
              <div className="small text-white-50 mt-1">Add equipment to scope to run search</div>
            )}
            <Button size="sm" variant="success" className="ms-2" disabled={workspace.scopeEquipment.length === 0} onClick={runGlobalSearch}>
              Run
            </Button>

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
        className={`border border-light border-opacity-10 rounded overflow-hidden legion-workspace-dropzone ${dropActive[zone] ? "legion-workspace-dropzone--active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnTable}
        onKeyDown={handleTableKeyDown}
        onClick={(e) => e.currentTarget.focus()}
        style={{ outline: "none" }}
      >
        <Table responsive hover className="bg-primary border-0">
          <thead className="small">
            <tr>
              <th style={{ width: 40 }} />
              <th style={{ width: 200 }} className="text-white">Equipment</th>
              <th style={{ width: 180 }} className="text-white">Point</th>
              <th className="text-white">Value</th>
              <th style={{ width: 100 }} className="text-white">Status</th>
              <th style={{ width: 100 }} className="text-end text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-white-50 py-4">
                  {rows.length === 0
                    ? `${workspace.name} is empty — drag equipment or floors here to add points.`
                    : "No points match your search."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={selectedRowIds.includes(row.id) ? "table-active" : ""}
                  onClick={(e) => handleRowClick(e, row)}
                >
                  <td>
                    <Form.Check
                      type="checkbox"
                      checked={workspace.selectedRowIds.includes(row.id)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="text-white fw-semibold">{row.equipmentName}</td>
                  <td className="legion-workspace-point text-white">{row.pointId}</td>
                  <td className="text-white fw-semibold">{row.value}</td>
                  <td>
                    <StatusDotLabel
                      value={row.status || "Normal"}
                      kind="status"
                      dotOnly={["ok", "normal", "online"].includes((row.status || "").toLowerCase())}
                    />
                  </td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-light" className="border-opacity-10">
                      Command
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
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
              const pts = getPointsForEquipment(eq.id, eq.label, eq.status || "OK");
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
                  className="bg-dark border border-light border-opacity-10 text-white"
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

export default function Equipment() {
  const history = useHistory();
  useSite();
  const goToEquipment = (id) => history.push(`/legion/equipment/${id}`);

  const treeData = useMemo(
    () => {
      const floor1Equip = [
        { id: "ahu1", label: "AHU-1", status: "Normal", type: "equip" },
        ...Array.from({ length: 12 }, (_, i) => ({ id: 6100 + i + 1, label: `VAV-${i + 1}`, status: "Normal", type: "equip" })),
      ];
      const floor2Equip = [
        { id: "ahu2", label: "AHU-2", status: "Normal", type: "equip" },
        ...Array.from({ length: 8 }, (_, i) => ({ id: 6200 + i + 1, label: `VAV-${i + 13}`, status: "Normal", type: "equip" })),
      ];
      const floor3Equip = [
        { id: "ahu3", label: "AHU-3", status: "Normal", type: "equip" },
        ...Array.from({ length: 6 }, (_, i) => ({ id: 6300 + i + 1, label: `VAV-${i + 21}`, status: "Normal", type: "equip" })),
      ];
      return [
        { id: "plant", label: "Chiller Plant", sub: "Chiller", type: "group", children: [{ id: 9001, label: "CH-1", status: "Online", type: "equip" }] },
        { id: "f1", label: "Floor 1", sub: "AHU-1 • 12 VAVs", type: "floor", children: floor1Equip },
        { id: "f2", label: "Floor 2", sub: "AHU-2 • 8 VAVs", type: "floor", children: floor2Equip },
        { id: "f3", label: "Floor 3", sub: "AHU-3 • 6 VAVs", type: "floor", children: floor3Equip },
      ];
    },
    []
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
      goToEquipment(node.id);
    };

    const onDragStart = isDraggable ? (e) => handleDragStart(e, node, treeData) : undefined;

    return (
      <div>
        <EquipmentTreeRow level={level} active={isActive} onClick={onClick} isGroup={isExpandable} isOpen={isOpen} node={node} isLeaf={isLeaf} isDraggable={isDraggable} onDragStart={onDragStart} />
        {isExpandable && isOpen && node.children?.length ? (
          <div>
            {node.children.map((c) => (
              <TreeNode key={c.id} node={c} level={level + 1} />
            ))}
          </div>
        ) : null}
        {level === 0 ? <div className="border-top border-light border-opacity-10" style={{ height: 1 }} /> : null}
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
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h5 className="text-white fw-bold mb-0">Equipment</h5>
          <Button size="sm" variant="success">Filters</Button>
        </div>

        <Row className="g-3">
          <Col xs={12} lg={4} xl={3}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="p-0">
                <div className="px-3 pt-3 pb-2 d-flex align-items-center justify-content-between">
                  <div className="text-white fw-bold">Equipment</div>
                  <Button size="sm" variant="dark" className="border border-light border-opacity-10 text-white-50 py-0" style={{ height: 24 }}>
                    Collapse
                  </Button>
                </div>
                <div className="px-3 pb-2">
                  <Form.Control
                    size="sm"
                    placeholder="Search equipment..."
                    className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                  />
                </div>
                <div className="border-top border-light border-opacity-10" style={{ height: 1 }} />
                <div className="legion-equipment-tree pb-2">
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

                <WorkspacePanel
                  workspace={mainWorkspace}
                  setWorkspace={setMainWorkspace}
                  dropActive={dropActive}
                  setDropActive={setDropActive}
                  treeData={treeData}
                  handleDragStart={handleDragStart}
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
