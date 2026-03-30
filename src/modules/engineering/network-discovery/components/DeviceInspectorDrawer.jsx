import React from "react";
import LegionDrawer from "../../../../components/legion/LegionDrawer";
import DeviceInspectorPanel from "./DeviceInspectorPanel";

/** Same width as Equipment Template Editor for UI consistency */
const DEVICE_INSPECTOR_DRAWER_MAX_WIDTH = 960;

/**
 * Device Inspector in a right-side drawer.
 * Reuses LegionDrawer with same animation, width, and styling as Template Library editor.
 */
export default function DeviceInspectorDrawer({
  open,
  onClose,
  device,
  assignedEquipmentPath,
  pointDiscovery,
  onDiscoverPoints,
  onRefreshPoints,
  onPatchDevice,
}) {
  return (
    <LegionDrawer
      open={open}
      onClose={onClose}
      maxWidth={DEVICE_INSPECTOR_DRAWER_MAX_WIDTH}
      panelClassName="bg-primary border-start border-light border-opacity-10"
      ariaLabel="Device Inspector"
    >
      <div className="d-flex flex-column h-100">
        <DeviceInspectorPanel
          device={device}
          assignedEquipmentPath={assignedEquipmentPath}
          pointDiscovery={pointDiscovery}
          onClose={onClose}
          onDiscoverPoints={onDiscoverPoints}
          onRefreshPoints={onRefreshPoints}
          onPatchDevice={onPatchDevice}
        />
      </div>
    </LegionDrawer>
  );
}
