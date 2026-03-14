import React, { useMemo, useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSite } from "../../../app/providers/SiteProvider";
import { useActiveDeployment } from "../../../hooks/useEngineeringDraft";
import { Container, Row, Col, Card, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faBoxOpen, faCity, faBuilding, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import DeployedGraphicPreview from "../equipment/DeployedGraphicPreview";
import { Routes } from "../../../routes";

import BuildingImage from "../../../assets/img/bi.jpg";
import floor1Img from "../../../assets/img/floor1.png";
import floor2Img from "../../../assets/img/floor2.png";
import floor3Img from "../../../assets/img/floor3.png";

const FALLBACK_IMAGES = {
  0: BuildingImage,
  1: floor1Img,
  2: floor2Img,
  3: floor3Img,
};

/** Path segment for breadcrumb */
function pathSegment(id, label) {
  return { id, label };
}

/** Build layout levels (flat list) with breadcrumb path for each */
function buildLayoutLevels(activeDeployment) {
  const site = activeDeployment?.site;
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

/** Build a hierarchy tree: site → buildings → floors (for nav) */
function buildSiteNavTree(activeDeployment) {
  const site = activeDeployment?.site;
  if (!site) return null;
  const siteName = site.name || "Site";
  const buildings = (site.buildings || []).map((b) => {
    const bName = b.name || "Building";
    const floors = (b.floors || []).map((f) => ({
      id: f.id,
      label: f.name || "Floor",
      type: "floor",
    }));
    return { id: b.id, label: bName, type: "building", children: floors };
  });
  return { id: site.id, label: siteName, type: "site", children: buildings };
}

/** Get equipment on a floor from deployment */
function getEquipmentOnFloor(activeDeployment, floorId) {
  if (!activeDeployment?.equipment || !floorId) return [];
  return activeDeployment.equipment.filter((e) => String(e.floorId) === String(floorId));
}

const TREE_ICONS = { site: faCity, building: faBuilding, floor: faLayerGroup };

/** Single row in the site nav tree */
function SiteNavTreeRow({ node, level, selectedId, onSelect }) {
  const isSelected = selectedId === node.id;
  const Icon = TREE_ICONS[node.type] || faBuilding;
  const hasChildren = node.children && node.children.length > 0;
  const padLeft = 8 + level * 20;

  return (
    <div className="site-layout-nav-tree">
      <button
        type="button"
        className={`site-layout-nav-tree-row ${isSelected ? "site-layout-nav-tree-row--active" : ""}`}
        style={{ paddingLeft: padLeft }}
        onClick={() => onSelect(node.id)}
      >
        <span className="site-layout-nav-tree-icon">
          <FontAwesomeIcon icon={Icon} className="fa-sm" />
        </span>
        <span className="site-layout-nav-tree-label">{node.label}</span>
      </button>
      {hasChildren &&
        node.children.map((child) => (
          <SiteNavTreeRow
            key={child.id}
            node={child}
            level={level + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function SitePage() {
  const { site } = useSite();
  const history = useHistory();
  const location = useLocation();
  const activeDeployment = useActiveDeployment();
  const layoutLevels = useMemo(() => buildLayoutLevels(activeDeployment), [activeDeployment]);
  const siteNavTree = useMemo(() => buildSiteNavTree(activeDeployment), [activeDeployment]);

  const hasLevels = layoutLevels.length > 0;
  const [levelIndex, setLevelIndex] = useState(0);

  useEffect(() => {
    const targetId = location.state?.selectLayoutLevelId;
    if (targetId && layoutLevels.length > 0) {
      const idx = layoutLevels.findIndex((lev) => lev.id === targetId);
      if (idx >= 0) setLevelIndex(idx);
      history.replace(location.pathname, {}); // clear state so we don't re-apply on refresh
    }
  }, [location.state?.selectLayoutLevelId, layoutLevels, history, location.pathname]);

  const selectedLevel = hasLevels ? layoutLevels[levelIndex] : null;
  const selectedNodeId = selectedLevel?.id ?? null;
  const layoutGraphic = selectedNodeId
    ? (activeDeployment?.siteLayoutGraphics ?? {})[selectedNodeId]
    : null;
  const hasLayoutGraphic = layoutGraphic && (layoutGraphic?.objects?.length > 0 || layoutGraphic?.backgroundImage?.dataUrl);

  const breadcrumb = selectedLevel?.breadcrumb ?? [];
  const fallbackImage = FALLBACK_IMAGES[levelIndex] ?? FALLBACK_IMAGES[0];
  const levelLabel = selectedLevel?.label ?? (levelIndex === 0 ? "Overview" : `Level ${levelIndex}`);

  const equipmentOnFloor = useMemo(
    () => (selectedLevel?.type === "floor" ? getEquipmentOnFloor(activeDeployment, selectedLevel.id) : []),
    [activeDeployment, selectedLevel]
  );

  const goToLevelByPathId = (pathId) => {
    const idx = layoutLevels.findIndex((lev) => lev.id === pathId);
    if (idx >= 0) setLevelIndex(idx);
  };

  const goToEquipmentDetail = (equipmentId) => {
    const path = Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(equipmentId));
    history.push(path);
  };

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type || !linkTarget?.id) return;
    if (linkTarget.type === "layout") goToLevelByPathId(linkTarget.id);
    else if (linkTarget.type === "equipment") goToEquipmentDetail(linkTarget.id);
  };

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3 site-layout-page">
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

        <Row className="g-3 align-items-start">
          {/* Left: Navigate tree — compact sidebar so Site Layout is the main focus */}
          <Col xs={12} md={3} lg={2}>
            {siteNavTree ? (
              <Card className="bg-primary border border-light border-opacity-10 shadow-sm site-layout-nav-sidebar h-100">
                <Card.Header className="bg-transparent border-light border-opacity-10 py-2">
                  <span className="text-white fw-semibold small">Navigate</span>
                </Card.Header>
                <Card.Body className="py-2 overflow-auto">
                  <SiteNavTreeRow
                    node={siteNavTree}
                    level={0}
                    selectedId={selectedNodeId}
                    onSelect={goToLevelByPathId}
                  />
                </Card.Body>
              </Card>
            ) : (
              <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
                <Card.Body className="py-2">
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border border-light border-opacity-25 text-white-50"
                    onClick={() => setLevelIndex(0)}
                  >
                    Building
                  </Button>
                </Card.Body>
              </Card>
            )}
          </Col>

          {/* Right: Main content — graphic + equipment (majority of width) */}
          <Col xs={12} md={9} lg={10}>
            <h5 className="text-white fw-bold mb-2">Site Layout</h5>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm overflow-hidden">
              <Card.Body className="p-0">
                <div className="legion-map-wrapper">
                  {hasLayoutGraphic ? (
                    <DeployedGraphicPreview
                      graphic={layoutGraphic}
                      points={[]}
                      onLinkClick={handleGraphicLinkClick}
                    />
                  ) : (
                    <img src={fallbackImage} alt={levelLabel} className="legion-map-image" />
                  )}
                  <div className="legion-map-badge">
                    {site} • {levelLabel}
                  </div>
                </div>
              </Card.Body>
            </Card>

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

            {hasLevels && !hasLayoutGraphic && (
              <div className="text-white-50 small mt-2">
                Create and deploy site layout graphics in Engineering → Graphics Manager to show custom layouts here.
              </div>
            )}
          </Col>
        </Row>
      </div>
    </Container>
  );
}
