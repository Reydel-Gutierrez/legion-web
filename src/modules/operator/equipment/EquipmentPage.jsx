import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useActiveDeployment } from "../../../hooks/useWorkingVersion";
import { activeReleaseDataToEquipmentTree } from "../../../lib/activeReleaseUtils";
import { Container, Button, Form, Table, Modal, Toast, Dropdown } from "@themesberg/react-bootstrap";
import { useHistory, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faLayerGroup,
  faSnowflake,
  faFolder,
  faFilter,
  faSearch,
  faBuilding,
  faPlus,
  faTrash,
  faPen,
  faChartLine,
  faToolbox,
  faBell,
  faSort,
  faSave,
  faSync,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import OperatorCommFreshnessLabel from "../../../components/legion/OperatorCommFreshnessLabel";
import { getEquipmentStatus } from "../../../lib/operator/statusUtils";
import { operatorRepository } from "../../../lib/data";
import { USE_HIERARCHY_API } from "../../../lib/data/config";
import { listRuntimeControllers } from "../../../lib/data/adapters/api/runtimeApiAdapter";
import { listPointsByEquipment } from "../../../lib/data/adapters/api/hierarchyApiAdapter";
import { getPointMappingsByEquipment } from "../../../lib/data/adapters/api/pointMappingApiAdapter";
import { getEquipmentControllerByEquipment } from "../../../lib/data/adapters/api/equipmentControllerApiAdapter";
import { applyHierarchyLiveToWorkspaceRows } from "../../../lib/operator/operatorWorkspaceHierarchyMerge";
import { resolveLivePointsSourceEquipmentId } from "../../../lib/operator/operatorWorkspaceLivePointsSource";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../../lib/data/siteApiResolution";
import { useSite } from "../../../app/providers/SiteProvider";
import {
  getCommandProfileForRows,
  getInitialCommandValue,
  formatCommandValueForDisplay,
  OperatorPointCommandField,
} from "./OperatorPointCommandField";
import { OperatorAlarmConfigModal } from "./OperatorAlarmConfigModal";
import {
  areRowsAlarmCompatible,
  BULK_ALARM_INCOMPATIBLE_MESSAGE,
} from "./operatorAlarmWorkspaceCompat";

// ---------------------------------------
// Operator equipment tree row — simple, clear hierarchy + offline pill
// ---------------------------------------
const NODE_ICONS = {
  group: faSnowflake,
  building: faBuilding,
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
  const runtimeComm = isLeaf && node.equipmentCommStatus != null ? node.equipmentCommStatus : null;
  const isOfflineOrWarn = runtimeComm
    ? runtimeComm === "OFFLINE"
    : ["offline", "unbound", "down", "disabled", "warn", "warning", "alarm", "fault"].includes(status);
  const showEngStatusPill = isLeaf && isOfflineOrWarn && !runtimeComm;

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
          runtimeComm ? (
            <OperatorCommFreshnessLabel status={runtimeComm} variant="tree" />
          ) : (
            <StatusDotLabel value={node.status || "Normal"} kind="status" dotOnly />
          )
        ) : (
          <FontAwesomeIcon icon={Icon} className="fa-sm" />
        )}
      </span>
      <span className="site-tree-name-wrap">
        <span className="site-tree-name">{node.label}</span>
        {!isLeaf && node.sub ? (
          <span className="site-tree-subtext text-white-50"> · {node.sub}</span>
        ) : null}
        {showEngStatusPill && (
          <span className="operator-equipment-status-pill" data-status={status}>
            {getStatusPillLabel(node.status)}
          </span>
        )}
        <span className="site-tree-type-badge">
          {node.type === "group"
            ? "GROUP"
            : node.type === "building"
              ? "BUILDING"
              : node.type === "floor"
                ? "FLOOR"
                : "EQUIPMENT"}
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

/** Workspace display when operator marks read-only points out of service */
const WORKSPACE_OUT_OF_SERVICE_LABEL = "Out Of Service";

function workspacePointDisplayValue(row) {
  if (row.operatorOutOfService) return WORKSPACE_OUT_OF_SERVICE_LABEL;
  return row.value;
}

const WORKSPACE_STORAGE_PREFIX = "legion-equipment-workspaces";
const WORKSPACE_LIBRARY_MAX = 30;
const DEFAULT_WORKSPACE_PROFILE_NAME = "Default";

function stripWorkspaceForPersist(workspace) {
  if (!workspace) return workspace;
  const { selectedRowIds, ...rest } = workspace;
  return { ...rest, selectedRowIds: [] };
}

function normalizeWorkspaceLibrary(raw) {
  if (!raw) return { lastSession: null, saved: [] };
  if (Array.isArray(raw.saved)) {
    return {
      lastSession: raw.lastSession || null,
      saved: raw.saved.filter((s) => s && s.id),
    };
  }
  if (raw.main || raw.secondary) {
    return {
      lastSession: {
        main: raw.main,
        secondary: raw.secondary,
        showSecondary: Boolean(raw.showSecondary),
      },
      saved: [],
    };
  }
  return { lastSession: null, saved: [] };
}

function loadWorkspaceLibrary(siteKey) {
  if (!siteKey || typeof window === "undefined") return { lastSession: null, saved: [] };
  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_STORAGE_PREFIX}:${siteKey}`);
    return normalizeWorkspaceLibrary(raw ? JSON.parse(raw) : null);
  } catch {
    return { lastSession: null, saved: [] };
  }
}

function persistWorkspaceLibrary(siteKey, library) {
  if (!siteKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${WORKSPACE_STORAGE_PREFIX}:${siteKey}`, JSON.stringify(library));
  } catch {
    /* ignore quota */
  }
}

function buildWorkspaceSnapshot(name, main, secondary, showSecondary) {
  return {
    id: `ws-${Date.now()}`,
    name: name || main?.name || "Workspace",
    savedAt: new Date().toISOString(),
    main: stripWorkspaceForPersist(main),
    secondary: secondary ? stripWorkspaceForPersist(secondary) : null,
    showSecondary: Boolean(showSecondary),
  };
}

function snapshotPointCount(snapshot) {
  const mainCount = snapshot?.main?.rows?.length || 0;
  const secondaryCount = snapshot?.showSecondary ? snapshot?.secondary?.rows?.length || 0 : 0;
  return mainCount + secondaryCount;
}

function formatWorkspaceSavedAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
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
  activeReleaseData,
  siteId,
  runtimeControllersList,
  nowTick,
  enterpriseLayout = false,
  autoRefresh = true,
  onAutoRefreshChange,
}) {
  const pointsOptions = useMemo(
    () => (activeReleaseData ? { activeRelease: activeReleaseData } : undefined),
    [activeReleaseData]
  );
  const tableRef = useRef(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [commandValue, setCommandValue] = useState("");
  const [serviceStateChoice, setServiceStateChoice] = useState("in_service");
  const [commandConfirmStep, setCommandConfirmStep] = useState(false);
  const [showToast, setShowToast] = useState({ show: false, msg: "" });
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchSelected, setGlobalSearchSelected] = useState(new Set());
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [alarmModalRows, setAlarmModalRows] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const zone = workspace.id;

  const rows = workspace.rows || [];
  const scopeEquipment = workspace.scopeEquipment || [];
  const selectedRowIds = workspace.selectedRowIds || [];
  const existingRowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const equipmentIdsKey = useMemo(
    () =>
      [...new Set(rows.map((r) => r.equipmentId).filter(Boolean))]
        .map(String)
        .sort()
        .join(","),
    [rows]
  );

  const [equipmentLiveBundles, setEquipmentLiveBundles] = useState(() => new Map());
  const loadLiveBundlesRef = useRef(async () => {});

  useEffect(() => {
    if (!USE_HIERARCHY_API || !isBackendSiteId(siteId) || !activeReleaseData || !equipmentIdsKey) {
      setEquipmentLiveBundles(new Map());
      loadLiveBundlesRef.current = async () => {};
      return undefined;
    }
    const eqIds = equipmentIdsKey.split(",").filter(Boolean);
    let cancelled = false;

    async function load() {
      const next = new Map();
      const rtList = Array.isArray(runtimeControllersList) ? runtimeControllersList : [];
      const dev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
      const matchedRtEq = new Set();
      await Promise.all(
        eqIds.map(async (eqId) => {
          try {
            const sourceEqId = resolveLivePointsSourceEquipmentId(eqId, activeReleaseData, rtList);
            const [dbPoints, mappings, ctrl] = await Promise.all([
              listPointsByEquipment(sourceEqId),
              getPointMappingsByEquipment(sourceEqId).catch(() => []),
              getEquipmentControllerByEquipment(eqId).catch(() => null),
            ]);
            const rt =
              rtList.find((c) => c && String(c.equipmentId) === String(eqId)) ||
              rtList.find((c) => c && String(c.equipmentId) === String(sourceEqId)) ||
              null;
            if (rt) matchedRtEq.add(String(eqId));
            if (dev) {
              // eslint-disable-next-line no-console
              console.debug("[operator live refresh]", {
                workspaceEquipmentId: eqId,
                pointsSourceEquipmentId: sourceEqId,
                pointsFetched: Array.isArray(dbPoints) ? dbPoints.length : 0,
                mappingCount: Array.isArray(mappings) ? mappings.length : 0,
                hasController: Boolean(ctrl),
                runtimeOnline: rt?.online,
                runtimeLastSeenAt: rt?.lastSeenAt,
                controllerStatus: ctrl?.status,
                controllerLastSeenAt: ctrl?.lastSeenAt,
              });
            }
            if (!cancelled) {
              next.set(eqId, {
                points: Array.isArray(dbPoints) ? dbPoints : [],
                mappings: Array.isArray(mappings) ? mappings : [],
                controller: ctrl,
                runtime: rt,
              });
            }
          } catch {
            /* keep previous bundle for this id */
          }
        })
      );
      if (dev) {
        // eslint-disable-next-line no-console
        console.debug("[operator live refresh summary]", {
          runtimeControllersListLength: rtList.length,
          workspaceEquipmentCount: eqIds.length,
          equipmentIdsWithRuntimeMatch: [...matchedRtEq],
          bundlesBuilt: next.size,
        });
      }
      if (!cancelled) setEquipmentLiveBundles(next);
    }

    loadLiveBundlesRef.current = load;
    load();
    let t = null;
    if (autoRefresh) {
      t = window.setInterval(() => {
        loadLiveBundlesRef.current();
      }, 5000);
    }
    return () => {
      cancelled = true;
      if (t != null) window.clearInterval(t);
      loadLiveBundlesRef.current = async () => {};
    };
  }, [siteId, activeReleaseData, equipmentIdsKey, runtimeControllersList, autoRefresh]);

  const hydratedRows = useMemo(() => {
    if (!USE_HIERARCHY_API || !isBackendSiteId(siteId) || !equipmentLiveBundles.size) {
      return rows;
    }
    return applyHierarchyLiveToWorkspaceRows(rows, activeReleaseData, equipmentLiveBundles, nowTick);
  }, [rows, siteId, activeReleaseData, equipmentLiveBundles, nowTick]);

  useEffect(() => {
    if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return;
    if (!USE_HIERARCHY_API || !isBackendSiteId(siteId)) return;
    const rtLen = Array.isArray(runtimeControllersList) ? runtimeControllersList.length : 0;
    const equipmentBundles = {};
    for (const [eqId, b] of equipmentLiveBundles.entries()) {
      equipmentBundles[eqId] = {
        dbPointsLoaded: Array.isArray(b.points) ? b.points.length : 0,
        mappingsLoaded: Array.isArray(b.mappings) ? b.mappings.length : 0,
        hasController: Boolean(b.controller),
        runtimeOnline: b.runtime?.online,
      };
    }
    // eslint-disable-next-line no-console
    console.debug("[operator workspace refresh cycle]", {
      runtimeControllersLoaded: rtLen,
      equipmentBundles,
      hydratedRowCount: hydratedRows.length,
      hydratedStatusCounts: {
        OK: hydratedRows.filter((r) => r.status === "OK").length,
        OFFLINE: hydratedRows.filter((r) => r.status === "OFFLINE").length,
        Unbound: hydratedRows.filter((r) => r.status === "Unbound").length,
      },
    });
  }, [siteId, runtimeControllersList, equipmentLiveBundles, hydratedRows]);

  useEffect(() => {
    if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return;
    if (!USE_HIERARCHY_API || !equipmentLiveBundles.size) return;
    const offline = hydratedRows.filter((r) => r.status === "OFFLINE");
    if (!offline.length) return;
    // eslint-disable-next-line no-console
    console.debug(
      "[operator workspace OFFLINE rows]",
      offline.map((r) => ({
        rowId: r.id,
        equipmentId: r.equipmentId,
        pointKey: r.pointKey || r.pointId,
        reason: r.__liveDebug ?? "(see merge / binding)",
      }))
    );
  }, [hydratedRows, equipmentLiveBundles]);

  // Filter workspace table rows (independent from scoped point search)
  const filteredRows = useMemo(() => {
    const q = String(workspace.filterText || "").trim().toLowerCase();
    if (!q) return hydratedRows;
    return hydratedRows.filter(
      (r) =>
        String(r.equipmentName || "").toLowerCase().includes(q) ||
        String(r.pointId || "").toLowerCase().includes(q) ||
        String(r.pointName || "").toLowerCase().includes(q) ||
        String(r.pointKey || "").toLowerCase().includes(q) ||
        String(r.pointDescription || "").toLowerCase().includes(q) ||
        String(r.pointAddress || "").toLowerCase().includes(q) ||
        String(r.pointPathKey || "").toLowerCase().includes(q) ||
        String(r.value || "").toLowerCase().includes(q) ||
        String(r.status || "").toLowerCase().includes(q) ||
        String(r.commFreshnessStatus || "").toLowerCase().includes(q)
    );
  }, [hydratedRows, workspace.filterText]);

  // Scoped search results — find points to add (independent from table filter)
  const globalSearchResultsMemo = useMemo(() => {
    const gq = String(workspace.globalQuery || "").trim();
    if (!gq) return [];
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
        (p) =>
          matches(p.pointId) ||
          matches(p.pointName) ||
          matches(p.pointKey) ||
          matches(p.pointDescription) ||
          matches(p.pointAddress) ||
          matches(p.pointPathKey) ||
          matches(p.units)
      );
      if (matched.length) results.push({ equipment: node, points: matched });
    }
    return results;
  }, [workspace.globalQuery, scopeEquipment, treeData, pointsOptions]);

  useEffect(() => {
    setGlobalSearchResults(globalSearchResultsMemo);
    setGlobalSearchSelected(new Set());
  }, [globalSearchResultsMemo]);

  const selectedCount = selectedRowIds.length;
  const selectedRows = useMemo(
    () => hydratedRows.filter((r) => selectedRowIds.includes(r.id)),
    [hydratedRows, selectedRowIds]
  );
  const commandModalProfile = getCommandProfileForRows(selectedRows);
  const alarmSelectionCompatible = useMemo(
    () => areRowsAlarmCompatible(selectedRows),
    [selectedRows]
  );
  const commandApplyDisabled =
    !commandConfirmStep &&
    commandModalProfile.mode === "typed" &&
    commandModalProfile.allOperational === false;

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

  const handleCheckboxToggle = useCallback(
    (e, row) => {
      e.stopPropagation();
      const idx = filteredRows.findIndex((r) => r.id === row.id);
      setWorkspace((prev) => {
        const ids = new Set(prev.selectedRowIds);
        if (ids.has(row.id)) ids.delete(row.id);
        else ids.add(row.id);
        return { ...prev, selectedRowIds: Array.from(ids) };
      });
      if (idx >= 0) setLastClickedIndex(idx);
    },
    [filteredRows, setWorkspace]
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

  const clearFilter = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, filterText: "" }));
  }, [setWorkspace]);

  const clearScopedSearch = useCallback(() => {
    setWorkspace((prev) => ({ ...prev, globalQuery: "" }));
    setShowGlobalResults(false);
    setGlobalSearchSelected(new Set());
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

  const syncServiceStateFromSelection = useCallback((sel) => {
    const p = getCommandProfileForRows(sel);
    if (p.readOnlySensorUi && sel.length) {
      setServiceStateChoice(sel.every((r) => r.operatorOutOfService) ? "out_of_service" : "in_service");
    } else {
      setServiceStateChoice("in_service");
    }
  }, []);

  const openCommandModal = useCallback(() => {
    const sel = selectedRows;
    const needBulkConfirm = selectedCount > 10;
    setCommandConfirmStep(needBulkConfirm);
    setShowCommandModal(true);
    if (!needBulkConfirm) {
      const p = getCommandProfileForRows(sel);
      setCommandValue(p.mode === "typed" ? getInitialCommandValue(sel, p) : "");
      syncServiceStateFromSelection(sel);
    } else {
      setCommandValue("");
      setServiceStateChoice("in_service");
    }
  }, [selectedCount, selectedRows, syncServiceStateFromSelection]);

  const handleCommandApply = useCallback(() => {
    if (commandConfirmStep) {
      setCommandConfirmStep(false);
      const sel = selectedRows;
      const p = getCommandProfileForRows(sel);
      setCommandValue(p.mode === "typed" ? getInitialCommandValue(sel, p) : "");
      syncServiceStateFromSelection(sel);
      return;
    }
    const profile = getCommandProfileForRows(selectedRows);
    const ids = selectedRowIds;

    if (profile.readOnlySensorUi) {
      const oos = serviceStateChoice === "out_of_service";
      setWorkspace((prev) => ({
        ...prev,
        rows: (prev.rows || []).map((r) =>
          ids.includes(r.id) ? { ...r, operatorOutOfService: oos } : r
        ),
      }));
      console.log("Command Selected (read-only / service state):", {
        points: selectedRows.map((r) => ({
          id: r.id,
          equipment: r.equipmentName,
          point: r.pointId,
          commandType: r.commandType,
        })),
        serviceState: serviceStateChoice,
        operatorOutOfService: oos,
      });
      setShowToast({
        show: true,
        msg:
          oos
            ? `Marked ${selectedRows.length} point(s) out of service (workspace).`
            : `Restored ${selectedRows.length} point(s) in service — showing live values.`,
      });
    } else {
      const commandSummary =
        profile.mode === "typed"
          ? formatCommandValueForDisplay(profile.commandType, commandValue, profile.commandConfig)
          : String(commandValue ?? "");
      console.log("Command Selected:", {
        points: selectedRows.map((r) => ({
          id: r.id,
          equipment: r.equipmentName,
          point: r.pointId,
          commandType: r.commandType,
        })),
        value: commandValue,
        summary: commandSummary,
      });
    }

    setShowCommandModal(false);
    setCommandConfirmStep(false);
    setCommandValue("");
    setServiceStateChoice("in_service");
    clearSelection();
  }, [
    commandConfirmStep,
    selectedRows,
    commandValue,
    clearSelection,
    rows,
    selectedRowIds,
    serviceStateChoice,
    setWorkspace,
    syncServiceStateFromSelection,
  ]);

  const scopeTrayDropActive = dropActive[`${zone}-scope`];

  const removeSingleRow = useCallback(
    (rowId) => {
      setWorkspace((prev) => ({
        ...prev,
        rows: (prev.rows || []).filter((r) => r.id !== rowId),
        selectedRowIds: (prev.selectedRowIds || []).filter((id) => id !== rowId),
      }));
    },
    [setWorkspace]
  );

  const openCommandForRow = useCallback(
    (row) => {
      setWorkspace((prev) => ({ ...prev, selectedRowIds: [row.id] }));
      setLastClickedIndex(filteredRows.findIndex((r) => r.id === row.id));
      setCommandConfirmStep(false);
      const p = getCommandProfileForRows([row]);
      setCommandValue(p.mode === "typed" ? getInitialCommandValue([row], p) : "");
      syncServiceStateFromSelection([row]);
      setShowCommandModal(true);
    },
    [setWorkspace, filteredRows, syncServiceStateFromSelection]
  );

  const selectAllRows = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      selectedRowIds: filteredRows.map((r) => r.id),
    }));
  }, [filteredRows, setWorkspace]);

  const handleManualRefresh = useCallback(() => {
    const run = loadLiveBundlesRef.current;
    if (typeof run === "function") run();
  }, []);

  const filterBar = (
    <div className={`legion-equipment-filter-bar ${enterpriseLayout ? "legion-equipment-filter-bar--enterprise" : ""}`}>
      <div className="legion-equipment-filter-bar__label">
        <FontAwesomeIcon icon={faFilter} className="me-2" aria-hidden />
        <span>Filter</span>
      </div>
      <Form.Control
        size="sm"
        className="legion-equipment-filter-bar__input legion-operator-log-field text-white border border-light border-opacity-10"
        placeholder="Filter workspace table by equipment, point, value, status..."
        value={workspace.filterText ?? ""}
        onChange={(e) => setWorkspace((p) => ({ ...p, filterText: e.target.value }))}
      />
      {workspace.filterText ? (
        <Button size="sm" variant="dark" className="legion-equipment-btn" onClick={clearFilter}>
          Clear
        </Button>
      ) : null}
      {!enterpriseLayout ? (
        <div className="legion-equipment-filter-bar__meta">
          <span className="workspace-toolbar__count">{rows.length}</span>
          <span className="workspace-toolbar__count-label">points</span>
        </div>
      ) : null}
    </div>
  );

  const scopedSearchPanel = (
    <div className={`legion-equipment-search-panel ${enterpriseLayout ? "legion-equipment-search-panel--enterprise" : ""}`}>
      <div className="legion-equipment-search-panel__header">
        <div className="legion-equipment-search-panel__label">
          <FontAwesomeIcon icon={faSearch} className="me-2" aria-hidden />
          <span>Search</span>
        </div>
      </div>
      <div className="small text-white-50 mb-2">
        Drag equipment into scope, search for points, then add them to this workspace.
      </div>
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
          <div className="text-white-50 small py-2">Drag equipment or floors here to define search scope</div>
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
              Clear scope
            </Button>
          </div>
        )}
      </div>
      <div className="legion-equipment-search-panel__query">
        <Form.Control
          size="sm"
          className="legion-operator-log-field text-white border border-light border-opacity-10"
          placeholder="Search points in scope (e.g. DA-T, Flow, Damper) — press Enter or Run"
          value={workspace.globalQuery}
          onChange={(e) => setWorkspace((p) => ({ ...p, globalQuery: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && runGlobalSearch()}
          disabled={scopeEquipment.length === 0}
        />
        <Button
          size="sm"
          variant="dark"
          className="legion-equipment-btn legion-equipment-btn--accent"
          disabled={scopeEquipment.length === 0}
          onClick={runGlobalSearch}
        >
          Run search
        </Button>
        {workspace.globalQuery ? (
          <Button size="sm" variant="dark" className="legion-equipment-btn" onClick={clearScopedSearch}>
            Clear
          </Button>
        ) : null}
      </div>
      {scopeEquipment.length === 0 && (
        <div className="small text-white-50 mt-1">Add equipment to scope before searching</div>
      )}
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
                        <span className="text-white">
                          {[p.pointKey, p.pointDescription || p.pointName].filter(Boolean).join(" — ") || p.pointId}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="d-flex gap-2 mt-2 pt-2 border-top border-light border-opacity-10">
                <Button size="sm" variant="success" onClick={addGlobalSelectedToWorkspace} disabled={globalSearchResults.length === 0}>
                  Add selected
                </Button>
                <Button size="sm" variant="outline-success" onClick={addAllGlobalResultsToWorkspace} disabled={globalSearchResults.length === 0}>
                  Add all results
                </Button>
                <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={() => setShowGlobalResults(false)}>
                  Dismiss results
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  const legacyToolbarActions = !enterpriseLayout ? (
    <div className="workspace-toolbar__right workspace-toolbar__right--compact mb-3">
      <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={clearTable}>
        Clear table
      </Button>
      <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={removeSelected} disabled={selectedCount === 0}>
        Remove selected
      </Button>
      <Button size="sm" variant="dark" className="workspace-table-action-btn" onClick={handleManualRefresh}>
        Refresh
      </Button>
    </div>
  ) : null;

  const tableColSpan = enterpriseLayout ? 7 : 7;

  const tableBlock = (
    <div
      ref={tableRef}
      tabIndex={0}
      role="grid"
      aria-label="Workspace points table"
      className={[
        "legion-workspace-dropzone legion-operator-log-table-wrap",
        enterpriseLayout ? "" : "border border-light border-opacity-10 rounded overflow-hidden",
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
        <Table hover className="legion-workspace-table mb-0">
          <thead>
            <tr>
              <th className="legion-workspace-th legion-workspace-th--check text-white" scope="col" />
              <th className="legion-workspace-th text-white" scope="col">Equipment</th>
              <th className="legion-workspace-th text-white" scope="col">Point</th>
              <th className="legion-workspace-th text-white" scope="col">{enterpriseLayout ? "Description" : "Point description"}</th>
              <th className="legion-workspace-th text-white" scope="col">Value</th>
              {!enterpriseLayout ? (
                <th className="legion-workspace-th legion-workspace-th--mapped text-white" scope="col">Mapped to</th>
              ) : null}
              <th className="legion-workspace-th legion-workspace-th--narrow text-white" scope="col">Status</th>
              {enterpriseLayout ? (
                <th className="legion-workspace-th legion-workspace-th--narrow text-white" scope="col">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColSpan}
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
                  <td
                    className="legion-workspace-td legion-workspace-td--check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Form.Check
                      type="checkbox"
                      checked={workspace.selectedRowIds.includes(row.id)}
                      onChange={(e) => handleCheckboxToggle(e, row)}
                    />
                  </td>
                  <td className="legion-workspace-td text-white fw-semibold">{row.equipmentName}</td>
                  <td className="legion-workspace-td legion-workspace-point text-white font-monospace">
                    <span className="legion-workspace-point-label">{row.pointKey || row.pointId}</span>
                  </td>
                  <td className="legion-workspace-td text-white" title={enterpriseLayout && row.mappedToLabel && row.mappedToLabel !== "—" ? `Mapped: ${row.mappedToLabel}` : undefined}>
                    {row.pointDescription || row.pointName || "—"}
                  </td>
                  <td className="legion-workspace-td text-white">
                    <span className={row.operatorOutOfService ? "text-white-50 fw-semibold" : undefined}>
                      {workspacePointDisplayValue(row)}
                    </span>
                  </td>
                  {!enterpriseLayout ? (
                    <td className="legion-workspace-td legion-workspace-td--mapped text-white-50 small">
                      <div
                        className="legion-workspace-mapped-scroll"
                        title={row.mappedToLabel && row.mappedToLabel !== "—" ? row.mappedToLabel : undefined}
                      >
                        {row.mappedToLabel ?? "—"}
                      </div>
                    </td>
                  ) : null}
                  <td className="legion-workspace-td legion-workspace-td--status">
                    {row.commFreshnessStatus ? (
                      <OperatorCommFreshnessLabel status={row.commFreshnessStatus} variant="table" />
                    ) : (
                      <StatusDotLabel
                        value={row.status || "Normal"}
                        kind="status"
                        dotOnly={["ok", "normal", "online"].includes((row.status || "").toLowerCase())}
                      />
                    )}
                  </td>
                  {enterpriseLayout ? (
                    <td className="legion-workspace-td">
                      <div className="legion-equipment-row-actions">
                        <Link
                          to={Routes.LegionTrends.path}
                          className="legion-equipment-row-action"
                          title="View trends"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FontAwesomeIcon icon={faChartLine} />
                        </Link>
                        <button
                          type="button"
                          className="legion-equipment-row-action"
                          title="Command point"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCommandForRow(row);
                          }}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button
                          type="button"
                          className="legion-equipment-row-action legion-equipment-row-action--danger"
                          title="Remove from workspace"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSingleRow(row.id);
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className={`workspace-panel ${enterpriseLayout ? "workspace-panel--enterprise" : ""}`}>
      {!enterpriseLayout ? (
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="text-white fw-semibold">{workspace.name}</span>
            {showRemove && onRemove ? (
              <Button size="sm" variant="outline-secondary" className="text-white-50 py-0 px-1" onClick={onRemove}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {enterpriseLayout ? (
        <>
          <div className="legion-equipment-active-toolbar">
            <div className="legion-equipment-active-toolbar__left d-flex align-items-center gap-2">
              <Dropdown align="end">
                <Dropdown.Toggle
                  size="sm"
                  variant="dark"
                  className="legion-equipment-btn"
                  id={`workspace-menu-${zone}`}
                >
                  <FontAwesomeIcon icon={faToolbox} className="me-1" />
                  Tools
                </Dropdown.Toggle>
                <Dropdown.Menu className="legion-equipment-tools-menu">
                  <Dropdown.Header className="legion-equipment-tools-menu__header">Find</Dropdown.Header>
                  <Dropdown.Item
                    className={showSearchPanel ? "active" : ""}
                    onClick={() => setShowSearchPanel((v) => !v)}
                  >
                    <FontAwesomeIcon icon={faSearch} className="legion-equipment-tools-menu__icon" />
                    <span>Search points</span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    className={showFilterPanel ? "active" : ""}
                    onClick={() => setShowFilterPanel((v) => !v)}
                  >
                    <FontAwesomeIcon icon={faFilter} className="legion-equipment-tools-menu__icon" />
                    <span>Filter table</span>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Header className="legion-equipment-tools-menu__header">Actions</Dropdown.Header>
                  <Dropdown.Item
                    disabled={selectedCount === 0 || !alarmSelectionCompatible}
                    title={
                      selectedCount > 0 && !alarmSelectionCompatible
                        ? BULK_ALARM_INCOMPATIBLE_MESSAGE
                        : selectedCount === 0
                          ? "Select at least one point"
                          : "Create alarm on selected points"
                    }
                    onClick={() => {
                      if (selectedCount === 0 || !alarmSelectionCompatible) return;
                      setAlarmModalRows(selectedRows);
                      setShowAlarmModal(true);
                    }}
                  >
                    <FontAwesomeIcon icon={faBell} className="legion-equipment-tools-menu__icon" />
                    <span>Create alarm</span>
                  </Dropdown.Item>
                  {showRemove && onRemove ? (
                    <>
                      <Dropdown.Divider />
                      <Dropdown.Item className="legion-equipment-tools-menu__item--danger" onClick={onRemove}>
                        <FontAwesomeIcon icon={faTrash} className="legion-equipment-tools-menu__icon" />
                        <span>Remove workspace</span>
                      </Dropdown.Item>
                    </>
                  ) : null}
                </Dropdown.Menu>
              </Dropdown>
              <Button
                size="sm"
                variant="dark"
                className="legion-equipment-btn"
                onClick={openCommandModal}
                disabled={selectedCount === 0}
                title={selectedCount === 0 ? "Select at least one point" : "Command selected points"}
              >
                <FontAwesomeIcon icon={faPen} className="me-1" />
                Command
              </Button>
            </div>
            <div className="legion-equipment-active-toolbar__right">
              <Button
                size="sm"
                variant="dark"
                className="legion-equipment-btn"
                onClick={clearTable}
                disabled={rows.length === 0}
              >
                Clear table
              </Button>
              <Button
                size="sm"
                variant="dark"
                className="legion-equipment-btn"
                onClick={selectAllRows}
                disabled={filteredRows.length === 0}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="dark"
                className="legion-equipment-btn legion-equipment-btn--icon"
                onClick={removeSelected}
                disabled={selectedCount === 0}
                title="Remove selected"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </div>
          </div>
          {showFilterPanel ? filterBar : null}
          {showSearchPanel ? scopedSearchPanel : null}
          <div className="legion-equipment-table-area">{tableBlock}</div>
          <div className="legion-equipment-table-footer">
            <span>
              {filteredRows.length} point{filteredRows.length !== 1 ? "s" : ""}
              {workspace.filterText ? ` (filtered from ${rows.length})` : ""}
            </span>
            <div className="legion-equipment-auto-refresh d-flex align-items-center gap-2">
              <Button
                size="sm"
                variant="dark"
                className="legion-equipment-btn legion-equipment-btn--icon"
                onClick={handleManualRefresh}
                title="Refresh now"
              >
                <FontAwesomeIcon icon={faSync} />
              </Button>
              <Form.Check
                type="switch"
                id={`auto-refresh-${zone}`}
                className="legion-equipment-auto-refresh"
                label="Auto-refresh"
                checked={autoRefresh}
                onChange={(e) => {
                  if (onAutoRefreshChange) onAutoRefreshChange(e.target.checked);
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {filterBar}
          {scopedSearchPanel}
          {legacyToolbarActions}
          {tableBlock}
        </>
      )}

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
          setCommandValue("");
          setServiceStateChoice("in_service");
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
                    {r.equipmentName} — {r.pointKey || r.pointId}
                    {(r.pointDescription || r.pointName) && r.pointKey !== (r.pointDescription || r.pointName) ? (
                      <span className="text-white-50"> ({r.pointDescription || r.pointName})</span>
                    ) : null}
                  </div>
                ))}
                {selectedRows.length > 15 && <div className="small text-white-50">... and {selectedRows.length - 15} more</div>}
              </div>
              <Form.Group>
                <Form.Label className="text-white small">
                  {commandModalProfile.readOnlySensorUi
                    ? "Service state"
                    : commandModalProfile.mode === "typed" && commandModalProfile.commandType === "percentage"
                      ? "Command (%)"
                      : commandModalProfile.mode === "typed" && commandModalProfile.commandType === "numeric"
                        ? "Command (numeric)"
                        : commandModalProfile.mode === "typed" && commandModalProfile.commandType === "enum"
                          ? "Command (select state)"
                          : "Command"}
                </Form.Label>
                {commandModalProfile.mode === "mixed" && (
                  <p className="small text-warning mb-2">
                    Selected points use different command types ({commandModalProfile.types?.join(", ") || ""}). Enter a raw
                    value below, or select points of the same type (e.g. all percentages or all enums).
                  </p>
                )}
                {commandModalProfile.mode === "generic" && commandModalProfile.hint && (
                  <p className="small text-white-50 mb-2">{commandModalProfile.hint}</p>
                )}
                {commandModalProfile.mode === "typed" && commandApplyDisabled && (
                  <p className="small text-warning mb-2">
                    One or more selected points are offline, unbound, or not OK. Command input is disabled.
                  </p>
                )}
                {commandModalProfile.readOnlySensorUi ? (
                  <div className="legion-service-state-options" role="radiogroup" aria-label="Service state">
                    <button
                      type="button"
                      className={`legion-service-state-option ${
                        serviceStateChoice === "in_service" ? "legion-service-state-option--active" : ""
                      }`}
                      onClick={() => setServiceStateChoice("in_service")}
                      role="radio"
                      aria-checked={serviceStateChoice === "in_service"}
                    >
                      <div className="legion-service-state-option__title">In service</div>
                      <p className="legion-service-state-option__hint">
                        Restore normal operation and show the live value from the device in this workspace.
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`legion-service-state-option ${
                        serviceStateChoice === "out_of_service" ? "legion-service-state-option--active" : ""
                      }`}
                      onClick={() => setServiceStateChoice("out_of_service")}
                      role="radio"
                      aria-checked={serviceStateChoice === "out_of_service"}
                    >
                      <div className="legion-service-state-option__title">Out of service</div>
                      <p className="legion-service-state-option__hint">
                        Mark the point out of service for operations. The value column will show &quot;Out Of Service&quot;
                        instead of the live reading.
                      </p>
                    </button>
                  </div>
                ) : commandModalProfile.mode === "typed" ? (
                  <OperatorPointCommandField
                    commandType={commandModalProfile.commandType}
                    commandConfig={commandModalProfile.commandConfig}
                    value={commandValue}
                    onChange={setCommandValue}
                    disabled={commandApplyDisabled}
                    idSuffix={zone}
                  />
                ) : (
                  <Form.Control
                    className="bg-dark border border-light border-opacity-10 text-white"
                    placeholder={
                      commandModalProfile.mode === "empty"
                        ? "Enter command…"
                        : commandModalProfile.mode === "mixed" || commandModalProfile.mode === "generic"
                          ? "Enter command (raw)…"
                          : "Enter command…"
                    }
                    value={typeof commandValue === "string" ? commandValue : String(commandValue ?? "")}
                    onChange={(e) => setCommandValue(e.target.value)}
                  />
                )}
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button
            variant="secondary"
            onClick={() => {
              setShowCommandModal(false);
              setCommandConfirmStep(false);
              setCommandValue("");
              setServiceStateChoice("in_service");
            }}
          >
            Cancel
          </Button>
          <Button variant="success" onClick={handleCommandApply} disabled={commandApplyDisabled}>
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

      <OperatorAlarmConfigModal
        show={showAlarmModal}
        onHide={() => {
          setShowAlarmModal(false);
          setAlarmModalRows(null);
        }}
        siteId={siteId}
        rows={alarmModalRows ?? undefined}
        activeReleaseData={activeReleaseData}
      />
    </div>
  );
}

export default function EquipmentPage() {
  const history = useHistory();
  const { siteId, apiSites } = useSite();
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  /** Match useActiveRelease: sidebar may hold site name until coerced to UUID. */
  const apiSiteId = useMemo(
    () => coerceSiteKeyToApiId(siteId, apiSites) ?? (isBackendSiteId(siteId) ? siteId : null),
    [siteId, apiSites]
  );
  const { deployment, loading: releaseLoading, error: releaseError } = useActiveDeployment();
  const activeReleaseData = deployment;
  const goToEquipment = (node) =>
    history.push(`/legion/equipment/${node.instanceNumber ? encodeURIComponent(node.instanceNumber) : node.id}`);

  const [runtimeByEquipmentId, setRuntimeByEquipmentId] = useState(() => new Map());
  const [runtimeControllersList, setRuntimeControllersList] = useState([]);

  useEffect(() => {
    if (!USE_HIERARCHY_API) return undefined;
    let cancelled = false;
    function tick() {
      listRuntimeControllers()
        .then((rows) => {
          if (cancelled) return;
          const list = Array.isArray(rows) ? rows : [];
          setRuntimeControllersList(list);
          const m = new Map();
          for (const r of list) {
            if (r?.equipmentId) m.set(String(r.equipmentId), r);
          }
          if (activeReleaseData?.equipment?.length) {
            for (const eq of activeReleaseData.equipment) {
              const wid = String(eq.id);
              const src = resolveLivePointsSourceEquipmentId(wid, activeReleaseData, list);
              if (src !== wid) {
                const alt = m.get(src);
                if (alt) m.set(wid, alt);
              }
            }
          }
          setRuntimeByEquipmentId(m);
        })
        .catch(() => {});
    }
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeReleaseData]);

  const treeData = useMemo(() => {
    const base = activeReleaseDataToEquipmentTree(activeReleaseData);
    if (!runtimeByEquipmentId.size) return base;
    const patch = (nodes) =>
      (nodes || []).map((n) => {
        if (n.children?.length) {
          return { ...n, children: patch(n.children) };
        }
        if (n.type === "equip" && runtimeByEquipmentId.has(String(n.id))) {
          const r = runtimeByEquipmentId.get(String(n.id));
          const equipmentCommStatus =
            r?.online === false
              ? "OFFLINE"
              : getEquipmentStatus({
                  lastSeenAt: r?.lastSeenAt,
                  pollRateMs: r?.pollRateMs,
                  now: nowTick,
                });
          return {
            ...n,
            equipmentCommStatus,
          };
        }
        return n;
      });
    return patch(base);
  }, [activeReleaseData, runtimeByEquipmentId, nowTick]);

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
    filterText: "",
    globalQuery: "",
    scopeEquipment: [],
    selectedRowIds: [],
  });

  const storageKey = apiSiteId || siteId;

  const hydrateWorkspace = useCallback(
    (id, fallbackName, data) => ({
      ...initialWorkspace(id, fallbackName),
      ...(data || {}),
      id,
      selectedRowIds: [],
    }),
    []
  );

  const [workspaceProfileName, setWorkspaceProfileName] = useState(() => {
    const session = loadWorkspaceLibrary(storageKey).lastSession;
    return session?.profileName?.trim() || null;
  });
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false);
  const [saveWorkspaceNameInput, setSaveWorkspaceNameInput] = useState("");

  const workspaceDisplayName = workspaceProfileName?.trim() || DEFAULT_WORKSPACE_PROFILE_NAME;

  const [mainWorkspace, setMainWorkspace] = useState(() => {
    const session = loadWorkspaceLibrary(storageKey).lastSession;
    return session?.main
      ? { ...initialWorkspace("main", "Main Workspace"), ...session.main, id: "main", selectedRowIds: [] }
      : initialWorkspace("main", "Main Workspace");
  });
  const [savedWorkspaces, setSavedWorkspaces] = useState(() => loadWorkspaceLibrary(storageKey).saved);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [treeSortAsc, setTreeSortAsc] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [saveNotice, setSaveNotice] = useState("");

  const openSaveWorkspaceModal = useCallback(() => {
    setSaveWorkspaceNameInput(workspaceProfileName?.trim() || "");
    setShowSaveWorkspaceModal(true);
  }, [workspaceProfileName]);

  const saveWorkspaces = useCallback(() => {
    const snapshotName = saveWorkspaceNameInput.trim();
    if (!snapshotName) return;
    const snapshot = buildWorkspaceSnapshot(snapshotName, mainWorkspace, null, false);
    const nextSaved = [...savedWorkspaces];
    const existingIdx = nextSaved.findIndex((s) => s.name === snapshotName);
    if (existingIdx >= 0) nextSaved[existingIdx] = { ...snapshot, id: nextSaved[existingIdx].id };
    else nextSaved.unshift(snapshot);
    const trimmed = nextSaved.slice(0, WORKSPACE_LIBRARY_MAX);
    setSavedWorkspaces(trimmed);
    setWorkspaceProfileName(snapshotName);
    persistWorkspaceLibrary(storageKey, {
      lastSession: {
        profileName: snapshotName,
        main: stripWorkspaceForPersist(mainWorkspace),
      },
      saved: trimmed,
    });
    setShowSaveWorkspaceModal(false);
    setSaveNotice(`Saved workspace "${snapshotName}"`);
    window.setTimeout(() => setSaveNotice(""), 2500);
  }, [storageKey, mainWorkspace, savedWorkspaces, saveWorkspaceNameInput]);

  const loadSavedWorkspace = useCallback(
    (snapshot) => {
      if (!snapshot) return;
      const profileName = snapshot.name?.trim() || null;
      setWorkspaceProfileName(profileName);
      setMainWorkspace(
        hydrateWorkspace("main", snapshot.main?.name || "Main Workspace", snapshot.main)
      );
      persistWorkspaceLibrary(storageKey, {
        lastSession: {
          profileName,
          main: stripWorkspaceForPersist(snapshot.main),
        },
        saved: savedWorkspaces,
      });
      setSaveNotice(`Loaded workspace "${snapshot.name}"`);
      window.setTimeout(() => setSaveNotice(""), 2500);
    },
    [storageKey, savedWorkspaces, hydrateWorkspace]
  );

  const createNewWorkspace = useCallback(() => {
    const fresh = initialWorkspace("main", "Main Workspace");
    setMainWorkspace(fresh);
    setWorkspaceProfileName(null);
    persistWorkspaceLibrary(storageKey, {
      lastSession: {
        profileName: null,
        main: stripWorkspaceForPersist(fresh),
      },
      saved: savedWorkspaces,
    });
    setSaveNotice("New workspace ready — save when you want to keep it");
    window.setTimeout(() => setSaveNotice(""), 2500);
  }, [storageKey, savedWorkspaces]);

  const equipmentDeviceCount = useMemo(
    () => flattenEquipmentNodes(filteredTree).length,
    [filteredTree]
  );

  const sortedFilteredTree = useMemo(() => {
    if (!treeSortAsc) return filteredTree;
    const sortNodes = (nodes) =>
      [...(nodes || [])]
        .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" }))
        .map((n) => (n.children?.length ? { ...n, children: sortNodes(n.children) } : n));
    return sortNodes(filteredTree);
  }, [filteredTree, treeSortAsc]);

  const handleDragStart = useCallback((e, node, tree) => {
    const isMultiEquip = node.type === "floor" || node.type === "building";
    const equipment = isMultiEquip ? getEquipmentUnderNode(node) : [node];
    e.dataTransfer.setData("text/plain", JSON.stringify({
      type: isMultiEquip ? "floor" : "equip",
      id: node.id,
      label: node.label,
      status: node.status || "OK",
      equipment,
    }));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const TreeNode = ({ node, level = 0 }) => {
    const isGroup = node.type === "group";
    const isBuilding = node.type === "building";
    const isFloor = node.type === "floor";
    const isLeaf = node.type === "equip";
    const isExpandable = isGroup || isBuilding || isFloor;
    const isOpen = !!openMap[node.id];
    const isActive = selectedEquipId === node.id;
    const isDraggable = isLeaf || isFloor || isBuilding;

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
    <Container fluid className="px-0 legion-equipment-page-shell">
      <div className="legion-equipment-page-shell__hero px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="legion-equipment-page legion-equipment-page--enterprise px-3 px-md-4">
        {releaseLoading && !activeReleaseData && (
          <div className="text-white-50 small mb-2">Loading equipment tree from server…</div>
        )}
        {releaseError ? (
          <div className="alert alert-danger py-2 small mb-3" role="alert">
            {releaseError}
          </div>
        ) : null}
        {saveNotice ? (
          <div className="alert alert-success py-2 small mb-2" role="status">
            {saveNotice}
          </div>
        ) : null}

        <div className="legion-equipment-enterprise-wrap">
          {treeCollapsed ? (
            <button
              type="button"
              className="legion-equipment-tree-expand"
              onClick={() => setTreeCollapsed(false)}
              aria-label="Expand equipment tree"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          ) : null}

          <div className="legion-equipment-enterprise">
            <aside className={`legion-equipment-tree-panel ${treeCollapsed ? "legion-equipment-tree-panel--collapsed" : ""}`}>
              <div className="legion-equipment-panel-header">
                <h2 className="legion-equipment-panel-title">Equipment Tree</h2>
                <Button
                  size="sm"
                  variant="dark"
                  className="legion-equipment-btn"
                  onClick={() => setTreeCollapsed(true)}
                >
                  Collapse
                </Button>
              </div>
              <div className="legion-equipment-panel-body">
                <div className="legion-equipment-tree-toolbar">
                  <Form.Control
                    size="sm"
                    placeholder="Search equipment..."
                    className="legion-equipment-tree-toolbar__input legion-operator-log-field text-white border border-light border-opacity-10"
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="dark"
                    className={`legion-equipment-tree-toolbar__btn ${treeSearch ? "legion-equipment-tree-toolbar__btn--active" : ""}`}
                    title="Filter tree"
                  >
                    <FontAwesomeIcon icon={faFilter} />
                  </Button>
                  <Button
                    size="sm"
                    variant="dark"
                    className={`legion-equipment-tree-toolbar__btn ${treeSortAsc ? "legion-equipment-tree-toolbar__btn--active" : ""}`}
                    title="Sort alphabetically"
                    onClick={() => setTreeSortAsc((v) => !v)}
                  >
                    <FontAwesomeIcon icon={faSort} />
                  </Button>
                </div>
                <div className="legion-equipment-tree-scroll">
                  <div className="legion-equipment-tree site-builder-tree operator-equipment-tree">
                    {sortedFilteredTree.map((n) => (
                      <TreeNode key={n.id} node={n} level={0} />
                    ))}
                    {sortedFilteredTree.length === 0 ? (
                      <div className="px-3 py-3 text-white-50 small">No matches.</div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="legion-equipment-panel-footer">
                <span>{treeSearch ? "Filtered equipment" : "Showing all equipment"}</span>
                <span>{equipmentDeviceCount} device{equipmentDeviceCount !== 1 ? "s" : ""}</span>
              </div>
            </aside>

            <section className="legion-equipment-workspace-panel">
              <div className="legion-equipment-workspace-optional">
                <div className="legion-equipment-panel-header">
                  <h2 className="legion-equipment-panel-title">
                    Workspace
                    <span className="legion-equipment-workspace-profile-name">· {workspaceDisplayName}</span>
                  </h2>
                  <div className="legion-equipment-workspace-header-actions">
                    <Button
                      size="sm"
                      variant="dark"
                      className="legion-equipment-btn"
                      onClick={openSaveWorkspaceModal}
                      title="Save current workspace layout"
                    >
                      <FontAwesomeIcon icon={faSave} className="me-1" />
                      Save Workspace
                    </Button>
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        size="sm"
                        variant="dark"
                        className="legion-equipment-btn"
                        id="load-workspace-menu"
                      >
                        <FontAwesomeIcon icon={faFolderOpen} className="me-1" />
                        Load Workspace
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="bg-primary border border-light border-opacity-10 legion-equipment-load-workspace-menu">
                        {savedWorkspaces.length === 0 ? (
                          <Dropdown.Item disabled className="text-white-50">
                            No saved workspaces yet
                          </Dropdown.Item>
                        ) : (
                          savedWorkspaces.map((snapshot) => (
                            <Dropdown.Item
                              key={snapshot.id}
                              className="text-white legion-equipment-load-workspace-item"
                              onClick={() => loadSavedWorkspace(snapshot)}
                            >
                              <span className="legion-equipment-load-workspace-item__name">{snapshot.name}</span>
                              <span className="legion-equipment-load-workspace-item__meta">
                                {snapshotPointCount(snapshot)} pts
                                {snapshot.savedAt ? ` · ${formatWorkspaceSavedAt(snapshot.savedAt)}` : ""}
                              </span>
                            </Dropdown.Item>
                          ))
                        )}
                      </Dropdown.Menu>
                    </Dropdown>
                    <Button
                      size="sm"
                      variant="dark"
                      className="legion-equipment-btn legion-equipment-btn--accent"
                      onClick={createNewWorkspace}
                      title="Start a new empty workspace"
                    >
                      <FontAwesomeIcon icon={faPlus} className="me-1" />
                      New Workspace
                    </Button>
                  </div>
                </div>
              </div>

              <div className="legion-equipment-workspace-active">
                <WorkspacePanel
                  workspace={mainWorkspace}
                  setWorkspace={setMainWorkspace}
                  dropActive={dropActive}
                  setDropActive={setDropActive}
                  treeData={treeData}
                  handleDragStart={handleDragStart}
                  activeReleaseData={activeReleaseData}
                  siteId={apiSiteId || siteId}
                  runtimeControllersList={runtimeControllersList}
                  nowTick={nowTick}
                  enterpriseLayout
                  autoRefresh={autoRefresh}
                  onAutoRefreshChange={setAutoRefresh}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      <Modal
        centered
        show={showSaveWorkspaceModal}
        onHide={() => setShowSaveWorkspaceModal(false)}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Save Workspace</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="text-white-50 small">Workspace name</Form.Label>
            <Form.Control
              className="legion-operator-log-field text-white border border-light border-opacity-10"
              placeholder="e.g. HVAC Overview, Morning Rounds"
              value={saveWorkspaceNameInput}
              onChange={(e) => setSaveWorkspaceNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveWorkspaceNameInput.trim() && saveWorkspaces()}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={() => setShowSaveWorkspaceModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={saveWorkspaces} disabled={!saveWorkspaceNameInput.trim()}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
