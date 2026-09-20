import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsAltV, faPlus, faMinus, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import LegionLogo from "../../../components/legion/LegionLogo";
import FacilityTree from "../../operator/shell/FacilityTree";
import OperatorHelpModal from "../../operator/shell/OperatorHelpModal";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";
import { useEngineeringArchive } from "../../../app/providers/EngineeringArchiveProvider";
import { Routes } from "../../../routes";

/** Reuses Operator's actual FacilitySidebar/FacilityTree markup and classes for pixel parity; only the Add/Remove actions are Engineering-specific. */
export default function EngineeringFacilitySidebar() {
  const {
    facilityTree,
    isEmpty,
    expandedIds,
    selectedFacilityId,
    selectedNode,
    selectedEquipment,
    toggleExpand,
    handleSelectFacilityNode,
    handleAddChild,
    openAddEquipment,
    handleDeleteSelected,
    handleMoveEquipment,
    openCreateModal,
  } = useEngineeringSiteTree();
  const { isClosed } = useEngineeringArchive();
  const navigate = useNavigate();
  const location = useLocation();

  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const canAddFloor = selectedNode?.type === "building";
  const canAddEquipment = selectedNode?.type === "floor";
  const canDelete = Boolean(selectedEquipment) || (selectedNode && selectedNode.type !== "site");

  const handleReorderMove = (floorId, equipmentId, direction) => handleMoveEquipment(equipmentId, direction);

  // Selecting a tree node only updates selection state — it doesn't change the route. On any other
  // Engineering tool page (Manage Archives, Templates, Network Configuration, etc.) that state update
  // has nowhere to render, so the click silently does nothing and the user looks "stuck". Bounce back
  // to the site workspace route whenever a node is picked from elsewhere.
  const homePath = Routes.EngineeringHome.path;
  const builderPath = Routes.EngineeringSiteBuilder.path;
  const goHomeIfElsewhere = () => {
    if (location.pathname !== homePath && location.pathname !== builderPath) {
      navigate(homePath);
    }
  };
  const handleTreeSelect = (node) => {
    handleSelectFacilityNode(node);
    goHomeIfElsewhere();
  };

  return (
    <aside className="facility-sidebar">
      <div className="facility-sidebar__brand">
        <LegionLogo />
      </div>

      <nav className="facility-sidebar__tree" aria-label="Site hierarchy">
        {isClosed || isEmpty ? null : (
          <FacilityTree
            root={facilityTree}
            selectedId={selectedFacilityId}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onSelect={handleTreeSelect}
            reorderMode={reorderMode}
            onMoveEquipment={handleReorderMove}
          />
        )}
      </nav>

      {!isClosed && (
        <div className="facility-sidebar__bottom">
          <div className="sidebar-utils">
            <div className="sidebar-utils__row">
              <button
                type="button"
                className="sidebar-utils__icon"
                title="Add"
                aria-label="Add"
                onClick={() => setAddOpen((v) => !v)}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <button
                type="button"
                className="sidebar-utils__icon"
                title="Remove"
                aria-label="Remove"
                disabled={!canDelete}
                onClick={handleDeleteSelected}
              >
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <button
                type="button"
                className={`sidebar-utils__icon${reorderMode ? " is-active" : ""}`}
                title={reorderMode ? "Done organizing" : "Organize equipment order"}
                aria-label={reorderMode ? "Done organizing equipment order" : "Organize equipment order"}
                aria-pressed={reorderMode}
                onClick={() => setReorderMode((v) => !v)}
              >
                <FontAwesomeIcon icon={faArrowsAltV} />
              </button>
            </div>
            {addOpen ? (
              <ul className="sidebar-utils__menu">
                {isEmpty ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setAddOpen(false);
                        goHomeIfElsewhere();
                        openCreateModal();
                      }}
                    >
                      Create Site
                    </button>
                  </li>
                ) : (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setAddOpen(false);
                          goHomeIfElsewhere();
                          handleAddChild({ type: "site" });
                        }}
                      >
                        Add Building
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={!canAddFloor}
                        onClick={() => {
                          setAddOpen(false);
                          if (canAddFloor) {
                            goHomeIfElsewhere();
                            handleAddChild(selectedNode);
                          }
                        }}
                      >
                        Add Floor
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={!canAddEquipment}
                        onClick={() => {
                          setAddOpen(false);
                          if (canAddEquipment) {
                            goHomeIfElsewhere();
                            openAddEquipment(selectedNode);
                          }
                        }}
                      >
                        Add Equipment
                      </button>
                    </li>
                  </>
                )}
              </ul>
            ) : null}
          </div>

          <div className="facility-sidebar__links">
            <button type="button" className="facility-sidebar__link" onClick={() => setHelpOpen(true)}>
              <FontAwesomeIcon icon={faQuestionCircle} />
              Help
            </button>
          </div>
          <div className="facility-sidebar__footer">
            <span>Legion Controls</span>
            <span className="facility-sidebar__version">v0.1.0</span>
          </div>
        </div>
      )}
      <OperatorHelpModal show={helpOpen} onHide={() => setHelpOpen(false)} />
    </aside>
  );
}
