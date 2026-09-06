import React, { useCallback, useState } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import { useSiteLayoutLivePoints } from "../../../hooks/useSiteLayoutLivePoints";
import { getEquipmentFromRelease } from "../../../lib/activeReleaseUtils";
import { countFacilityEquipment } from "../../../lib/operator/facilityTree";
import { locationForFacilityNode } from "../../../lib/operator/operatorSelection";
import OperatorBreadcrumbs from "./OperatorBreadcrumbs";
import DeployedGraphicPreview, {
  DEPLOYED_GRAPHIC_PRESENTATION,
} from "../equipment/DeployedGraphicPreview";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.2;

const LEGEND_ITEMS = [
  { id: "normal", label: "Normal" },
  { id: "fault", label: "Fault" },
  { id: "offline", label: "Offline" },
  { id: "unknown", label: "Unknown" },
];

export default function FloorWorkspace({ releaseData, tree, selectedNode, siteKey, onSelectNode }) {
  const history = useHistory();
  const [viewZoom, setViewZoom] = useState(1);
  const graphic = (releaseData?.siteLayoutGraphics || {})[selectedNode.id];
  const hasGraphic = graphic && (graphic.objects?.length > 0 || graphic.backgroundImage?.dataUrl);
  const deviceCount = countFacilityEquipment(selectedNode);
  const siteName = releaseData?.site?.name || tree?.label || "Site";
  const liveSiteId = selectedNode.siteId || siteKey;

  const { points, hydratedWorkspaceRows, equipmentLiveBundles, nowTick } = useSiteLayoutLivePoints({
    releaseData,
    layoutGraphic: hasGraphic ? graphic : null,
    siteId: liveSiteId,
  });

  const goToEquipment = useCallback(
    (equipmentId) => {
      const eq = getEquipmentFromRelease(releaseData, equipmentId);
      const node = {
        kind: "equipment",
        id: String(eq?.id || equipmentId),
        label: eq?.displayLabel || eq?.name || String(equipmentId),
        siteId: selectedNode.siteId || "",
      };
      if (onSelectNode) onSelectNode(node);
      else history.push(locationForFacilityNode(node));
    },
    [releaseData, onSelectNode, history, selectedNode.siteId]
  );

  const handleGraphicLinkClick = (linkTarget) => {
    if (!linkTarget?.type) return;
    if (linkTarget.type === "equipment" && linkTarget.id) goToEquipment(linkTarget.id);
    else if (linkTarget.type === "layout" && linkTarget.id) {
      if (onSelectNode) onSelectNode({ kind: "floor", id: String(linkTarget.id), label: linkTarget.id });
    } else if (linkTarget.type === "url" && linkTarget.url) {
      window.open(linkTarget.url, "_blank", "noopener,noreferrer");
    } else if (linkTarget.type === "route" && linkTarget.path) {
      history.push(linkTarget.path);
    }
  };

  const resolveEquipmentLabel = (equipmentId) => {
    const eq = getEquipmentFromRelease(releaseData, equipmentId);
    return eq?.displayLabel || eq?.name || equipmentId;
  };

  const resolveEquipment = (equipmentId) => getEquipmentFromRelease(releaseData, equipmentId);

  const zoomOut = () => setViewZoom((z) => Math.max(ZOOM_MIN, Math.round((z / ZOOM_STEP) * 100) / 100));
  const zoomIn = () => setViewZoom((z) => Math.min(ZOOM_MAX, Math.round(z * ZOOM_STEP * 100) / 100));

  return (
    <div className="floor-workspace">
      <OperatorBreadcrumbs tree={tree} selectedNode={selectedNode} />
      <header className="workspace-header">
        <div className="equipment-header__row">
          <span className="equipment-header__icon" aria-hidden="true">
            <FacilityKindIcon kind={selectedNode.kind === "building" ? "building" : "floor"} />
          </span>
          <div className="workspace-header__copy">
            <h1 className="workspace-header__title">{selectedNode.label}</h1>
            <p className="workspace-header__meta">
              {siteName}
              <span className="workspace-header__dot">|</span>
              {deviceCount} {deviceCount === 1 ? "Device" : "Devices"}
            </p>
          </div>
        </div>
        {hasGraphic ? (
          <div className="floor-workspace__zoom" role="group" aria-label="Floor zoom">
            <button
              type="button"
              className="floor-workspace__zoom-btn"
              aria-label="Zoom out"
              disabled={viewZoom <= ZOOM_MIN}
              onClick={zoomOut}
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <button
              type="button"
              className="floor-workspace__zoom-btn"
              aria-label="Zoom in"
              disabled={viewZoom >= ZOOM_MAX}
              onClick={zoomIn}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        ) : null}
      </header>
      <section className="operator-card floor-workspace__card">
        <div className={`floor-workspace__canvas${viewZoom > 1 ? " is-zoomed" : ""}`}>
          {hasGraphic ? (
            <DeployedGraphicPreview
              graphic={graphic}
              points={points}
              onLinkClick={handleGraphicLinkClick}
              presentation={DEPLOYED_GRAPHIC_PRESENTATION.layout}
              onOpenEquipmentDetail={goToEquipment}
              resolveEquipmentLabel={resolveEquipmentLabel}
              resolveEquipment={resolveEquipment}
              pinVariant="operator"
              zoomFactor={viewZoom}
              allowSimulatedFallback={false}
              equipmentLiveBundles={equipmentLiveBundles}
              hydratedWorkspaceRows={hydratedWorkspaceRows}
              nowTick={nowTick}
            />
          ) : (
            <div className="floor-workspace__empty">
              No deployed graphic for this {selectedNode.kind === "building" ? "building" : "level"}.
              Create and deploy a layout in Engineering → Graphics Manager.
            </div>
          )}
          {deviceCount > 0 ? (
            <ul className="floor-workspace__legend" aria-label="Equipment status legend">
              {LEGEND_ITEMS.map((item) => (
                <li key={item.id} className="floor-workspace__legend-item">
                  <span className={`floor-workspace__legend-dot floor-workspace__legend-dot--${item.id}`} />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
