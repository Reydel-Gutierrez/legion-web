import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSite } from "../../../app/providers/SiteProvider";
import { useSiteDisplayLabel } from "../../../hooks/useSiteDisplayLabel";
import { useActiveDeployment } from "../../../hooks/useWorkingVersion";
import { useSiteLayoutLivePoints } from "../../../hooks/useSiteLayoutLivePoints";
import { coerceSiteKeyToApiId } from "../../../lib/data/siteApiResolution";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";
import { Container, Card, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import DeployedGraphicPreview, { DEPLOYED_GRAPHIC_PRESENTATION } from "../equipment/DeployedGraphicPreview";
import SiteGlobalMapView from "./layout/SiteGlobalMapView";
import SiteBuildingOverview from "./layout/SiteBuildingOverview";
import SiteBuildingInsightWidgets from "./layout/SiteBuildingInsightWidgets";
import { Routes } from "../../../routes";
import { getSummaryFromActiveRelease } from "../../../lib/activeReleaseUtils";
import { findBuildingInRelease, equipmentForBuilding } from "../../../lib/siteBuildingOverviewUtils";
import SiteQuickNavigation from "./layout/SiteQuickNavigation";
import SiteLayoutLocationNav from "./layout/SiteLayoutLocationNav";

/** Path segment for breadcrumb */
function pathSegment(id, label) {
  return { id, label };
}

/** Build layout levels (flat list) with breadcrumb path for each */
function buildLayoutLevels(releaseData) {
  const site = releaseData?.site;
  if (!site) return [];

  const levels = [];
  const siteName = site.name || "Site";
  levels.push({
    id: site.id,
    label: siteName,
    type: "site",
    breadcrumb: [pathSegment(site.id, siteName)],
  });

  (site.buildings || []).forEach((b) => {
    const bName = b.name || "Building";
    levels.push({
      id: b.id,
      label: bName,
      type: "building",
      breadcrumb: [pathSegment(site.id, siteName), pathSegment(b.id, bName)],
    });
    (b.floors || []).forEach((f) => {
      const fName = f.name || "Floor";
      levels.push({
        id: f.id,
        label: fName,
        type: "floor",
        sub: b.name,
        breadcrumb: [pathSegment(site.id, siteName), pathSegment(b.id, bName), pathSegment(f.id, fName)],
      });
    });
  });

  return levels;
}

/** Get equipment on a floor from active release payload */
function getEquipmentOnFloor(releaseData, floorId) {
  if (!releaseData?.equipment || !floorId) return [];
  return releaseData.equipment.filter((e) => String(e.floorId) === String(floorId));
}

function siteLayoutStorageKey(siteId) {
  return siteId ? `legionSiteLayoutSelection:${siteId}` : null;
}

function readSiteLayoutStorage(key) {
  if (!key || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    if (!raw.startsWith("{")) {
      return { layoutLevelId: null, selectedBuildingId: raw };
    }
    const parsed = JSON.parse(raw);
    return {
      layoutLevelId: parsed.layoutLevelId ?? null,
      selectedBuildingId: parsed.selectedBuildingId ?? null,
    };
  } catch {
    return null;
  }
}

function writeSiteLayoutStorage(key, { layoutLevelId, selectedBuildingId }) {
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ layoutLevelId, selectedBuildingId: selectedBuildingId || null }));
  } catch {
    /* ignore */
  }
}

export default function SitePage() {
  const siteLabel = useSiteDisplayLabel();
  const history = useHistory();
  const location = useLocation();
  const { siteId, apiSites } = useSite();
  const { deployment, loading: releaseLoading, error: releaseError } = useActiveDeployment();
  const activeReleaseData = deployment;
  const siteDisplayName = activeReleaseData?.site?.name || siteLabel;
  const apiSiteId = useMemo(
    () => coerceSiteKeyToApiId(siteId, apiSites) ?? (isBackendSiteId(siteId) ? siteId : null),
    [siteId, apiSites]
  );
  const layoutLevels = useMemo(() => buildLayoutLevels(activeReleaseData), [activeReleaseData]);

  const hasLevels = layoutLevels.length > 0;
  const [levelIndex, setLevelIndex] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const [layoutNavTick, setLayoutNavTick] = useState(0);
  const skipPersistRef = useRef(true);
  const restoredLayoutRef = useRef(false);
  const layoutNavRef = useRef({ stack: [], index: -1 });

  const bumpLayoutNav = useCallback(() => setLayoutNavTick((n) => n + 1), []);

  const siteStorageKey = siteLayoutStorageKey(activeReleaseData?.site?.id);

  const applyLayoutLevelId = useCallback(
    (targetId) => {
      const idx = layoutLevels.findIndex((lev) => lev.id === targetId);
      if (idx < 0) return false;
      setLevelIndex(idx);
      const lev = layoutLevels[idx];
      if (lev?.type === "building") setSelectedBuildingId(lev.id);
      else if (lev?.type === "site") setSelectedBuildingId(null);
      return true;
    },
    [layoutLevels]
  );

  const applyLevelIndex = useCallback(
    (idx) => {
      if (idx < 0 || idx >= layoutLevels.length) return;
      setLevelIndex(idx);
      const lev = layoutLevels[idx];
      if (lev?.type === "building") setSelectedBuildingId(lev.id);
      else if (lev?.type === "site") setSelectedBuildingId(null);
    },
    [layoutLevels]
  );

  useEffect(() => {
    skipPersistRef.current = true;
    restoredLayoutRef.current = false;
    setLayoutHydrated(false);
    layoutNavRef.current = { stack: [], index: -1 };
    bumpLayoutNav();
  }, [siteStorageKey, bumpLayoutNav]);

  useEffect(() => {
    if (layoutLevels.length === 0) return;

    const targetId = location.state?.selectLayoutLevelId;
    if (targetId) {
      applyLayoutLevelId(targetId);
      history.replace(location.pathname, {});
    } else if (!restoredLayoutRef.current && siteStorageKey) {
      const stored = readSiteLayoutStorage(siteStorageKey);
      if (stored?.layoutLevelId) applyLayoutLevelId(stored.layoutLevelId);
      if (stored?.selectedBuildingId) setSelectedBuildingId(stored.selectedBuildingId);
    }

    restoredLayoutRef.current = true;
    skipPersistRef.current = false;
    setLayoutHydrated(true);
  }, [
    layoutLevels,
    siteStorageKey,
    location.state?.selectLayoutLevelId,
    location.pathname,
    history,
    applyLayoutLevelId,
  ]);

  useEffect(() => {
    if (!layoutHydrated || layoutLevels.length === 0) return;
    if (layoutNavRef.current.index >= 0) return;
    layoutNavRef.current = { stack: [levelIndex], index: 0 };
    bumpLayoutNav();
  }, [layoutHydrated, layoutLevels.length, levelIndex, bumpLayoutNav]);

  useEffect(() => {
    if (skipPersistRef.current || !siteStorageKey || layoutLevels.length === 0) return;
    const level = layoutLevels[levelIndex];
    writeSiteLayoutStorage(siteStorageKey, {
      layoutLevelId: level?.id ?? null,
      selectedBuildingId,
    });
  }, [siteStorageKey, levelIndex, selectedBuildingId, layoutLevels]);

  const selectedLevel = hasLevels ? layoutLevels[levelIndex] : null;
  const selectedNodeId = selectedLevel?.id ?? null;
  const layoutGraphic = selectedNodeId
    ? (activeReleaseData?.siteLayoutGraphics ?? {})[selectedNodeId]
    : null;
  const hasLayoutGraphic = layoutGraphic && (layoutGraphic?.objects?.length > 0 || layoutGraphic?.backgroundImage?.dataUrl);

  const { points: layoutLivePoints, hydratedWorkspaceRows, equipmentLiveBundles, nowTick } =
    useSiteLayoutLivePoints({
    releaseData: activeReleaseData,
    layoutGraphic: hasLayoutGraphic ? layoutGraphic : null,
    siteId: apiSiteId,
  });

  const breadcrumb = selectedLevel?.breadcrumb ?? [];
  const levelLabel = selectedLevel?.label ?? (levelIndex === 0 ? "Overview" : `Level ${levelIndex}`);

  const equipmentOnFloor = useMemo(
    () => (selectedLevel?.type === "floor" ? getEquipmentOnFloor(activeReleaseData, selectedLevel.id) : []),
    [activeReleaseData, selectedLevel]
  );

  const summary = useMemo(
    () => (activeReleaseData ? getSummaryFromActiveRelease(activeReleaseData) : { activeAlarms: 0, unackedAlarms: 0 }),
    [activeReleaseData]
  );

  const goToLevelByPathId = useCallback(
    (pathId) => {
      const idx = layoutLevels.findIndex((lev) => lev.id === pathId);
      if (idx < 0) return;

      const nav = layoutNavRef.current;
      if (nav.index >= 0 && nav.stack[nav.index] === idx) return;

      nav.stack = nav.stack.slice(0, nav.index + 1);
      nav.stack.push(idx);
      nav.index = nav.stack.length - 1;
      applyLevelIndex(idx);
      bumpLayoutNav();
    },
    [layoutLevels, applyLevelIndex, bumpLayoutNav]
  );

  const goLayoutNavBack = useCallback(() => {
    const nav = layoutNavRef.current;
    if (nav.index > 0) {
      nav.index -= 1;
      applyLevelIndex(nav.stack[nav.index]);
      bumpLayoutNav();
      return;
    }

    const current = layoutLevels[levelIndex];
    const bc = current?.breadcrumb;
    if (!bc || bc.length <= 1) return;

    const parentId = bc[bc.length - 2].id;
    const parentIdx = layoutLevels.findIndex((lev) => lev.id === parentId);
    if (parentIdx < 0) return;

    nav.stack = [parentIdx, nav.stack[nav.index]];
    nav.index = 0;
    applyLevelIndex(parentIdx);
    bumpLayoutNav();
  }, [levelIndex, layoutLevels, applyLevelIndex, bumpLayoutNav]);

  const goLayoutNavForward = useCallback(() => {
    const nav = layoutNavRef.current;
    if (nav.index >= nav.stack.length - 1) return;
    nav.index += 1;
    applyLevelIndex(nav.stack[nav.index]);
    bumpLayoutNav();
  }, [applyLevelIndex, bumpLayoutNav]);

  const layoutNav = useMemo(() => {
    void layoutNavTick;
    const nav = layoutNavRef.current;
    const current = layoutLevels[levelIndex];
    const canGoBack = nav.index > 0 || (current?.breadcrumb?.length ?? 0) > 1;
    const canGoForward = nav.index < nav.stack.length - 1;

    return {
      canGoBack,
      canGoForward,
      onBack: goLayoutNavBack,
      onForward: goLayoutNavForward,
      levelKey: current?.id ?? "site",
    };
  }, [layoutNavTick, levelIndex, layoutLevels, goLayoutNavBack, goLayoutNavForward]);

  const openBuildingLayout = useCallback(
    (buildingId) => {
      goToLevelByPathId(buildingId);
      setSelectedBuildingId(buildingId);
    },
    [goToLevelByPathId]
  );

  const floorQuickNavContext = useMemo(() => {
    if (selectedLevel?.type !== "floor") return null;
    const bSeg = selectedLevel.breadcrumb?.[1];
    if (!bSeg?.id) return null;
    const bModel = findBuildingInRelease(activeReleaseData, bSeg.id);
    const floorModel =
      bModel?.floors?.find((f) => String(f.id) === String(selectedLevel.id)) ||
      ({ id: selectedLevel.id, name: selectedLevel.label });
    return {
      buildingId: bSeg.id,
      buildingName: bSeg.label,
      floor: floorModel,
    };
  }, [selectedLevel, activeReleaseData]);

  const isGlobalSiteView = Boolean(hasLevels && selectedLevel?.type === "site" && levelIndex === 0);
  const isBuildingLayoutView = Boolean(hasLevels && selectedLevel?.type === "building");

  const buildingEquipment = useMemo(() => {
    if (!isBuildingLayoutView || !selectedNodeId) return [];
    return equipmentForBuilding(activeReleaseData, selectedNodeId);
  }, [isBuildingLayoutView, selectedNodeId, activeReleaseData]);

  const goToEquipmentDetail = (equipmentId) => {
    const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(equipmentId));
    history.push(path);
  };

  const resolveEquipmentLabelForLayout = useCallback(
    (equipmentId) => {
      if (!equipmentId) return "";
      const row = activeReleaseData?.equipment?.find((e) => e.id === equipmentId);
      return row?.displayLabel || row?.name || equipmentId;
    },
    [activeReleaseData]
  );

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type) return;
    if (linkTarget.type === "layout" && linkTarget.id) goToLevelByPathId(linkTarget.id);
    else if (linkTarget.type === "equipment" && linkTarget.id) goToEquipmentDetail(linkTarget.id);
    else if (linkTarget.type === "url" && linkTarget.url) window.open(linkTarget.url, "_blank", "noopener,noreferrer");
    else if (linkTarget.type === "route" && linkTarget.path) history.push(linkTarget.path);
  };

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3 site-layout-page">
        {releaseLoading && !activeReleaseData && (
          <div className="text-white-50 small mb-3">Loading site layout from server…</div>
        )}
        {releaseError && (
          <div className="alert alert-danger py-2 small mb-3" role="alert">
            {releaseError}
          </div>
        )}
        {layoutHydrated && hasLevels ? (
          <SiteLayoutLocationNav
            layoutNav={layoutNav}
            breadcrumb={breadcrumb}
            onSelectLevel={goToLevelByPathId}
          />
        ) : null}

        <div className="site-layout-full-card-wrap">
          {hasLevels && !layoutHydrated ? (
            <div className="text-white-50 small py-4 text-center">Loading site layout…</div>
          ) : isGlobalSiteView ? (
            <>
              <SiteGlobalMapView
                activeReleaseData={activeReleaseData}
                siteDisplayName={siteDisplayName}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
                onOpenBuilding={openBuildingLayout}
                navKey={layoutNav.levelKey}
              />
              {(summary.activeAlarms > 0 || summary.unackedAlarms > 0) && (
                <div className="site-layout-red-zones-strip site-layout-red-zones-strip--below-map mt-2 rounded border border-light border-opacity-10 px-3 py-2">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                  <span>
                    {summary.unackedAlarms > 0
                      ? `${summary.unackedAlarms} unacked alarm${summary.unackedAlarms !== 1 ? "s" : ""}`
                      : `${summary.activeAlarms} active alarm${summary.activeAlarms !== 1 ? "s" : ""}`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="ms-2 border-danger border-opacity-50 text-danger"
                    onClick={() => history.push(Routes.LegionAlarms.path)}
                  >
                    View Alarms
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card
              className={[
                "site-layout-full-card bg-primary border border-light border-opacity-10 shadow-sm overflow-hidden",
                isBuildingLayoutView ? "site-layout-full-card--building" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Card.Body
                className={isBuildingLayoutView ? "p-0 site-building-view" : "p-0 position-relative"}
              >
                <div
                  className={[
                    "legion-map-wrapper site-layout-map-area",
                    isBuildingLayoutView ? "site-building-view__media site-layout-map-area--building-overview" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isBuildingLayoutView && selectedNodeId ? (
                    <SiteBuildingOverview
                      releaseData={activeReleaseData}
                      buildingId={selectedNodeId}
                      onSelectFloor={(floorId) => goToLevelByPathId(floorId)}
                      navKey={layoutNav.levelKey}
                    />
                  ) : null}
                  {selectedLevel?.type === "floor" && floorQuickNavContext ? (
                    <SiteQuickNavigation
                      variant="floor"
                      releaseData={activeReleaseData}
                      floor={floorQuickNavContext.floor}
                      equipment={equipmentOnFloor}
                      onOpenEquipmentDetail={goToEquipmentDetail}
                      navKey={layoutNav.levelKey}
                    />
                  ) : null}
                  {hasLayoutGraphic ? (
                    <DeployedGraphicPreview
                      graphic={layoutGraphic}
                      points={layoutLivePoints}
                      onLinkClick={handleGraphicLinkClick}
                      presentation={DEPLOYED_GRAPHIC_PRESENTATION.layout}
                      onOpenEquipmentDetail={goToEquipmentDetail}
                      resolveEquipmentLabel={resolveEquipmentLabelForLayout}
                      allowSimulatedFallback={false}
                      equipmentLiveBundles={equipmentLiveBundles}
                      hydratedWorkspaceRows={hydratedWorkspaceRows}
                      nowTick={nowTick}
                    />
                  ) : (
                    <div className="legion-map-image d-flex align-items-center justify-content-center text-white-50 small">
                      No deployed site layout graphic for this {selectedLevel?.type || "layout"}.
                    </div>
                  )}
                  {!isBuildingLayoutView ? (
                    <div className="legion-map-badge">
                      {siteDisplayName} • {levelLabel}
                    </div>
                  ) : null}

                  {(summary.activeAlarms > 0 || summary.unackedAlarms > 0) && (
                    <div className="site-layout-red-zones-strip">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="me-1" />
                      <span>
                        {summary.unackedAlarms > 0
                          ? `${summary.unackedAlarms} unacked alarm${summary.unackedAlarms !== 1 ? "s" : ""}`
                          : `${summary.activeAlarms} active alarm${summary.activeAlarms !== 1 ? "s" : ""}`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        className="ms-2 border-danger border-opacity-50 text-danger"
                        onClick={() => history.push(Routes.LegionAlarms.path)}
                      >
                        View Alarms
                      </Button>
                    </div>
                  )}
                </div>
                {isBuildingLayoutView && selectedNodeId ? (
                  <SiteBuildingInsightWidgets
                    buildingId={selectedNodeId}
                    buildingEquipment={buildingEquipment}
                  />
                ) : null}
              </Card.Body>
            </Card>
          )}

          {!isGlobalSiteView && hasLevels && !hasLayoutGraphic && (
            <div className="text-white-50 small mt-2">
              Create and deploy site layout graphics in Engineering → Graphics Manager to show custom layouts here.
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
