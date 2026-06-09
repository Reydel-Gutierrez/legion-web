import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNetworkWired } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion, selectNetworkConfig } from "../../../hooks/useWorkingVersion";
import {
  hasEnabledDiscoveryPaths,
  getMockDiscoveryScanResult,
  flattenDeviceCount,
  flattenDiscoveryTree,
} from "../network/discoveryScan";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import { useTablePagination } from "../../../hooks/useTablePagination";
import { engineeringRepository } from "../../../lib/data";
import { selectSiteTree } from "../../../hooks/useWorkingVersion";
import DiscoveryStatusBanner from "./components/DiscoveryStatusBanner";
import DiscoveryToolbar from "./components/DiscoveryToolbar";
import DiscoveryTable from "./components/DiscoveryTable";
import AssignDevicesModal from "./components/AssignDevicesModal";
import DeviceInspectorDrawer from "./components/DeviceInspectorDrawer";
import EmptyDiscoveryState from "./components/EmptyDiscoveryState";
import NetworkDiscoveryConfigRequiredState from "./components/NetworkDiscoveryConfigRequiredState";
import NoSiteSelectedState from "./components/NoSiteSelectedState";
import ScanStatusArea from "./components/ScanStatusArea";
import AdvancedScanModal from "./components/AdvancedScanModal";
import NoSearchResultsState from "./components/NoSearchResultsState";
import { POINTS_STATUS } from "./components/DeviceInspectorPanel";

// ---------------------------------------------------------------------------
// Helpers: filter flat discovery list (no hierarchy in UI)
// ---------------------------------------------------------------------------
function filterFlatDevices(flatList, query) {
  if (!query || !query.trim()) return flatList;
  const lower = query.trim().toLowerCase();
  const matches = (d) =>
    (d.name || "").toLowerCase().includes(lower) ||
    (d.vendor || "").toLowerCase().includes(lower) ||
    String(d.deviceInstance || "").toLowerCase().includes(lower) ||
    (d.network || "").toLowerCase().includes(lower) ||
    String(d.macOrMstpId || "").toLowerCase().includes(lower);
  return flatList.filter(matches);
}

/** Build path string for equipment assigned to this device (Site / Building / Floor / Equipment). */
function getAssignedEquipmentPath(device, equipmentList, siteTree, siteName) {
  if (!equipmentList?.length || !siteTree) return null;
  const byId =
    device?.assignedEquipmentId &&
    equipmentList.find((e) => e.id === device.assignedEquipmentId);
  const ref = device?.deviceInstance != null ? String(device.deviceInstance) : "";
  const eq =
    byId ||
    (ref
      ? equipmentList.find((e) => String(e.controllerRef || e.deviceInstance || "") === ref)
      : null);
  if (!eq?.floorId) return null;
  let building = "";
  let floor = "";
  for (const b of siteTree.children || []) {
    const f = (b.children || []).find((fl) => fl.id === eq.floorId);
    if (f) {
      building = b.name || "";
      floor = f.name || "";
      break;
    }
  }
  const site = siteTree.name || siteName || "";
  const parts = [site, building, floor, eq.displayLabel || eq.name].filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}

/** Generate mock BACnet objects for MVP (replaced by real discovery later). */
function generateMockDiscoveredObjects(device) {
  const now = "1 min ago";
  return [
    { id: `obj-${device?.id}-1`, objectName: "Zone Temp", objectType: "AI", instance: 3, presentValue: "72.4", units: "°F", lastRead: now },
    { id: `obj-${device?.id}-2`, objectName: "Cooling Setpoint", objectType: "AV", instance: 5, presentValue: "74", units: "°F", lastRead: now },
    { id: `obj-${device?.id}-3`, objectName: "Damper Command", objectType: "AO", instance: 2, presentValue: "45%", units: "%", lastRead: now },
    { id: `obj-${device?.id}-4`, objectName: "Occupancy", objectType: "BI", instance: 1, presentValue: "Active", units: "", lastRead: now },
    { id: `obj-${device?.id}-5`, objectName: "Supply Air Temp", objectType: "AI", instance: 4, presentValue: "55.2", units: "°F", lastRead: now },
  ].map((o) => ({
    ...o,
    objectType: o.objectType,
    bacnetRef: `${o.objectType}-${o.instance}`,
    displayName: o.objectName,
    presentValue: o.presentValue,
    writable: o.objectType === "AV" || o.objectType === "AO",
    sourceDevice: device?.deviceInstance ? `BACnet/IP:${device.deviceInstance}` : null,
    status: "Online",
  }));
}

// ---------------------------------------------------------------------------
// NetworkDiscoveryPage
// ---------------------------------------------------------------------------
export default function NetworkDiscoveryPage() {
  const { site } = useSite();
  const { workingVersion, workingState, actions } = useWorkingVersion();
  /** Avoid listing `actions` on poll effect deps — it can change when working state updates and would re-run the effect + immediate tick() every render. */
  const setDiscoveredForDeviceRef = useRef(actions.setDiscoveredObjectsForDevice);
  setDiscoveredForDeviceRef.current = actions.setDiscoveredObjectsForDevice;
  const networkConfig = selectNetworkConfig(workingVersion);
  const siteTree = selectSiteTree(workingVersion);
  const siteStructure = useMemo(
    () => engineeringRepository.getEngineeringSiteStructureFromTree(siteTree),
    [siteTree]
  );
  const equipmentList = workingState.equipment ?? [];
  const devices = workingState.discoveredDevices ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [activeScanLines, setActiveScanLines] = useState([]);
  const [lastScanLines, setLastScanLines] = useState([]);
  const [showAdvancedScan, setShowAdvancedScan] = useState(false);
  const [inspectorDevice, setInspectorDevice] = useState(null);
  /** Per-device point discovery state: deviceId -> { pointsStatus, lastPointDiscoveryTime } — UI only; objects live in workingState.discoveredObjects */
  const [devicePointDiscoveryMeta, setDevicePointDiscoveryMeta] = useState({});

  const flatDevices = useMemo(() => flattenDiscoveryTree(devices), [devices]);
  const filteredDevices = useMemo(
    () => filterFlatDevices(flatDevices, searchQuery),
    [flatDevices, searchQuery]
  );

  const {
    page,
    setPage,
    pagedRows,
    total,
    totalPages,
    startIndex,
    endIndex,
    pageSize,
    hasPrev,
    hasNext,
  } = useTablePagination(filteredDevices, 10, "discovery", searchQuery);

  const handlePatchDiscoveredDevice = useCallback(
    (deviceId, patch) => {
      actions.patchDiscoveredDevice(deviceId, patch);
      setInspectorDevice((prev) => (prev?.id === deviceId ? { ...prev, ...patch } : prev));
    },
    [actions]
  );

  const toggleSelect = useCallback((device) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(device.id)) next.delete(device.id);
      else next.add(device.id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback((visibleIds, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const includeUnconfigured = networkConfig?.scanDefaults?.includeUnconfiguredProtocols === true;
  const canRunScan = hasEnabledDiscoveryPaths(networkConfig) || includeUnconfigured;

  const runDiscoveryScan = useCallback(
    (scanMode) => {
      if (!canRunScan) return;

      const phaseLabel =
        scanMode === "bacnet_ip"
          ? "BACnet/IP scan — supervisory engine"
          : scanMode === "bacnet_mstp"
          ? "BACnet MS/TP scan — serial trunks"
          : "Scan all — BACnet/IP and MS/TP paths";

      setIsScanning(true);
      setScanPhase(phaseLabel);
      setLastScanLines([]);
      const preview = getMockDiscoveryScanResult({ siteName: site, scanMode, networkConfig });
      setActiveScanLines(preview.scanLines || []);

      window.setTimeout(() => {
        const { devices, scanLines, statusSummary } = getMockDiscoveryScanResult({
          siteName: site,
          scanMode,
          networkConfig,
        });
        actions.setDiscoveredDevices(devices);
        const count = flattenDeviceCount(devices);
        const summaryLine =
          statusSummary !== "ok"
            ? count === 0
              ? "No devices returned for this scan."
              : `${count} device(s) (partial / filtered).`
            : `${count} device(s) in result tree.`;

        setActiveScanLines([]);
        setLastScanLines([...(scanLines || []), summaryLine]);
        setScanPhase("");
        setIsScanning(false);
      }, 1500);
    },
    [actions, canRunScan, networkConfig, site]
  );

  const handleScanNetwork = useCallback(() => runDiscoveryScan("all"), [runDiscoveryScan]);
  const handleScanBacnetIp = useCallback(() => runDiscoveryScan("bacnet_ip"), [runDiscoveryScan]);
  const handleScanMstp = useCallback(() => runDiscoveryScan("bacnet_mstp"), [runDiscoveryScan]);

  const handleRefreshDiscovery = useCallback(() => {
    if (!canRunScan) return;
    const next = getMockDiscoveryScanResult({
      siteName: site,
      scanMode: "all",
      networkConfig,
    }).devices;
    actions.setDiscoveredDevices(next);
  }, [actions, canRunScan, networkConfig, site]);

  const handleAssign = useCallback((payload) => {
    console.log("Assign devices:", payload);
    setShowAssignModal(false);
    setSelectedIds(new Set());
  }, []);

  const handleAssignFromBanner = useCallback(() => {
    setShowAssignModal(true);
  }, []);

  const handleViewDevice = useCallback((device) => {
    setInspectorDevice(device);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectorDevice(null);
  }, []);

  const handleDiscoverPoints = useCallback(
    async (deviceId) => {
      const device = inspectorDevice;
      if (!device) return;
      const key = String(device.deviceInstance ?? deviceId);
      const discoveredObjects = generateMockDiscoveredObjects(device);
      setDiscoveredForDeviceRef.current(key, discoveredObjects);
      setDevicePointDiscoveryMeta((prev) => ({
        ...prev,
        [deviceId]: {
          pointsStatus: POINTS_STATUS.DISCOVERED,
          lastPointDiscoveryTime: new Date().toLocaleString(),
        },
      }));
    },
    [inspectorDevice]
  );

  const handleRefreshPoints = useCallback(
    async (deviceId) => {
      const device = inspectorDevice;
      if (!device) return;
      const key = String(device.deviceInstance ?? deviceId);
      const discoveredObjects = generateMockDiscoveredObjects(device);
      setDiscoveredForDeviceRef.current(key, discoveredObjects);
      setDevicePointDiscoveryMeta((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          pointsStatus: POINTS_STATUS.DISCOVERED,
          lastPointDiscoveryTime: new Date().toLocaleString(),
        },
      }));
    },
    [inspectorDevice]
  );

  const isNewBuilding = engineeringRepository.isNewEngineeringBuildingFlow(site);
  const hasNoSite = isNewBuilding && !workingState?.site;
  const inspectorPointDiscovery = inspectorDevice
    ? (() => {
        const meta = devicePointDiscoveryMeta[inspectorDevice.id] ?? null;
        const key = String(inspectorDevice.deviceInstance ?? inspectorDevice.id);
        const discoveredObjects = (workingState.discoveredObjects || {})[key] ?? [];
        return meta
          ? { ...meta, discoveredObjects }
          : discoveredObjects.length > 0
          ? { pointsStatus: POINTS_STATUS.DISCOVERED, lastPointDiscoveryTime: null, discoveredObjects }
          : null;
      })()
    : null;
  const assignedEquipmentPath = useMemo(
    () =>
      inspectorDevice
        ? getAssignedEquipmentPath(inspectorDevice, equipmentList, siteTree, site)
        : null,
    [inspectorDevice, equipmentList, siteTree, site]
  );

  if (hasNoSite) {
    return (
      <>
        <div className="px-3 px-md-4 pb-4">
          <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Header className="legion-operator-log-card-header">
              <span className="text-white fw-bold text-uppercase">Network Discovery</span>
            </Card.Header>
            <Card.Body className="p-0">
              <NoSiteSelectedState />
            </Card.Body>
          </Card>
        </div>
      </>
    );
  }

  const hasDevices = devices.length > 0;
  const hasFilteredResults = filteredDevices.length > 0;
  const showConfigRequired = !canRunScan && !hasDevices;

  return (
    <>
      <div className="px-3 px-md-4 pb-4">
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="legion-operator-log-card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold text-uppercase">
              <FontAwesomeIcon icon={faNetworkWired} className="me-2" />
              Network Discovery
            </span>
            <span className="badge bg-primary border border-light border-opacity-25 text-white">
              {total} device{total !== 1 ? "s" : ""} found
            </span>
          </Card.Header>
          <Card.Body>
            <div className="text-white-50 small mb-3">
              Discover BACnet devices on the selected site network and assign them to equipment.
            </div>

            <DiscoveryStatusBanner onAssign={handleAssignFromBanner} onMore={() => {}} />

            <DiscoveryToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              onScanAll={handleScanNetwork}
              onScanBacnetIp={handleScanBacnetIp}
              onScanMstp={handleScanMstp}
              onAdvancedScan={() => setShowAdvancedScan(true)}
              onRefresh={handleRefreshDiscovery}
              onAssign={handleAssignFromBanner}
              isScanning={isScanning}
              canRunScan={canRunScan}
            />

            <ScanStatusArea
              isScanning={isScanning}
              scanPhase={scanPhase}
              lines={isScanning ? activeScanLines : lastScanLines}
              idleHint={
                !isScanning && lastScanLines.length === 0
                  ? canRunScan
                    ? "Scan uses enabled BACnet/IP networks and MS/TP trunks from Network Configuration. Open the split menu for protocol-specific scans."
                    : "Enable at least one network path in Network Configuration, or allow unconfigured protocols in Scan defaults."
                  : null
              }
            />

            <div className="legion-operator-log-table-wrap border border-light border-opacity-10 rounded overflow-hidden mt-3" style={{ minHeight: 400 }}>
            {showConfigRequired ? (
              <NetworkDiscoveryConfigRequiredState />
            ) : !hasDevices ? (
              <EmptyDiscoveryState onScanNetwork={handleScanNetwork} canRunScan={canRunScan} />
            ) : !hasFilteredResults ? (
              <NoSearchResultsState />
            ) : (
              <DiscoveryTable
                devices={flatDevices}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAllOnPage}
                onViewDevice={handleViewDevice}
                pagedRows={pagedRows}
                emptyMessage="No devices match your search."
              />
            )}
            </div>

            {hasDevices && hasFilteredResults && (
              <div className="mt-3">
                <LegionTablePagination
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  total={total}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  pageSize={pageSize}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      <AssignDevicesModal
        show={showAssignModal}
        onHide={() => setShowAssignModal(false)}
        selectedCount={selectedIds.size}
        onAssign={handleAssign}
        siteStructure={siteStructure}
        equipmentOptions={equipmentList.map((e) => ({ value: e.id, label: e.displayLabel || e.name }))}
      />

      <DeviceInspectorDrawer
        open={!!inspectorDevice}
        onClose={handleCloseInspector}
        device={inspectorDevice}
        assignedEquipmentPath={assignedEquipmentPath}
        pointDiscovery={inspectorPointDiscovery}
        onDiscoverPoints={
          inspectorDevice
            ? () => handleDiscoverPoints(inspectorDevice.id)
            : undefined
        }
        onRefreshPoints={
          inspectorDevice
            ? () => handleRefreshPoints(inspectorDevice.id)
            : undefined
        }
        onPatchDevice={handlePatchDiscoveredDevice}
      />

      <AdvancedScanModal show={showAdvancedScan} onHide={() => setShowAdvancedScan(false)} />
    </>
  );
}
