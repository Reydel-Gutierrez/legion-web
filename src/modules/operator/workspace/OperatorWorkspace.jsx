import React from "react";
import FloorWorkspace from "./FloorWorkspace";
import EquipmentWorkspace from "./EquipmentWorkspace";
import SiteWorkspace from "./SiteWorkspace";

export default function OperatorWorkspace({
  releaseData,
  loading,
  error,
  tree,
  selectedNode,
  siteKey,
  onSelectNode,
  siteAlarms = [],
}) {
  if (loading && !releaseData) {
    return <div className="operator-placeholder">Loading active deployment…</div>;
  }
  if (error && !releaseData) {
    return (
      <div className="operator-placeholder">
        <h1>Unable to load site</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!tree || !selectedNode) {
    return null;
  }

  if (selectedNode.kind === "equipment") {
    return (
      <EquipmentWorkspace
        releaseData={releaseData}
        tree={tree}
        selectedNode={selectedNode}
        siteKey={siteKey}
        onSelectNode={onSelectNode}
        siteAlarms={siteAlarms}
      />
    );
  }

  if (selectedNode.kind === "floor" || selectedNode.kind === "building") {
    return (
      <FloorWorkspace
        releaseData={releaseData}
        tree={tree}
        selectedNode={selectedNode}
        siteKey={siteKey}
        onSelectNode={onSelectNode}
      />
    );
  }

  return (
    <SiteWorkspace
      releaseData={releaseData}
      tree={tree}
      selectedNode={selectedNode}
      siteKey={siteKey}
      onSelectNode={onSelectNode}
    />
  );
}
