import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import LegionLogo from "../../../components/legion/LegionLogo";
import FacilityTree from "./FacilityTree";
import SidebarUtilityControls from "./SidebarUtilityControls";
import OperatorHelpModal from "./OperatorHelpModal";
import { findFacilityNode } from "../../../lib/operator/facilityTree";
import {
  applyEquipmentOrderOverrides,
  loadEquipmentOrderOverrides,
  moveEquipmentIdWithinFloor,
  saveEquipmentOrderOverrides,
} from "../../../lib/operator/equipmentOrderOverrides";

export default function FacilitySidebar({
  tree,
  selectedNode,
  expandedIds,
  onToggleExpand,
  onSelect,
  currentUser,
  onRefresh,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const siteId = tree?.siteId || tree?.id || "default";
  const [orderOverrides, setOrderOverrides] = useState(() => loadEquipmentOrderOverrides(siteId));

  useEffect(() => {
    setOrderOverrides(loadEquipmentOrderOverrides(siteId));
  }, [siteId]);

  const displayTree = useMemo(
    () => applyEquipmentOrderOverrides(tree, orderOverrides),
    [tree, orderOverrides]
  );

  const handleMoveEquipment = (floorId, equipmentId, direction) => {
    const floorNode = findFacilityNode(displayTree, floorId);
    if (!floorNode) return;
    const nextOrder = moveEquipmentIdWithinFloor(floorNode.children, equipmentId, direction);
    if (!nextOrder) return;
    setOrderOverrides((prev) => {
      const next = { ...prev, [floorId]: nextOrder };
      saveEquipmentOrderOverrides(siteId, next);
      return next;
    });
  };

  return (
    <aside className="facility-sidebar">
      <div className="facility-sidebar__brand">
        <LegionLogo />
      </div>

      <nav className="facility-sidebar__tree" aria-label="Site">
        <FacilityTree
          root={displayTree}
          selectedId={selectedNode?.id}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          reorderMode={reorderMode}
          onMoveEquipment={handleMoveEquipment}
        />
      </nav>

      <div className="facility-sidebar__bottom">
        <SidebarUtilityControls
          currentUser={currentUser}
          selectedNode={selectedNode}
          onRefresh={onRefresh}
          reorderMode={reorderMode}
          onToggleReorderMode={() => setReorderMode((v) => !v)}
        />
        <div className="facility-sidebar__links">
          <Link to={Routes.LegionSettings.path} className="facility-sidebar__link">
            <FontAwesomeIcon icon={faCog} />
            Settings
          </Link>
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
      <OperatorHelpModal show={helpOpen} onHide={() => setHelpOpen(false)} />
    </aside>
  );
}
