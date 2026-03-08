import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Container, Row, Col, Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import {
  getTemplatePoints,
  getDiscoveredObjects,
  autoMapPoints,
  DEFAULT_MAPPING_EQUIPMENT,
  MAPPING_STATUSES,
} from "../data/mockPointMappingData";
import {
  getMockEquipmentForSite,
  getMockSiteTree,
  enrichEquipmentForPointMapping,
  isNewBuildingFlow,
} from "../data/mockEngineeringData";
import MappingContextCard from "./components/MappingContextCard";
import MappingSummaryBar from "./components/MappingSummaryBar";
import MappingToolbar from "./components/MappingToolbar";
import PointMappingTable from "./components/PointMappingTable";
import PointDetailsPanel from "./components/PointDetailsPanel";
import UnusedObjectsPanel from "./components/UnusedObjectsPanel";

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------
function NoControllerState() {
  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-5 text-center">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="fa-3x text-white-50 mb-3 opacity-50" />
        <h6 className="text-white mb-2">No controller assigned</h6>
        <p className="text-white-50 small mb-0">
          Assign a device to this equipment in Site Builder before mapping points.
        </p>
      </Card.Body>
    </Card>
  );
}

function NoTemplateState() {
  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-5 text-center">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="fa-3x text-white-50 mb-3 opacity-50" />
        <h6 className="text-white mb-2">No template selected</h6>
        <p className="text-white-50 small mb-0">
          Select a point template for this equipment in Site Builder first.
        </p>
      </Card.Body>
    </Card>
  );
}

function NoDiscoveredObjectsState() {
  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-5 text-center">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="fa-3x text-white-50 mb-3 opacity-50" />
        <h6 className="text-white mb-2">No discovered points available</h6>
        <p className="text-white-50 small mb-0">
          No BACnet objects have been discovered for this device. Run network discovery or refresh the controller.
        </p>
      </Card.Body>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PointMappingPage
// ---------------------------------------------------------------------------
function parseEquipmentIdFromSearch(search) {
  const params = new URLSearchParams(search);
  return params.get("equipmentId") || null;
}

export default function PointMappingPage() {
  const { site } = useSite();
  const location = useLocation();
  const equipmentIdFromUrl = parseEquipmentIdFromSearch(location.search);

  const siteTree = useMemo(() => getMockSiteTree(site), [site]);
  const equipmentList = useMemo(() => {
    const raw = getMockEquipmentForSite(site) || [];
    return enrichEquipmentForPointMapping(raw, siteTree, site);
  }, [site, siteTree]);

  const [equipment, setEquipment] = useState(null);
  const [mappings, setMappings] = useState({});
  const [autoMappedIds, setAutoMappedIds] = useState(new Set());
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [unusedExpanded, setUnusedExpanded] = useState(false);

  // Initialize equipment from URL or pick first mappable
  useEffect(() => {
    if (!equipmentList?.length) {
      setEquipment(DEFAULT_MAPPING_EQUIPMENT);
      return;
    }
    if (equipmentIdFromUrl) {
      const found = equipmentList.find((eq) => eq.id === equipmentIdFromUrl);
      setEquipment(found || equipmentList[0]);
      return;
    }
    const mappable = equipmentList.filter((eq) => eq.controllerRef && eq.templateName);
    const preferred = mappable.length > 0 ? mappable[0] : equipmentList[0];
    setEquipment((prev) => {
      if (!prev) return preferred;
      if (!equipmentList.some((eq) => eq.id === prev.id)) return preferred;
      return prev;
    });
  }, [equipmentIdFromUrl, equipmentList]);

  // When user selects different equipment from dropdown, reset mapping state
  const handleSelectEquipment = useCallback((id) => {
    const found = equipmentList.find((eq) => eq.id === id);
    setEquipment(found || null);
    setMappings({});
    setAutoMappedIds(new Set());
    setSelectedPointId(null);
  }, [equipmentList]);

  const templatePoints = useMemo(
    () => getTemplatePoints(equipment?.templateName),
    [equipment?.templateName]
  );
  const discoveredObjects = useMemo(
    () => getDiscoveredObjects(equipment?.controllerRef),
    [equipment?.controllerRef]
  );

  const mappingStatuses = useMemo(() => {
    const statuses = {};
    (templatePoints || []).forEach((tp) => {
      const mapId = mappings[tp.id];
      if (mapId) {
        statuses[tp.id] = autoMappedIds.has(tp.id) ? MAPPING_STATUSES.AUTO_MAPPED : MAPPING_STATUSES.MAPPED;
      } else {
        statuses[tp.id] = tp.required ? MAPPING_STATUSES.MISSING : MAPPING_STATUSES.OPTIONAL_UNMAPPED;
      }
    });
    return statuses;
  }, [mappings, autoMappedIds, templatePoints]);

  const summary = useMemo(() => {
    const total = templatePoints?.length || 0;
    const required = (templatePoints || []).filter((tp) => tp.required).length;
    const mappedRequired = (templatePoints || [])
      .filter((tp) => tp.required && mappings[tp.id])
      .length;
    const missingRequired = required - mappedRequired;
    const usedIds = new Set(Object.values(mappings).filter(Boolean));
    const unused = (discoveredObjects || []).filter((o) => !usedIds.has(o.id)).length;
    return { total, required, mappedRequired, missingRequired, unused };
  }, [templatePoints, mappings, discoveredObjects]);

  const selectedPoint = useMemo(
    () => templatePoints?.find((tp) => tp.id === selectedPointId) || null,
    [templatePoints, selectedPointId]
  );
  const selectedMappedObject = useMemo(() => {
    const mapId = mappings[selectedPointId];
    return mapId ? discoveredObjects?.find((o) => o.id === mapId) : null;
  }, [mappings, selectedPointId, discoveredObjects]);

  const usedObjectIds = useMemo(
    () => new Set(Object.values(mappings).filter(Boolean)),
    [mappings]
  );

  const handleAssignObject = useCallback((pointId, objectId) => {
    setMappings((prev) => ({ ...prev, [pointId]: objectId }));
    setAutoMappedIds((prev) => {
      const next = new Set(prev);
      next.delete(pointId);
      return next;
    });
  }, []);

  const handleClearMapping = useCallback((pointId) => {
    setMappings((prev) => {
      const next = { ...prev };
      delete next[pointId];
      return next;
    });
    setAutoMappedIds((prev) => {
      const next = new Set(prev);
      next.delete(pointId);
      return next;
    });
  }, []);

  const handleAutoMap = useCallback(() => {
    const newMappings = autoMapPoints(templatePoints, discoveredObjects, mappings);
    const newAutoIds = new Set();
    Object.keys(newMappings).forEach((tpId) => {
      if (newMappings[tpId] && !mappings[tpId]) {
        newAutoIds.add(tpId);
      }
    });
    setMappings((prev) => ({ ...prev, ...newMappings }));
    setAutoMappedIds((prev) => new Set([...prev, ...newAutoIds]));
  }, [templatePoints, discoveredObjects, mappings]);

  const handleClearUnmapped = useCallback(() => {
    setAutoMappedIds(new Set());
  }, []);

  const isNewBuilding = isNewBuildingFlow(site);
  const hasController = !!(equipment?.controllerRef && String(equipment.controllerRef).trim());
  const hasTemplate = !!(equipment?.templateName && String(equipment.templateName).trim());
  const hasDiscovered = (discoveredObjects || []).length > 0;

  if (isNewBuilding) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              Point Mapping
            </h5>
            <div className="text-white-50 small">
              Map template-defined equipment points to discovered BACnet objects from the assigned controller.
            </div>
          </div>
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="py-5 text-center text-white-50">
              Select a site to get started.
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  if (!hasController) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              Point Mapping
            </h5>
            <div className="text-white-50 small">
              Map template-defined equipment points to discovered BACnet objects from the assigned controller.
            </div>
          </div>
          <MappingContextCard
            equipment={equipment}
            equipmentList={equipmentList}
            onSelectEquipment={handleSelectEquipment}
          />
          <div className="mt-3">
            <NoControllerState />
          </div>
        </div>
      </Container>
    );
  }

  if (!hasTemplate) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              Point Mapping
            </h5>
            <div className="text-white-50 small">
              Map template-defined equipment points to discovered BACnet objects from the assigned controller.
            </div>
          </div>
          <MappingContextCard
            equipment={equipment}
            equipmentList={equipmentList}
            onSelectEquipment={handleSelectEquipment}
          />
          <div className="mt-3">
            <NoTemplateState />
          </div>
        </div>
      </Container>
    );
  }

  if (!hasDiscovered) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <div className="mb-3">
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              Point Mapping
            </h5>
            <div className="text-white-50 small">
              Map template-defined equipment points to discovered BACnet objects from the assigned controller.
            </div>
          </div>
          <MappingContextCard
            equipment={equipment}
            equipmentList={equipmentList}
            onSelectEquipment={handleSelectEquipment}
          />
          <div className="mt-3">
            <NoDiscoveredObjectsState />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
            Point Mapping
          </h5>
          <div className="text-white-50 small">
            Map template-defined equipment points to discovered BACnet objects from the assigned controller.
          </div>
        </div>

        <MappingContextCard
            equipment={equipment}
            equipmentList={equipmentList}
            onSelectEquipment={handleSelectEquipment}
          />

        <MappingSummaryBar
          totalTemplatePoints={summary.total}
          requiredPoints={summary.required}
          mappedRequired={summary.mappedRequired}
          missingRequired={summary.missingRequired}
          unusedObjects={summary.unused}
        />

        <MappingToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onAutoMap={handleAutoMap}
          onValidate={() => {}}
          onClearUnmapped={handleClearUnmapped}
          onSaveDraft={() => {}}
          filterValue={filterValue}
          onFilterChange={setFilterValue}
          onShowUnused={() => setUnusedExpanded(true)}
          onExpandAll={() => {}}
          onCollapseAll={() => {}}
        />

        <Row className="g-3 align-items-start">
          <Col xs={12} lg={8} xl={9}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Header className="bg-transparent border-light border-opacity-10">
                <span className="text-white fw-bold">Point Mapping</span>
              </Card.Header>
              <Card.Body className="p-0 overflow-auto" style={{ minHeight: 400 }}>
                <PointMappingTable
                  templatePoints={templatePoints}
                  discoveredObjects={discoveredObjects}
                  mappings={mappings}
                  mappingStatuses={mappingStatuses}
                  autoMappedIds={autoMappedIds}
                  selectedPointId={selectedPointId}
                  onSelectPoint={setSelectedPointId}
                  onAssignObject={handleAssignObject}
                  onClearMapping={handleClearMapping}
                  searchQuery={searchQuery}
                  filterValue={filterValue}
                />
              </Card.Body>
            </Card>

            <UnusedObjectsPanel
              discoveredObjects={discoveredObjects}
              usedObjectIds={usedObjectIds}
              isExpanded={unusedExpanded}
              onToggle={() => setUnusedExpanded((v) => !v)}
            />
          </Col>

          <Col xs={12} lg={4} xl={3} className="align-self-start">
            <PointDetailsPanel
              equipment={equipment}
              templatePoint={selectedPoint}
              mappedObject={selectedMappedObject}
              discoveredObjects={discoveredObjects}
              onAssignObject={handleAssignObject}
              onClearMapping={handleClearMapping}
            />
          </Col>
        </Row>
      </div>
    </Container>
  );
}
