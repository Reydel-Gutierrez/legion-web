import React, { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import DeployedGraphicPreview, {
  DEPLOYED_GRAPHIC_PRESENTATION,
} from "../../operator/equipment/DeployedGraphicPreview";
import { countFacilityEquipment, findFacilityNode } from "../../../lib/operator/facilityTree";
import NodeEditorPanel from "../site-builder/components/NodeEditorPanel";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.2;

/** Mirrors Operator's FloorWorkspace (same header/canvas structure) for a selected Building or Floor node — no live point overlay, sourced from the Engineering working state instead of a release. */
export default function EngineeringFloorWorkspace() {
  const {
    siteTree,
    facilityTree,
    selectedNode,
    workingState,
    equipmentList,
    breadcrumb,
    floors,
    handleSelectEquipment,
    handleSaveNode,
    handleDeleteNode,
    handleDeleteConfirm,
  } = useEngineeringSiteTree();
  const [viewZoom, setViewZoom] = useState(1);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setViewZoom(1);
    setEditing(false);
  }, [selectedNode?.id]);

  const facilityNode = findFacilityNode(facilityTree, selectedNode?.id);
  const graphic = workingState.siteLayoutGraphics?.[selectedNode?.id] || null;
  const hasGraphic = graphic && (graphic.objects?.length > 0 || graphic.backgroundImage?.dataUrl);
  const deviceCount = countFacilityEquipment(facilityNode);
  const isBuilding = selectedNode?.type === "building";
  const siteName = siteTree?.name || "Site";

  const goToEquipment = useCallback(
    (equipmentId) => {
      const eq = equipmentList.find((e) => String(e.id) === String(equipmentId));
      if (eq) handleSelectEquipment(eq);
    },
    [equipmentList, handleSelectEquipment]
  );

  const handleGraphicLinkClick = (linkTarget) => {
    if (linkTarget?.type === "equipment" && linkTarget.id) goToEquipment(linkTarget.id);
  };

  const resolveEquipmentLabel = (equipmentId) => {
    const eq = equipmentList.find((e) => String(e.id) === String(equipmentId));
    return eq?.displayLabel || eq?.name || equipmentId;
  };
  const resolveEquipment = (equipmentId) => equipmentList.find((e) => String(e.id) === String(equipmentId));

  const zoomOut = () => setViewZoom((z) => Math.max(ZOOM_MIN, Math.round((z / ZOOM_STEP) * 100) / 100));
  const zoomIn = () => setViewZoom((z) => Math.min(ZOOM_MAX, Math.round(z * ZOOM_STEP * 100) / 100));

  return (
    <div className="floor-workspace">
      <header className="workspace-header">
        <div className="equipment-header__row">
          <span className="equipment-header__icon" aria-hidden="true">
            <FacilityKindIcon kind={isBuilding ? "building" : "floor"} />
          </span>
          <div className="workspace-header__copy">
            <h1 className="workspace-header__title">{selectedNode?.displayLabel || selectedNode?.name}</h1>
            <p className="workspace-header__meta">
              {siteName}
              <span className="workspace-header__dot">|</span>
              {deviceCount} {deviceCount === 1 ? "Device" : "Devices"}
            </p>
          </div>
        </div>
        <div className="floor-workspace__zoom" role="group" aria-label="View controls">
          {hasGraphic ? (
            <>
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
            </>
          ) : null}
          <button type="button" className="operator-text-link" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </header>

      {editing ? (
        <section className="operator-card">
          <div className="operator-card__body">
            <div className="engineering-light-form">
              <NodeEditorPanel
                node={selectedNode}
                breadcrumb={breadcrumb}
                floors={floors}
                onSave={(id, form) => {
                  handleSaveNode(id, form);
                  setEditing(false);
                }}
                onDelete={handleDeleteNode}
                onDeleteConfirm={handleDeleteConfirm}
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="operator-card floor-workspace__card">
          <div className={`floor-workspace__canvas${viewZoom > 1 ? " is-zoomed" : ""}`}>
            {hasGraphic ? (
              <DeployedGraphicPreview
                graphic={graphic}
                points={[]}
                onLinkClick={handleGraphicLinkClick}
                presentation={DEPLOYED_GRAPHIC_PRESENTATION.layout}
                onOpenEquipmentDetail={goToEquipment}
                resolveEquipmentLabel={resolveEquipmentLabel}
                resolveEquipment={resolveEquipment}
                pinVariant="operator"
                zoomFactor={viewZoom}
                allowSimulatedFallback={false}
              />
            ) : (
              <div className="floor-workspace__empty">
                No graphic assigned for this {isBuilding ? "building" : "floor"} yet. Create one in Graphics Manager.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
