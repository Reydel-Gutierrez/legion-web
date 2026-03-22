import { useCallback, useEffect, useMemo, useState } from "react";
import { operatorRepository } from "../../../lib/data";
import {
  createDefaultTrendDefinition,
  createDefaultTrendAssignment,
  cloneTrendDefinition,
  newTrendId,
} from "./trendDomain";
import {
  loadTrendDataStore,
  persistTrendDataStore,
  getAssignmentsForAsset,
  getDefinitionById,
  resolveAssignment,
  rememberSelectedAssignment,
  readSelectedAssignment,
  markDefaultAssignment,
} from "./trendStore";
import {
  normalizeDefinitionForTemplateStore,
  resolvePointIdsForCatalog,
  resolveReferenceBandsForCatalog,
  serializeDefinitionForCompare,
  serializeTemplateDefinitionSnapshot,
} from "./trendPointIds";


const pad2 = (n) => String(n).padStart(2, "0");

function fmtExact(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yy = String(d.getFullYear()).slice(-2);
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${m}/${day}/${yy} ${hh}:${mm}`;
}

/** @param {import("./trendStore").TrendDataStore} store @param {string} assetId */
function sortedAssignmentsForAsset(store, assetId) {
  const list = getAssignmentsForAsset(store, assetId);
  return [...list].sort((a, b) => {
    const da = getDefinitionById(store, a.trendDefinitionId);
    const db = getDefinitionById(store, b.trendDefinitionId);
    return (da?.name || "").localeCompare(db?.name || "");
  });
}

/** Unique point slugs across all equipment on the site — for template-only editor (no asset selected). */
function buildSiteSlugCatalog(site, equipmentList) {
  const bySlug = new Map();
  equipmentList.forEach((eq) => {
    operatorRepository.getTrendPointCatalog(site, eq.id).forEach((c) => {
      const slug = c.id.includes("::") ? c.id.split("::").pop() : c.id;
      if (!slug || bySlug.has(slug)) return;
      const short = (c.label || "").split("·").pop()?.trim() || slug;
      bySlug.set(slug, {
        id: slug,
        label: `${short} (${slug})`,
        unit: c.unit,
      });
    });
  });
  return Array.from(bySlug.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function useTrendWorkspace(site) {
  const equipmentList = useMemo(() => operatorRepository.getTrendEquipmentList(site), [site]);
  const groups = useMemo(() => operatorRepository.getTrendEquipmentGroups(site), [site]);

  const [store, setStore] = useState(() => loadTrendDataStore(site));
  const [equipSearch, setEquipSearch] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [definition, setDefinition] = useState(() => createDefaultTrendDefinition());
  const [modal, setModal] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [templateEditorTemplateId, setTemplateEditorTemplateId] = useState("");

  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    setStore(loadTrendDataStore(site));
    setSelectedEquipmentId("");
    setSelectedAssignmentId("");
    setTemplateEditorTemplateId("");
    setDefinition(createDefaultTrendDefinition());
    setEquipSearch("");
  }, [site]);

  const persist = useCallback(
    (next) => {
      setStore(next);
      persistTrendDataStore(site, next);
    },
    [site]
  );

  const filteredEquipment = useMemo(() => {
    const q = equipSearch.trim().toLowerCase();
    if (!q) return equipmentList;
    return equipmentList.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        (e.name || "").toLowerCase().includes(q) ||
        (e.type || "").toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        (e.floorName || "").toLowerCase().includes(q) ||
        (e.buildingName || "").toLowerCase().includes(q)
    );
  }, [equipmentList, equipSearch]);

  useEffect(() => {
    if (!equipmentList.length) {
      if (selectedEquipmentId) setSelectedEquipmentId("");
      return;
    }
    if (selectedEquipmentId && !equipmentList.some((e) => e.id === selectedEquipmentId)) {
      setSelectedEquipmentId("");
    }
  }, [equipmentList, selectedEquipmentId]);

  const selectedEquipment = useMemo(
    () => equipmentList.find((e) => e.id === selectedEquipmentId) || null,
    [equipmentList, selectedEquipmentId]
  );

  const assignmentsForAsset = useMemo(
    () => (selectedEquipmentId ? sortedAssignmentsForAsset(store, selectedEquipmentId) : []),
    [store, selectedEquipmentId]
  );

  const slugCatalog = useMemo(() => buildSiteSlugCatalog(site, equipmentList), [site, equipmentList]);

  /** Pick default assignment when asset or store changes (not when user switches tab — that updates session). */
  useEffect(() => {
    if (templateEditorTemplateId) {
      setSelectedAssignmentId("");
      return;
    }
    if (!selectedEquipmentId) {
      setSelectedAssignmentId("");
      return;
    }
    const list = sortedAssignmentsForAsset(store, selectedEquipmentId);
    if (!list.length) {
      setSelectedAssignmentId("");
      return;
    }
    const sess = readSelectedAssignment(site, selectedEquipmentId);
    const pick = list.find((a) => a.id === sess) || list.find((a) => a.isDefault) || list[0];
    setSelectedAssignmentId(pick.id);
  }, [templateEditorTemplateId, selectedEquipmentId, store, site]);

  const activeAssignment = useMemo(() => {
    if (!selectedAssignmentId) return null;
    return resolveAssignment(store, selectedAssignmentId)?.assignment || null;
  }, [store, selectedAssignmentId]);

  const catalog = useMemo(() => {
    if (templateEditorTemplateId) return slugCatalog;
    if (!selectedEquipmentId) return [];
    return operatorRepository.getTrendPointCatalog(site, selectedEquipmentId);
  }, [templateEditorTemplateId, slugCatalog, site, selectedEquipmentId]);

  useEffect(() => {
    if (templateEditorTemplateId) {
      const def = getDefinitionById(store, templateEditorTemplateId);
      if (!def?.isTemplate) {
        setTemplateEditorTemplateId("");
        return;
      }
      const base = createDefaultTrendDefinition();
      setDefinition({
        ...def,
        pointIds: [...(def.pointIds || [])],
        referenceBands: Array.isArray(def.referenceBands) ? def.referenceBands.map((b) => ({ ...b })) : [],
        overlaySettings: { ...base.overlaySettings, ...def.overlaySettings },
      });
      return;
    }
    if (!selectedAssignmentId) {
      setDefinition(createDefaultTrendDefinition());
      return;
    }
    const r = resolveAssignment(store, selectedAssignmentId);
    if (!r) {
      setDefinition(createDefaultTrendDefinition());
      return;
    }
    const def = r.definition;
    const base = createDefaultTrendDefinition();
    const mappedPointIds = catalog.length
      ? resolvePointIdsForCatalog(def.pointIds || [], catalog, selectedEquipmentId)
      : [...(def.pointIds || [])];
    const mappedBands = catalog.length
      ? resolveReferenceBandsForCatalog(def.referenceBands || [], catalog, selectedEquipmentId)
      : Array.isArray(def.referenceBands)
        ? def.referenceBands.map((b) => ({ ...b }))
        : [];
    setDefinition({
      ...def,
      pointIds: mappedPointIds,
      referenceBands: mappedBands,
      overlaySettings: { ...base.overlaySettings, ...def.overlaySettings },
    });
  }, [templateEditorTemplateId, selectedAssignmentId, store, catalog, selectedEquipmentId]);

  const trendSessionActive = !!(selectedEquipmentId && selectedAssignmentId && activeAssignment);

  const range = definition.defaultRange;

  const trendBundle = useMemo(() => {
    void historyTick;
    if (!trendSessionActive || !selectedEquipmentId) return null;
    const ra = activeAssignment;
    if (!ra?.recordingStartedAt) {
      return {
        timestamps: [],
        series: [],
        events: [],
        damper: [],
        flow: [],
        dat: [],
        collecting: false,
        historyLoggingActive: false,
      };
    }
    return operatorRepository.getTrendData(site, selectedEquipmentId, range, {
      recordingStartedAt: ra.recordingStartedAt,
    });
  }, [trendSessionActive, site, selectedEquipmentId, range, activeAssignment, historyTick]);

  useEffect(() => {
    if (!trendSessionActive || !activeAssignment?.recordingStartedAt) return;
    const id = setInterval(() => setHistoryTick((x) => x + 1), 400);
    return () => clearInterval(id);
  }, [trendSessionActive, activeAssignment]);

  const timeLabels = useMemo(
    () => (trendBundle?.timestamps || []).map((t) => fmtExact(t)),
    [trendBundle]
  );

  const rawSeries = trendBundle?.series || [];

  const series = useMemo(() => {
    const ids = new Set(definition.pointIds);
    return rawSeries.filter((s) => ids.has(s.pointId));
  }, [rawSeries, definition.pointIds]);

  const showPoints = useMemo(() => {
    const m = {};
    catalog.forEach((c) => {
      m[c.id] = definition.pointIds.includes(c.id);
    });
    return m;
  }, [catalog, definition.pointIds]);

  const setPointIds = useCallback((ids) => {
    const next = Array.from(new Set(ids));
    setDefinition((d) => ({ ...d, pointIds: next }));
    setHistoryTick((x) => x + 1);
  }, []);

  const setRange = useCallback((r) => {
    setDefinition((d) => ({ ...d, defaultRange: r }));
  }, []);

  const liveSnapshot = useMemo(() => {
    void historyTick;
    if (!trendSessionActive || !selectedEquipmentId) return null;
    return operatorRepository.getTrendLiveSnapshot(site, selectedEquipmentId);
  }, [site, selectedEquipmentId, trendSessionActive, historyTick]);

  const latestByPoint = useMemo(() => {
    const out = {};
    const pts = definition.pointIds;
    const hasHist = series.length > 0 && timeLabels.length > 0;
    if (hasHist) {
      const last = timeLabels.length - 1;
      const ts = timeLabels[last];
      rawSeries.forEach((s) => {
        if (!pts.includes(s.pointId)) return;
        out[s.pointId] = {
          value: s.values[last],
          unit: s.unit,
          ts,
          source: "history",
        };
      });
      return out;
    }
    if (liveSnapshot && pts.length) {
      const ts = fmtExact(new Date());
      pts.forEach((pid) => {
        const lv = liveSnapshot[pid];
        if (lv) out[pid] = { ...lv, ts, source: "live" };
      });
    }
    return out;
  }, [rawSeries, series, timeLabels, definition.pointIds, liveSnapshot]);

  const templateDefinitions = useMemo(
    () => store.definitions.filter((d) => d.isTemplate),
    [store.definitions]
  );

  const saveChanges = useCallback(() => {
    if (!definition?.id) return;
    if (templateEditorTemplateId) {
      if (definition.id !== templateEditorTemplateId) return;
      const others = store.definitions.filter((d) => d.id !== definition.id);
      const next = {
        ...definition,
        updatedAt: new Date().toISOString(),
        ...normalizeDefinitionForTemplateStore(definition),
      };
      persist({ ...store, definitions: [next, ...others] });
      return;
    }
    if (!selectedAssignmentId) return;
    const others = store.definitions.filter((d) => d.id !== definition.id);
    const next = {
      ...definition,
      updatedAt: new Date().toISOString(),
    };
    if (next.isTemplate) {
      Object.assign(next, normalizeDefinitionForTemplateStore(definition));
    }
    persist({ ...store, definitions: [next, ...others] });
  }, [templateEditorTemplateId, selectedAssignmentId, definition, store, persist]);

  /** Begin recording using the trend definition’s current point list; chart range becomes `${days}D`. */
  const startTrendRecording = useCallback(
    (durationDays) => {
      const raw = Number(durationDays);
      const days = Math.max(1, Math.min(365, Math.floor(Number.isFinite(raw) ? raw : 14)));
      const ids = definition.pointIds || [];
      if (!ids.length || !selectedAssignmentId) return;
      const now = Date.now();
      const rangeKey = `${days}D`;
      const nextDef = {
        ...definition,
        defaultRange: rangeKey,
        updatedAt: new Date().toISOString(),
      };
      if (nextDef.isTemplate) {
        Object.assign(nextDef, normalizeDefinitionForTemplateStore(definition));
      }
      const others = store.definitions.filter((d) => d.id !== nextDef.id);
      const nextAssignments = store.assignments.map((a) =>
        a.id === selectedAssignmentId
          ? {
              ...a,
              recordingStartedAt: now,
              loggingEnabled: true,
              recordingDurationDays: days,
            }
          : a
      );
      persist({ ...store, definitions: [nextDef, ...others], assignments: nextAssignments });
      setDefinition(nextDef);
      setHistoryTick((x) => x + 1);
    },
    [selectedAssignmentId, definition, store, persist]
  );

  const stopRecording = useCallback(() => {
    if (!selectedAssignmentId) return;
    setStore((prev) => {
      const assignments = prev.assignments.map((a) =>
        a.id === selectedAssignmentId
          ? { ...a, recordingStartedAt: null, loggingEnabled: false }
          : a
      );
      const nextStore = { ...prev, assignments };
      persistTrendDataStore(site, nextStore);
      return nextStore;
    });
    setHistoryTick((x) => x + 1);
  }, [selectedAssignmentId, site]);

  const selectAssignment = useCallback(
    (assignmentId) => {
      if (selectedEquipmentId) {
        rememberSelectedAssignment(site, selectedEquipmentId, assignmentId);
        setStore((prev) => {
          const nextAssignments = markDefaultAssignment(prev.assignments, selectedEquipmentId, assignmentId);
          const nextStore = { ...prev, assignments: nextAssignments };
          persistTrendDataStore(site, nextStore);
          return nextStore;
        });
      }
      setSelectedAssignmentId(assignmentId);
    },
    [site, selectedEquipmentId]
  );

  const openNewTrendModal = useCallback(() => {
    if (!selectedEquipmentId) return;
    setModal({ mode: "new", name: "New trend", asTemplate: false, assignToAsset: false });
  }, [selectedEquipmentId]);

  const openSaveAsTemplateModal = useCallback(() => {
    if (!trendSessionActive) return;
    setModal({
      mode: "saveTemplate",
      name: definition.name,
      asTemplate: true,
      assignToAsset: false,
    });
  }, [trendSessionActive, definition.name]);

  const openEditTemplateModal = useCallback(() => {
    if (!trendSessionActive) return;
    setModal({
      mode: "edit",
      name: definition.name,
      asTemplate: definition.isTemplate,
    });
  }, [trendSessionActive, definition.name, definition.isTemplate]);

  const confirmModal = useCallback(
    ({ name, saveAsTemplate, assignToAsset = false }) => {
      if (!modal) return;
      const trimmed = (name || "").trim() || "Untitled trend";

      if (modal.mode === "new") {
        if (!selectedEquipmentId) return;
        const base = createDefaultTrendDefinition([]);
        const nextDef = {
          ...base,
          name: trimmed,
          isTemplate: !!saveAsTemplate,
          referenceBands: [],
          defaultRange: definition.defaultRange,
          overlaySettings: { ...definition.overlaySettings },
        };
        const existing = sortedAssignmentsForAsset(store, selectedEquipmentId);
        const assign = createDefaultTrendAssignment(nextDef.id, selectedEquipmentId, {
          isDefault: existing.length === 0,
        });
        persist({
          ...store,
          definitions: [nextDef, ...store.definitions],
          assignments: [...store.assignments, assign],
        });
        rememberSelectedAssignment(site, selectedEquipmentId, assign.id);
        setSelectedAssignmentId(assign.id);
        setModal(null);
        return;
      }

      if (modal.mode === "saveTemplate") {
        const copy = {
          ...definition,
          id: newTrendId(),
          name: trimmed,
          isTemplate: true,
          updatedAt: new Date().toISOString(),
          ...normalizeDefinitionForTemplateStore(definition),
        };
        let nextStore = {
          ...store,
          definitions: [copy, ...store.definitions],
        };
        if (assignToAsset && selectedEquipmentId) {
          const existing = sortedAssignmentsForAsset(store, selectedEquipmentId);
          const assign = createDefaultTrendAssignment(copy.id, selectedEquipmentId, {
            isDefault: existing.length === 0,
            loggingEnabled: true,
            recordingStartedAt: Date.now(),
          });
          nextStore = { ...nextStore, assignments: [...nextStore.assignments, assign] };
          rememberSelectedAssignment(site, selectedEquipmentId, assign.id);
          setSelectedAssignmentId(assign.id);
        }
        persist(nextStore);
        setModal(null);
        return;
      }

      if (modal.mode === "edit") {
        const others = store.definitions.filter((d) => d.id !== definition.id);
        const nextDef = {
          ...definition,
          name: trimmed,
          isTemplate: !!saveAsTemplate,
          updatedAt: new Date().toISOString(),
        };
        if (nextDef.isTemplate) {
          Object.assign(nextDef, normalizeDefinitionForTemplateStore(definition));
        }
        persist({ ...store, definitions: [nextDef, ...others] });
        setModal(null);
        return;
      }

      setModal(null);
    },
    [modal, selectedEquipmentId, catalog, definition, store, persist, site]
  );

  const duplicateTrend = useCallback(() => {
    if (!trendSessionActive || !selectedEquipmentId) return;
    const copy = cloneTrendDefinition(definition);
    const existing = sortedAssignmentsForAsset(store, selectedEquipmentId);
    const assign = createDefaultTrendAssignment(copy.id, selectedEquipmentId, {
      isDefault: existing.length === 0,
    });
    persist({
      ...store,
      definitions: [copy, ...store.definitions],
      assignments: [...store.assignments, assign],
    });
    rememberSelectedAssignment(site, selectedEquipmentId, assign.id);
    setSelectedAssignmentId(assign.id);
  }, [trendSessionActive, selectedEquipmentId, definition, store, persist, site]);

  const updateBands = useCallback((bands) => {
    setDefinition((d) => ({ ...d, referenceBands: bands }));
  }, []);

  const patchOverlay = useCallback((patch) => {
    setDefinition((d) => ({
      ...d,
      overlaySettings: { ...d.overlaySettings, ...patch },
    }));
  }, []);

  const setChartStyle = useCallback((v) => {
    setDefinition((d) => ({ ...d, chartStyle: v }));
  }, []);

  const applyTemplateToEquipment = useCallback(
    (trendDefinitionId, equipmentIds) => {
      if (!trendDefinitionId || !equipmentIds.length) return;
      let newForCurrent = null;
      setStore((prev) => {
        const assignments = [...prev.assignments];
        equipmentIds.forEach((assetId) => {
          const dup = assignments.some(
            (a) => a.trendDefinitionId === trendDefinitionId && a.assetId === assetId
          );
          if (dup) return;
          const forAsset = assignments.filter((a) => a.assetId === assetId);
          const a = createDefaultTrendAssignment(trendDefinitionId, assetId, {
            isDefault: forAsset.length === 0,
          });
          assignments.push(a);
          if (assetId === selectedEquipmentId) newForCurrent = a;
        });
        const nextStore = { ...prev, assignments };
        persistTrendDataStore(site, nextStore);
        return nextStore;
      });
      if (newForCurrent && selectedEquipmentId) {
        rememberSelectedAssignment(site, selectedEquipmentId, newForCurrent.id);
        setSelectedAssignmentId(newForCurrent.id);
      }
      setShowAssign(false);
    },
    [site, selectedEquipmentId]
  );

  const openAssignTemplateModal = useCallback(() => {
    const first = templateDefinitions[0]?.id || "";
    setAssignTemplateId(first);
    setShowAssign(true);
  }, [templateDefinitions]);

  const assignmentSummary = useMemo(() => {
    if (templateEditorTemplateId) {
      return "Template editor — no asset selected. Point slugs apply when you assign this template to equipment.";
    }
    if (!trendSessionActive || !activeAssignment) return "";
    const defName = definition.name || "Trend";
    const total = store.assignments.filter((a) => a.trendDefinitionId === definition.id).length;
    const days = activeAssignment.recordingDurationDays ?? 14;
    let rec = "";
    if (activeAssignment.recordingStartedAt) {
      const endMs = activeAssignment.recordingStartedAt + days * 24 * 60 * 60 * 1000;
      rec = ` · ${days}-day recording (ends ${new Date(endMs).toLocaleString()})`;
    } else {
      rec = " · Recording not started — add points, then use Start recording in the panel";
    }
    return `${defName} · ${total} assignment(s) for this definition (site-wide)${rec}`;
  }, [trendSessionActive, activeAssignment, definition.name, definition.id, store]);

  const trendCollecting = !!(trendSessionActive && trendBundle?.collecting);

  const assignedTrendChips = useMemo(
    () =>
      assignmentsForAsset.map((a) => {
        const d = getDefinitionById(store, a.trendDefinitionId);
        return { id: a.id, name: d?.name || "Trend" };
      }),
    [assignmentsForAsset, store]
  );

  const workspaceState = useMemo(() => {
    if (templateEditorTemplateId) return "template_editor";
    if (!selectedEquipmentId) return "no_equipment";
    if (!assignmentsForAsset.length) return "no_assignments";
    if (!trendSessionActive) return "no_session";
    if (!definition.pointIds.length) return "no_points";
    if (!activeAssignment?.recordingStartedAt) return "recording_not_started";
    if (trendBundle?.collecting) return "collecting_history";
    if (!trendBundle?.series?.length) return "no_data";
    return "active";
  }, [selectedEquipmentId, assignmentsForAsset.length, trendSessionActive, trendBundle, definition.pointIds, activeAssignment]);

  const hasUnsavedDefinitionChanges = useMemo(() => {
    if (!definition?.id) return false;
    const stored = getDefinitionById(store, definition.id);
    if (!stored) return false;
    if (templateEditorTemplateId) {
      return serializeTemplateDefinitionSnapshot(definition) !== serializeTemplateDefinitionSnapshot(stored);
    }
    if (!selectedAssignmentId) return false;
    return (
      serializeDefinitionForCompare(definition, catalog, selectedEquipmentId) !==
      serializeDefinitionForCompare(stored, catalog, selectedEquipmentId)
    );
  }, [templateEditorTemplateId, selectedAssignmentId, definition, store, catalog, selectedEquipmentId]);

  const renameTemplate = useCallback(
    (templateId, newName) => {
      const trimmed = (newName || "").trim();
      if (!trimmed) return;
      const def = getDefinitionById(store, templateId);
      if (!def?.isTemplate) return;
      const others = store.definitions.filter((d) => d.id !== templateId);
      const next = {
        ...def,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      };
      persist({ ...store, definitions: [next, ...others] });
    },
    [store, persist]
  );

  const deleteTemplate = useCallback(
    (templateId) => {
      const def = getDefinitionById(store, templateId);
      if (!def?.isTemplate) return;
      const definitions = store.definitions.filter((d) => d.id !== templateId);
      const assignments = store.assignments.filter((a) => a.trendDefinitionId !== templateId);
      persist({ ...store, definitions, assignments });
      setHistoryTick((x) => x + 1);
      setTemplateEditorTemplateId((prev) => (prev === templateId ? "" : prev));
    },
    [store, persist]
  );

  const enterTemplateEditorView = useCallback((templateId) => {
    const def = getDefinitionById(store, templateId);
    if (!def?.isTemplate) return;
    setSelectedEquipmentId("");
    setSelectedAssignmentId("");
    setTemplateEditorTemplateId(templateId);
  }, [store]);

  const exitTemplateEditorView = useCallback(() => {
    setTemplateEditorTemplateId("");
  }, []);

  const setSelectedEquipmentIdExitingTemplate = useCallback(
    (id) => {
      if (templateEditorTemplateId) setTemplateEditorTemplateId("");
      setSelectedEquipmentId(id);
    },
    [templateEditorTemplateId]
  );

  useEffect(() => {
    if (!assignTemplateId) return;
    if (templateDefinitions.some((d) => d.id === assignTemplateId)) return;
    setAssignTemplateId(templateDefinitions[0]?.id || "");
  }, [templateDefinitions, assignTemplateId]);

  return {
    trendSessionActive,
    trendCollecting,
    historyLoggingActive: !!(trendSessionActive && trendBundle?.historyLoggingActive),
    equipmentList,
    filteredEquipment,
    groups,
    equipSearch,
    setEquipSearch,
    selectedEquipmentId,
    setSelectedEquipmentId: setSelectedEquipmentIdExitingTemplate,
    selectedEquipment,
    catalog,
    definition,
    setDefinition,
    store,
    assignmentsForAsset,
    assignedTrendChips,
    selectedAssignmentId,
    selectAssignment,
    templateDefinitions,
    templateEditorTemplateId,
    enterTemplateEditorView,
    exitTemplateEditorView,
    isTemplateEditorMode: !!templateEditorTemplateId,
    range,
    setRange,
    trendBundle,
    timeLabels,
    series,
    showPoints,
    setPointIds,
    latestByPoint,
    modal,
    setModal,
    showAssign,
    setShowAssign,
    assignTemplateId,
    setAssignTemplateId,
    openNewTrendModal,
    saveChanges,
    hasUnsavedDefinitionChanges,
    openSaveAsTemplateModal,
    openEditTemplateModal,
    confirmModal,
    duplicateTrend,
    openAssignTemplateModal,
    renameTemplate,
    deleteTemplate,
    applyTemplateToEquipment,
    assignmentSummary,
    workspaceState,
    updateBands,
    patchOverlay,
    setChartStyle,
    recordingActive: !!activeAssignment?.recordingStartedAt,
    recordingDurationDays: activeAssignment?.recordingDurationDays ?? 14,
    startTrendRecording,
    stopRecording,
  };
}
