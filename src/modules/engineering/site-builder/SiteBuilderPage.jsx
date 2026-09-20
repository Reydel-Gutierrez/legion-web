import React from "react";
import EngineeringEquipmentWorkspace from "../shell/EngineeringEquipmentWorkspace";
import EngineeringSiteWorkspace from "../shell/EngineeringSiteWorkspace";
import EngineeringFloorWorkspace from "../shell/EngineeringFloorWorkspace";
import SiteSettingsWorkspace from "../shell/SiteSettingsWorkspace";
import { useEngineeringSiteTree } from "../shell/EngineeringSiteTreeContext";
import { useEngineeringArchive } from "../../../app/providers/EngineeringArchiveProvider";

/**
 * Engineering home view: the workspace-area counterpart to the shared sidebar tree. Selecting a
 * node/equipment in the sidebar populates this card; there is no tree here anymore (see
 * EngineeringFacilitySidebar). Site/Building/Floor selection renders the same workspace views as
 * Operator (EngineeringSiteWorkspace/EngineeringFloorWorkspace) instead of the Site Builder editor —
 * editing is still reachable via the "Edit" toggle on those views.
 */
export default function SiteBuilderPage() {
  const { isEmpty, selectedNode, selectedEquipment, selectedSettingsSection } = useEngineeringSiteTree();
  const { isClosed } = useEngineeringArchive();

  // No archive open, or a freshly-named one with no site yet — stay blank. Building starts from
  // the sidebar's +/-/reorder controls now, not a "Create Site" prompt here.
  if (isClosed || isEmpty) {
    return null;
  }

  if (selectedSettingsSection) {
    return <SiteSettingsWorkspace section={selectedSettingsSection} />;
  }

  if (selectedEquipment) {
    return <EngineeringEquipmentWorkspace />;
  }

  if (selectedNode?.type === "site") {
    return <EngineeringSiteWorkspace />;
  }

  if (selectedNode?.type === "building" || selectedNode?.type === "floor") {
    return <EngineeringFloorWorkspace />;
  }

  return (
    <div className="engineering-light-form">
      <h5 className="text-white fw-bold mb-1">Site Builder</h5>
      <div className="text-white-50 small">Select a building, floor, or equipment from the tree to get started.</div>
    </div>
  );
}
