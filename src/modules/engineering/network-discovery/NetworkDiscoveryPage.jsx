import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Container, Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNetworkWired } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import { useTablePagination } from "../../../hooks/useTablePagination";
import {
  getMockDiscoveryForSite,
  getMockSiteTree,
  getMockEquipmentForSite,
  treeToSiteStructure,
  isNewBuildingFlow,
} from "../data/mockEngineeringData";
import DiscoveryStatusBanner from "./components/DiscoveryStatusBanner";
import DiscoveryToolbar from "./components/DiscoveryToolbar";
import DiscoveryTable from "./components/DiscoveryTable";
import AssignDevicesModal from "./components/AssignDevicesModal";
import EmptyDiscoveryState from "./components/EmptyDiscoveryState";
import NoSiteSelectedState from "./components/NoSiteSelectedState";
import NoSearchResultsState from "./components/NoSearchResultsState";

// ---------------------------------------------------------------------------
// Helpers: filter tree by search query
// ---------------------------------------------------------------------------
function filterDiscoveryTree(roots, query) {
  if (!query || !query.trim()) return roots;
  const lower = query.trim().toLowerCase();
  const matches = (d) =>
    (d.name || "").toLowerCase().includes(lower) ||
    (d.vendor || "").toLowerCase().includes(lower) ||
    String(d.deviceInstance || "").toLowerCase().includes(lower) ||
    (d.network || "").toLowerCase().includes(lower) ||
    String(d.macOrMstpId || "").toLowerCase().includes(lower);

  function filterNode(node) {
    const childResults = (node.children || []).map(filterNode).filter(Boolean);
    if (matches(node) || childResults.length > 0) {
      return { ...node, children: childResults };
    }
    return null;
  }
  return roots.map(filterNode).filter(Boolean);
}

// ---------------------------------------------------------------------------
// NetworkDiscoveryPage
// ---------------------------------------------------------------------------
export default function NetworkDiscoveryPage() {
  const { site } = useSite();
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const isNewBuilding = isNewBuildingFlow(site);
  const siteTree = useMemo(() => getMockSiteTree(site), [site]);
  const siteStructure = useMemo(() => treeToSiteStructure(siteTree), [siteTree]);
  const equipmentList = useMemo(() => getMockEquipmentForSite(site) || [], [site]);

  // Load discovery data when site changes
  useEffect(() => {
    if (isNewBuilding) {
      setDevices([]);
      setExpandedIds(new Set());
      setSelectedIds(new Set());
      return;
    }
    const data = getMockDiscoveryForSite(site);
    setDevices(Array.isArray(data) ? data : []);
    setExpandedIds(new Set());
    setSelectedIds(new Set());
  }, [site, isNewBuilding]);

  const filteredRoots = useMemo(
    () => filterDiscoveryTree(devices, searchQuery),
    [devices, searchQuery]
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
  } = useTablePagination(filteredRoots, 10, "discovery", searchQuery);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((device) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const collectIds = (d) => {
        if (d?.id) next.add(d.id);
        (d?.children || []).forEach(collectIds);
      };
      const hasId = prev.has(device.id);
      if (hasId) {
        const removeIds = (d) => {
          if (d?.id) next.delete(d.id);
          (d?.children || []).forEach(removeIds);
        };
        removeIds(device);
      } else {
        collectIds(device);
      }
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
      const data = getMockDiscoveryForSite(site);
      setDevices(Array.isArray(data) ? data : []);
      setIsScanning(false);
    }, 1500);
  }, [site]);

  const handleAssign = useCallback((payload) => {
    console.log("Assign devices:", payload);
    setShowAssignModal(false);
    setSelectedIds(new Set());
  }, []);

  const handleAssignFromBanner = useCallback(() => {
    setShowAssignModal(true);
  }, []);

  if (isNewBuilding) {
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
  const hasFilteredResults = filteredRoots.length > 0;

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
          onRefresh={() => setDevices(getMockDiscoveryForSite(site) || [])}
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
                devices={devices}
                expandedIds={expandedIds}
                selectedIds={selectedIds}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAllOnPage}
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
    </Container>
  );
}
