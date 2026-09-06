import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSite } from "../../../app/providers/SiteProvider";
import { OperatorChromeProvider } from "../../../app/providers/OperatorChromeProvider";
import { useWorkspaceMode } from "../../../app/providers/WorkspaceModeProvider";
import { useOperatorFacilityModel } from "../../../hooks/useOperatorFacilityModel";
import { useOperatorFacilityOverlay } from "../../../hooks/useOperatorFacilityOverlay";
import { accessRepository } from "../../../lib/data";
import { coerceSiteKeyToApiId } from "../../../lib/data/siteApiResolution";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import {
  findFacilityNode,
  getFacilityAncestorIds,
  pickDefaultFacilityNode,
} from "../../../lib/operator/facilityTree";
import { getEquipmentFromRelease } from "../../../lib/activeReleaseUtils";
import {
  isOperatorHierarchyPath,
  locationForFacilityNode,
  parseOperatorSelection,
} from "../../../lib/operator/operatorSelection";
import { canAccessEngineeringDashboard } from "../../../lib/access/operatorPermissions";
import { Routes } from "../../../routes";
import FacilitySidebar from "./FacilitySidebar";
import OperatorTopBar from "./OperatorTopBar";
import OperatorWorkspace from "../workspace/OperatorWorkspace";
import CommissioningPlaceholder from "../workspace/CommissioningPlaceholder";

const SIDEBAR_KEY = "legionOperatorSidebarContracted";

function readContracted() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {
    return false;
  }
}

export default function OperatorShell({ children }) {
  const history = useHistory();
  const location = useLocation();
  const { site, setSite, apiSites } = useSite();
  const { setCurrentMode } = useWorkspaceMode();
  const { tree, releaseData, loading, error } = useOperatorFacilityModel();

  const currentUser = useMemo(() => {
    try {
      return accessRepository.getCurrentUserForAccess();
    } catch {
      return null;
    }
  }, []);

  const [dashboardMode, setDashboardMode] = useState("operator");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [contracted, setContracted] = useState(readContracted);
  const [commandIntent, setCommandIntent] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const parsed = useMemo(
    () => parseOperatorSelection(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const selectedNode = useMemo(() => {
    if (!tree) return null;
    if (parsed.kind === "equipment" && parsed.id) {
      const eq = getEquipmentFromRelease(releaseData, parsed.id);
      const node = findFacilityNode(tree, eq?.id || parsed.id);
      if (node) return node;
    }
    if (parsed.id) {
      return findFacilityNode(tree, parsed.id) || (parsed.kind === "site" ? tree : null);
    }
    if (parsed.kind === "site") {
      if (location.pathname === Routes.LegionSite.path && !location.search) {
        return pickDefaultFacilityNode(tree, releaseData) || tree;
      }
      return tree;
    }
    return pickDefaultFacilityNode(tree, releaseData) || tree;
  }, [tree, parsed, releaseData, location.pathname, location.search]);

  const siteKey =
    (selectedNode && selectedNode.siteId) ||
    coerceSiteKeyToApiId(site, apiSites) ||
    (isBackendSiteId(site) ? site : site);

  const { alarms, annotatedTree } = useOperatorFacilityOverlay(siteKey, tree);
  const displaySelected =
    annotatedTree && selectedNode
      ? findFacilityNode(annotatedTree, selectedNode.id) || selectedNode
      : selectedNode;

  useEffect(() => {
    document.body.classList.add("operator-shell-active");
    return () => document.body.classList.remove("operator-shell-active");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, contracted ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [contracted]);

  useEffect(() => {
    if (!selectedNode) return;
    const ancestors = getFacilityAncestorIds(tree, selectedNode.id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestors.forEach((id) => next.add(String(id)));
      next.add(String(selectedNode.id));
      if (tree?.id) next.add(String(tree.id));
      return next;
    });
  }, [selectedNode, tree]);

  useEffect(() => {
    if (!isOperatorHierarchyPath(location.pathname)) return;
    if (location.pathname !== Routes.LegionSite.path) return;
    if (location.search) return;
    if (!tree || !selectedNode) return;
    if (String(selectedNode.id) === String(tree.id) && selectedNode.kind === "site") return;
    history.replace(locationForFacilityNode(selectedNode));
  }, [location.pathname, location.search, selectedNode, tree, history]);

  useEffect(() => {
    if (selectedNode && selectedNode.siteId && selectedNode.siteId !== site) {
      setSite(selectedNode.siteId);
    }
  }, [selectedNode, site, setSite]);

  const onSelect = useCallback(
    (node) => {
      if (node && node.siteId) setSite(node.siteId);
      history.push(locationForFacilityNode(node));
    },
    [history, setSite]
  );

  const onToggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onDashboardModeChange = useCallback(
    (mode) => {
      if (mode === "engineering") {
        if (!canAccessEngineeringDashboard(currentUser)) return;
        setCurrentMode("engineering");
        return;
      }
      setDashboardMode(mode);
      if (mode === "operator" && !isOperatorHierarchyPath(location.pathname)) {
        history.push(Routes.LegionSite.path);
      }
    },
    [currentUser, setCurrentMode, history, location.pathname]
  );

  const hierarchyView = isOperatorHierarchyPath(location.pathname);
  const showCommissioning = dashboardMode === "commissioning" && canAccessEngineeringDashboard(currentUser);

  return (
    <OperatorChromeProvider hideHero variant="shell">
      <div className={`operator-shell${contracted ? " operator-shell--sidebar-collapsed" : ""}`}>
        <FacilitySidebar
          tree={annotatedTree || tree}
          selectedNode={displaySelected || selectedNode}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          currentUser={currentUser}
          onRefresh={() => setRefreshNonce((n) => n + 1)}
          onCommandPoints={setCommandIntent}
          contracted={contracted}
          onToggleContracted={() => setContracted((v) => !v)}
        />
        <div className="operator-shell__main">
          <OperatorTopBar
            currentUser={currentUser}
            dashboardMode={showCommissioning ? "commissioning" : "operator"}
            onDashboardModeChange={onDashboardModeChange}
            tree={tree}
            releaseData={releaseData}
          />
          <div className="operator-shell__workspace">
            {showCommissioning ? (
              <CommissioningPlaceholder onBack={() => setDashboardMode("operator")} />
            ) : hierarchyView ? (
              <OperatorWorkspace
                key={`${selectedNode?.kind || "none"}-${selectedNode?.id || "none"}-${refreshNonce}`}
                releaseData={releaseData}
                loading={loading}
                error={error}
                tree={annotatedTree || tree}
                selectedNode={displaySelected || selectedNode}
                siteKey={siteKey}
                commandIntent={commandIntent}
                onCommandIntentHandled={() => setCommandIntent(null)}
                onSelectNode={onSelect}
                siteAlarms={alarms}
              />
            ) : (
              <div className="operator-secondary-view">{children}</div>
            )}
          </div>
        </div>
      </div>
    </OperatorChromeProvider>
  );
}
