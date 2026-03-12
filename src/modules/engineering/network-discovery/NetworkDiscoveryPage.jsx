import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Container, Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNetworkWired } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useEngineeringDraft } from "../../../hooks/useEngineeringDraft";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import { useTablePagination } from "../../../hooks/useTablePagination";
import { engineeringRepository } from "../../../lib/data";
import { selectSiteTree } from "../../../hooks/useEngineeringDraft";
import DiscoveryStatusBanner from "./components/DiscoveryStatusBanner";
import DiscoveryToolbar from "./components/DiscoveryToolbar";
import DiscoveryTable from "./components/DiscoveryTable";
import AssignDevicesModal from "./components/AssignDevicesModal";
import DeviceInspectorDrawer from "./components/DeviceInspectorDrawer";
import EmptyDiscoveryState from "./components/EmptyDiscoveryState";
import NoSiteSelectedState from "./components/NoSiteSelectedState";
import NoSearchResultsState from "./components/NoSearchResultsState";
import { POINTS_STATUS } from "./components/DeviceInspectorPanel";

// ---------------------------------------------------------------------------
// Helpers: flatten tree to list, then filter (no hierarchy in UI)
// ---------------------------------------------------------------------------
function flattenDiscoveryTree(roots) {
  const out = [];
  function walk(nodes) {
    if (!nodes || !nodes.length) return;
    nodes.forEach((node) => {
      if (node?.id) out.push({ ...node, children: undefined });
      walk(node?.children);
    });
  }
  walk(Array.isArray(roots) ? roots : []);
  return out;
}

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
  if (!device?.deviceInstance || !equipmentList?.length || !siteTree) return null;
  const ref = String(device.deviceInstance);
  const eq = equipmentList.find(
    (e) => String(e.controllerRef || e.deviceInstance || "") === ref
  );
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
  const { draft, actions } = useEngineeringDraft();
  const siteTree = selectSiteTree(draft);
  const siteStructure = useMemo(
    () => engineeringRepository.getEngineeringSiteStructureFromTree(siteTree),
    [siteTree]
  );
  const equipmentList = draft.equipment ?? [];
  const devices = draft.discoveredDevices ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [inspectorDevice, setInspectorDevice] = useState(null);
  /** Per-device point discovery state: deviceId -> { pointsStatus, lastPointDiscoveryTime } — UI only; objects live in draft.discoveredObjects */
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

  const handleScanNetwork = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1500);
  }, []);

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

  const handleDiscoverPoints = useCallback((deviceId) => {
    const device = inspectorDevice;
    if (!device) return;
    const key = String(device.deviceInstance ?? deviceId);
    const discoveredObjects = generateMockDiscoveredObjects(device);
    actions.setDiscoveredObjectsForDevice(key, discoveredObjects);
    setDevicePointDiscoveryMeta((prev) => ({
      ...prev,
      [deviceId]: {
        pointsStatus: POINTS_STATUS.DISCOVERED,
        lastPointDiscoveryTime: new Date().toLocaleString(),
      },
    }));
  }, [inspectorDevice, actions]);

  const handleRefreshPoints = useCallback((deviceId) => {
    const device = inspectorDevice;
    if (!device) return;
    const key = String(device.deviceInstance ?? deviceId);
    const discoveredObjects = generateMockDiscoveredObjects(device);
    actions.setDiscoveredObjectsForDevice(key, discoveredObjects);
    setDevicePointDiscoveryMeta((prev) => ({
      ...prev,
      [deviceId]: {
        ...prev[deviceId],
        pointsStatus: POINTS_STATUS.DISCOVERED,
        lastPointDiscoveryTime: new Date().toLocaleString(),
      },
    }));
  }, [inspectorDevice, actions]);

  const isNewBuilding = engineeringRepository.isNewEngineeringBuildingFlow(site);
  const hasNoSite = isNewBuilding && !draft?.site;
  const inspectorPointDiscovery = inspectorDevice
    ? (() => {
        const meta = devicePointDiscoveryMeta[inspectorDevice.id] ?? null;
        const key = String(inspectorDevice.deviceInstance ?? inspectorDevice.id);
        const discoveredObjects = (draft.discoveredObjects || {})[key] ?? [];
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
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">Network Discovery</h5>
            <div className="text-white-50 small">
              Discover BACnet devices on the selected site network and assign them to equipment.
            </div>
          </div>
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="p-0">
              <NoSiteSelectedState />
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  const hasDevices = devices.length > 0;
  const hasFilteredResults = filteredDevices.length > 0;

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faNetworkWired} className="me-2" />
            Network Discovery
          </h5>
          <div className="text-white-50 small">
            Discover BACnet devices on the selected site network and assign them to equipment.
          </div>
        </div>

        <DiscoveryStatusBanner onAssign={handleAssignFromBanner} onMore={() => {}} />

        <DiscoveryToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onScan={handleScanNetwork}
          onRefresh={() => {}}
          onAssign={handleAssignFromBanner}
          isScanning={isScanning}
        />

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold">Discovered Devices</span>
            <span className="text-white-50 small">
              {total} device{total !== 1 ? "s" : ""} found
            </span>
          </Card.Header>
          <Card.Body className="p-0 overflow-auto" style={{ minHeight: 400 }}>
            {!hasDevices ? (
              <EmptyDiscoveryState onScanNetwork={handleScanNetwork} />
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
          </Card.Body>
          {hasDevices && hasFilteredResults && (
            <Card.Footer className="bg-transparent border-light border-opacity-10">
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
            </Card.Footer>
          )}
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
      />
    </Container>
  );
}
