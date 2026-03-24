import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSiteDisplayLabel } from "../../../hooks/useSiteDisplayLabel";
import { useActiveDeployment } from "../../../hooks/useWorkingVersion";
import { Container, Card, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faBoxOpen, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import DeployedGraphicPreview, { DEPLOYED_GRAPHIC_PRESENTATION } from "../equipment/DeployedGraphicPreview";
import SiteGlobalMapView from "./layout/SiteGlobalMapView";
import { Routes } from "../../../routes";
import { getSummaryFromActiveRelease } from "../../../lib/activeReleaseUtils";

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

export default function SitePage() {
  const siteLabel = useSiteDisplayLabel();
  const history = useHistory();
  const location = useLocation();
  const { deployment, loading: releaseLoading, error: releaseError } = useActiveDeployment();
  const activeReleaseData = deployment;
  const siteDisplayName = activeReleaseData?.site?.name || siteLabel;
  const layoutLevels = useMemo(() => buildLayoutLevels(activeReleaseData), [activeReleaseData]);

  const hasLevels = layoutLevels.length > 0;
  const [levelIndex, setLevelIndex] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);

  const siteStorageKey = activeReleaseData?.site?.id ? `legionSiteLayoutSelection:${activeReleaseData.site.id}` : null;

  useEffect(() => {
    const targetId = location.state?.selectLayoutLevelId;
    if (targetId && layoutLevels.length > 0) {
      const idx = layoutLevels.findIndex((lev) => lev.id === targetId);
      if (idx >= 0) {
        setLevelIndex(idx);
        const lev = layoutLevels[idx];
        if (lev?.type === "building") setSelectedBuildingId(lev.id);
      }
      history.replace(location.pathname, {}); // clear state so we don't re-apply on refresh
    }
  }, [location.state?.selectLayoutLevelId, layoutLevels, history, location.pathname]);

  useEffect(() => {
    if (!siteStorageKey || typeof sessionStorage === "undefined") {
      setSelectedBuildingId(null);
      return;
    }
    try {
      const v = sessionStorage.getItem(siteStorageKey);
      setSelectedBuildingId(v || null);
    } catch {
      setSelectedBuildingId(null);
    }
  }, [siteStorageKey]);

  useEffect(() => {
    if (!siteStorageKey || !selectedBuildingId) return;
    try {
      sessionStorage.setItem(siteStorageKey, selectedBuildingId);
    } catch {
      /* ignore */
    }
  }, [siteStorageKey, selectedBuildingId]);

  const selectedLevel = hasLevels ? layoutLevels[levelIndex] : null;
  const selectedNodeId = selectedLevel?.id ?? null;
  const layoutGraphic = selectedNodeId
    ? (activeReleaseData?.siteLayoutGraphics ?? {})[selectedNodeId]
    : null;
  const hasLayoutGraphic = layoutGraphic && (layoutGraphic?.objects?.length > 0 || layoutGraphic?.backgroundImage?.dataUrl);

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
      if (idx >= 0) {
        setLevelIndex(idx);
        const lev = layoutLevels[idx];
        if (lev?.type === "building") setSelectedBuildingId(lev.id);
      }
    },
    [layoutLevels]
  );

  const openBuildingLayout = useCallback(
    (buildingId) => {
      goToLevelByPathId(buildingId);
      setSelectedBuildingId(buildingId);
    },
    [goToLevelByPathId]
  );

  const isGlobalSiteView = Boolean(hasLevels && selectedLevel?.type === "site" && levelIndex === 0);

  const goToEquipmentDetail = (equipmentId) => {
    const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(equipmentId));
    history.push(path);
  };

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
        {/* Breadcrumb — compact, single row */}
        <nav aria-label="Site location" className="d-flex align-items-center flex-wrap gap-1 text-white-50 small mb-3">
          <span className="text-white-50">Site Layout</span>
          {breadcrumb.length > 0 && breadcrumb.map((seg, i) => (
            <span key={seg.id} className="d-flex align-items-center gap-1">
              <FontAwesomeIcon icon={faChevronRight} className="fa-xs opacity-50" />
              {i < breadcrumb.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-white-50 small text-decoration-none"
                  onClick={() => goToLevelByPathId(seg.id)}
                >
                  {seg.label}
                </button>
              ) : (
                <span className="text-white">{seg.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="site-layout-full-card-wrap">
          {isGlobalSiteView ? (
            <>
              <SiteGlobalMapView
                activeReleaseData={activeReleaseData}
                siteDisplayName={siteDisplayName}
                selectedBuildingId={selectedBuildingId}
                onSelectBuilding={setSelectedBuildingId}
                onOpenBuilding={openBuildingLayout}
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
            <Card className="site-layout-full-card bg-primary border border-light border-opacity-10 shadow-sm overflow-hidden">
              <Card.Body className="p-0 position-relative">
                <div className="legion-map-wrapper site-layout-map-area">
                  {hasLayoutGraphic ? (
                    <DeployedGraphicPreview
                      graphic={layoutGraphic}
                      points={[]}
                      onLinkClick={handleGraphicLinkClick}
                      presentation={DEPLOYED_GRAPHIC_PRESENTATION.layout}
                    />
                  ) : (
                    <div className="legion-map-image d-flex align-items-center justify-content-center text-white-50 small">
                      No deployed site layout graphic for this {selectedLevel?.type || "layout"}.
                    </div>
                  )}
                  <div className="legion-map-badge">
                    {siteDisplayName} • {levelLabel}
                  </div>

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
              </Card.Body>
            </Card>
          )}

          {selectedLevel?.type === "floor" && equipmentOnFloor.length > 0 && (
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm mt-3">
              <Card.Header className="bg-transparent border-light border-opacity-10 py-2">
                <span className="text-white fw-semibold small">
                  <FontAwesomeIcon icon={faBoxOpen} className="me-2" />
                  Equipment on this floor
                </span>
              </Card.Header>
              <Card.Body className="py-2">
                <div className="d-flex flex-wrap gap-2">
                  {equipmentOnFloor.map((eq) => (
                    <Button
                      key={eq.id}
                      size="sm"
                      variant="outline-secondary"
                      className="text-white-50 border-secondary border-opacity-50"
                      onClick={() => goToEquipmentDetail(eq.id)}
                    >
                      {eq.displayLabel || eq.name || eq.id}
                    </Button>
                  ))}
                </div>
                <div className="text-white-50 small mt-2">
                  Click an equipment to open its detail page.
                </div>
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
