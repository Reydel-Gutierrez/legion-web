import React from "react";
import LegionDrawer from "../../../../components/legion/LegionDrawer";
import EquipmentTemplateEditorPanel from "./EquipmentTemplateEditorPanel";

/** Default max width for the equipment template editor drawer (wider for comfortable editing) */
const EQUIPMENT_DRAWER_MAX_WIDTH = 960;

/**
 * Equipment Template Editor in a right-side drawer.
 * Uses the reusable LegionDrawer so the panel does not cover topbar/footer.
 */
export default function EquipmentTemplateEditorDrawer({
  open,
  onClose,
  template,
  mode = "create",
  graphicOptions = [],
  onSave,
  onDuplicate,
  onSwitchToEdit,
}) {
  return (
    <LegionDrawer
      open={open}
      onClose={onClose}
      maxWidth={EQUIPMENT_DRAWER_MAX_WIDTH}
      panelClassName="bg-primary border-start border-light border-opacity-10"
      ariaLabel="Equipment Template Editor"
    >
      <div className="d-flex flex-column h-100">
        <EquipmentTemplateEditorPanel
          template={template}
          mode={mode}
          graphicOptions={graphicOptions}
          onSave={(payload) => {
            if (typeof onSave === "function") onSave(payload);
            onClose();
          }}
          onCancel={onClose}
          onDuplicate={(duplicatePayload) => {
            if (typeof onDuplicate === "function") onDuplicate(duplicatePayload);
            onClose();
          }}
          onSwitchToEdit={(t) => {
            if (typeof onSwitchToEdit === "function") onSwitchToEdit(t);
          }}
        />
      </div>
    </LegionDrawer>
  );
}
