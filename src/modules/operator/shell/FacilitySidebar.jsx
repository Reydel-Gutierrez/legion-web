import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faCog, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import LegionLogo from "../../../components/legion/LegionLogo";
import FacilityTree from "./FacilityTree";
import SidebarUtilityControls from "./SidebarUtilityControls";
import ContextActions from "./ContextActions";
import OperatorHelpModal from "./OperatorHelpModal";

export default function FacilitySidebar({
  tree,
  selectedNode,
  expandedIds,
  onToggleExpand,
  onSelect,
  currentUser,
  onRefresh,
  onCommandPoints,
  contracted,
  onToggleContracted,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <aside className={`facility-sidebar${contracted ? " is-contracted" : ""}`}>
      <div className="facility-sidebar__brand">
        <LegionLogo compact={contracted} />
      </div>

      <nav className="facility-sidebar__tree" aria-label="Site">
        <FacilityTree
          root={tree}
          selectedId={selectedNode?.id}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
        />
      </nav>

      <div className="facility-sidebar__bottom">
        <SidebarUtilityControls
          currentUser={currentUser}
          selectedNode={selectedNode}
          tree={tree}
          onRefresh={onRefresh}
        />
        <ContextActions
          selectedNode={selectedNode}
          currentUser={currentUser}
          onRefresh={onRefresh}
          onCommandPoints={onCommandPoints}
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
          <button
            type="button"
            className="facility-sidebar__collapse"
            aria-label={contracted ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleContracted}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span>Legion Controls</span>
          <span className="facility-sidebar__version">v0.1.0</span>
        </div>
      </div>
      <OperatorHelpModal show={helpOpen} onHide={() => setHelpOpen(false)} />
    </aside>
  );
}
