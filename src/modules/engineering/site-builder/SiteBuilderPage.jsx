import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Card, Button, Dropdown, Modal } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faEllipsisV,
  faFileImport,
  faFileExport,
  faTrashAlt,
  faSitemap,
  faBoxOpen,
  faExpandAlt,
  faCompressAlt,
} from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useEngineeringDraft } from "../../../hooks/useEngineeringDraft";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import SiteTree from "./components/SiteTree";
import NodeEditorPanel from "./components/NodeEditorPanel";
import CreateSiteModal from "./components/CreateSiteModal";
import EmptySiteState from "./components/EmptySiteState";
import AddEquipmentModal from "../equipment-builder/components/AddEquipmentModal";
import { engineeringRepository } from "../../../lib/data";
import { selectSiteTree, siteTreeToDraftSite } from "../../../hooks/useEngineeringDraft";

// ---------------------------------------------------------------------------
// Data helpers: build nested tree from flat structure
// ---------------------------------------------------------------------------
function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function flattenTree(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flattenTree(c, acc));
  return acc;
}

function getBreadcrumb(node, site) {
  if (!node || !site) return "";
  const path = [];
  const flat = flattenTree(site);
  let current = node;
  while (current) {
    path.unshift(current.name);
    const parentId = current.parentId;
    if (!parentId) break;
    current = flat.find((n) => n.id === parentId);
  }
  return path.join(" / ");
}

function getEquipmentBreadcrumb(equipment, siteTree) {
  if (!equipment || !siteTree) return "";
  const floorId = equipment.floorId;
  if (!floorId) return equipment.name || "";
  let floor = null;
  let building = null;
  for (const b of siteTree.children || []) {
    floor = (b.children || []).find((f) => f.id === floorId);
    if (floor) {
      building = b;
      break;
    }
  }
  if (!floor || !building) return equipment.name || "";
  return `${siteTree.name} / ${building.name} / ${floor.name} / ${equipment.name}`;
}

function findNodeById(tree, id) {
  if (!tree || !id) return null;
  if (tree.id === id) return tree;
  for (const child of tree.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function updateNodeInTree(tree, id, updates) {
  if (!tree) return tree;
  if (tree.id === id) return { ...tree, ...updates };
  return {
    ...tree,
    children: (tree.children || []).map((c) => updateNodeInTree(c, id, updates)),
  };
}

function deleteNodeFromTree(tree, id) {
  if (!tree) return tree;
  if (tree.id === id) return null;
  const newChildren = (tree.children || [])
    .map((c) => deleteNodeFromTree(c, id))
    .filter(Boolean);
  return { ...tree, children: newChildren };
}

function treeToFlatData(siteTree) {
  if (!siteTree) return { site: null, buildings: [], floors: [] };
  const site = { id: siteTree.id, name: siteTree.name };
  const buildings = [];
  const floors = [];
  (siteTree.children || []).forEach((b) => {
    buildings.push({ id: b.id, site_id: site.id, name: b.name });
    (b.children || []).forEach((f) => {
      floors.push({ id: f.id, building_id: b.id, name: f.name, sort_order: f.sortOrder ?? 0 });
    });
  });
  return { site, buildings, floors };
}

/** Collect all floor IDs under a tree node (for delete: remove equipment on those floors) */
function collectFloorIdsUnder(node) {
  if (!node) return [];
  if (node.type === "floor") return [node.id];
  const ids = [];
  (node.children || []).forEach((c) => ids.push(...collectFloorIdsUnder(c)));
  return ids;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateStructure(siteTree) {
  const errors = [];
  if (!siteTree) {
    errors.push("Site must exist.");
    return errors;
  }
  const buildings = siteTree.children || [];
  if (buildings.length === 0) {
    errors.push("At least one building is required.");
  }
  const names = new Set();
  buildings.forEach((b) => {
    if (names.has((b.name || "").toLowerCase())) {
      errors.push(`Duplicate building name: ${b.name}`);
    }
    names.add((b.name || "").toLowerCase());
  });
  buildings.forEach((b) => {
    const floorNames = new Set();
    (b.children || []).forEach((f) => {
      if (floorNames.has((f.name || "").toLowerCase())) {
        errors.push(`Duplicate floor name within ${b.name}: ${f.name}`);
      }
      floorNames.add((f.name || "").toLowerCase());
    });
  });
  return errors;
}

// ---------------------------------------------------------------------------
// SiteBuilderPage
// ---------------------------------------------------------------------------
export default function SiteBuilderPage() {
  const { site, setSite } = useSite();
  const { draft, actions } = useEngineeringDraft();
  const siteTree = selectSiteTree(draft);
  const equipmentList = draft.equipment ?? [];

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);

  // Expand all and set selected when draft has a site
  useEffect(() => {
    if (siteTree) {
      const allIds = new Set();
      const collectIds = (n) => {
        if (n?.id) allIds.add(n.id);
        (n?.children || []).forEach(collectIds);
      };
      collectIds(siteTree);
      setExpandedIds(allIds);
      if (!selectedId) setSelectedId(siteTree?.id ?? null);
    }
  }, [siteTree?.id]);

  const selectedNode = siteTree ? findNodeById(siteTree, selectedId) : null;
  const selectedEquipment = equipmentList.find((e) => e.id === selectedEquipmentId) || null;
  const breadcrumb = selectedEquipment
    ? getEquipmentBreadcrumb(selectedEquipment, siteTree)
    : getBreadcrumb(selectedNode, siteTree);

  // No longer load from mock on site change — draft is synced by EngineeringDraftProvider

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateSite = useCallback((data) => {
    const buildingId = generateId();
    const siteId = generateId();
    const building = {
      id: buildingId,
      type: "building",
      name: data.defaultBuildingName || "Building 1",
      parentId: siteId,
      children: [],
    };
    const tree = {
      id: siteId,
      type: "site",
      name: data.name,
      address: data.address,
      description: data.description,
      timezone: data.timezone,
      parentId: null,
      children: [building],
    };
    const newSite = siteTreeToDraftSite(tree);
    if (newSite) actions.setSite(newSite);
    actions.setEquipment([]);
    setExpandedIds(new Set([siteId, buildingId]));
    setSelectedId(buildingId);
    setShowCreateModal(false);
    // Switch current site to the new site name so it becomes "draft 1" in the selector and other pages see it
    if (data.name && typeof setSite === "function") setSite(data.name.trim() || "New Site");
  }, [actions, setSite]);

  const handleAddBuilding = useCallback(() => {
    if (!siteTree || !draft.site) return;
    const id = generateId();
    const building = {
      id,
      type: "building",
      name: `Building ${(siteTree.children || []).length + 1}`,
      parentId: siteTree.id,
      children: [],
    };
    const newTree = { ...siteTree, children: [...(siteTree.children || []), building] };
    const newSite = siteTreeToDraftSite(newTree);
    if (newSite) actions.setSite(newSite);
    setExpandedIds((prev) => new Set([...prev, siteTree.id, id]));
    setSelectedId(id);
  }, [siteTree, draft.site, actions]);

  const handleSaveNode = useCallback((id, form) => {
    if (!siteTree) return;
    const updated = updateNodeInTree(siteTree, id, {
      name: form.name,
      displayLabel: form.displayLabel,
      description: form.description,
      icon: form.icon,
      sortOrder: form.sortOrder,
      siteType: form.siteType,
      timezone: form.timezone,
      address: form.address,
      status: form.status,
      engineeringNotes: form.engineeringNotes,
      buildingType: form.buildingType,
      buildingCode: form.buildingCode,
      floorType: form.floorType,
      occupancyType: form.occupancyType,
    });
    const newSite = siteTreeToDraftSite(updated);
    if (newSite) actions.setSite(newSite);
  }, [siteTree, actions]);

  const handleDeleteNode = useCallback((id) => {
    if (!siteTree) return;
    const node = findNodeById(siteTree, id);
    const deletedFloorIds = node ? collectFloorIdsUnder(node) : [];
    const newTree = deleteNodeFromTree(siteTree, id);
    const newSite = newTree ? siteTreeToDraftSite(newTree) : null;
    if (newSite) actions.setSite(newSite);
    if (deletedFloorIds.length > 0) {
      const newEquipment = (draft.equipment || []).filter((e) => !deletedFloorIds.includes(e.floorId));
      actions.setEquipment(newEquipment);
    }
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmNode(null);
  }, [siteTree, draft.equipment, selectedId, actions]);

  const handleDeleteConfirm = useCallback((node) => {
    setDeleteConfirmNode(node);
  }, []);

  const handleDeleteFromTree = useCallback(
    (node) => {
      if (node?.children?.length) {
        setDeleteConfirmNode(node);
      } else {
        handleDeleteNode(node?.id);
      }
    },
    [handleDeleteNode]
  );

  const handleSelectNode = useCallback((node) => {
    setSelectedId(node?.id ?? null);
    setSelectedEquipmentId(null);
  }, []);

  const handleSelectEquipment = useCallback((equipment) => {
    setSelectedEquipmentId(equipment?.id ?? null);
    setSelectedId(null);
  }, []);

  const handleSaveEquipment = useCallback((id, form) => {
    const hasController = !!(form.controllerRef && String(form.controllerRef).trim());
    const status = hasController ? "CONTROLLER_ASSIGNED" : "MISSING_CONTROLLER";
    const updates = {
      name: form.name,
      displayLabel: form.displayLabel,
      type: form.equipmentType,
      locationLabel: form.locationLabel,
      controllerRef: form.controllerRef ?? null,
      templateName: form.templateName ?? null,
      pointsDefined: form.pointsDefined ?? 0,
      status,
      notes: form.notes ?? "",
    };
    const next = (draft.equipment || []).map((e) => (e.id === id ? { ...e, ...updates } : e));
    actions.setEquipment(next);
  }, [draft.equipment, actions]);

  const handleDeleteEquipment = useCallback((id) => {
    const next = (draft.equipment || []).filter((e) => e.id !== id);
    actions.setEquipment(next);
    setSelectedEquipmentId(null);
  }, [draft.equipment, actions]);

  const handleAddChild = useCallback(
    (node) => {
      if (node?.type === "site") handleAddBuilding();
      else if (node?.type === "building") {
        const id = generateId();
        const floor = {
          id,
          type: "floor",
          name: `Floor ${(node.children || []).length + 1}`,
          parentId: node.id,
          sortOrder: (node.children || []).length,
          children: [],
        };
        const newTree = updateNodeInTree(siteTree, node.id, {
          children: [...(node.children || []), floor],
        });
        const newSite = siteTreeToDraftSite(newTree);
        if (newSite) actions.setSite(newSite);
        setExpandedIds((prev) => new Set([...prev, node.id]));
        setSelectedId(id);
      }
    },
    [handleAddBuilding, siteTree, actions]
  );

  const handleValidate = useCallback(() => {
    const errors = validateStructure(siteTree);
    setValidationErrors(errors);
    setShowValidationToast(true);
  }, [siteTree]);

  const handleAddEquipment = useCallback((data) => {
    if (!selectedNode || selectedNode.type !== "floor") return;
    const floorId = data.floorId || selectedNode.id;
    const hasController = !!(data.controllerRef && String(data.controllerRef).trim());
    const status = hasController ? "CONTROLLER_ASSIGNED" : "MISSING_CONTROLLER";
    const newEq = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      siteId: draft.site?.id,
      floorId,
      name: data.name,
      displayLabel: data.displayLabel || data.name,
      type: data.equipmentType || "CUSTOM",
      locationLabel: "",
      controllerRef: data.controllerRef || null,
      templateName: data.templateName || null,
      pointsDefined: 0,
      status,
      notes: data.notes || "",
    };
    actions.setEquipment([...(draft.equipment || []), newEq]);
    setShowAddEquipment(false);
  }, [selectedNode, draft.site, draft.equipment, actions]);

  const handleExpandAll = useCallback(() => {
    if (!siteTree) return;
    const allIds = new Set();
    const collect = (n) => {
      if (n?.id) allIds.add(n.id);
      (n?.children || []).forEach(collect);
    };
    collect(siteTree);
    setExpandedIds(allIds);
  }, [siteTree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isEmpty = !siteTree;
  const openCreateModal = useCallback(() => setShowCreateModal(true), []);

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">Site Builder</h5>
          <div className="text-white-50 small">
            Define the physical structure of the site including buildings and floors.
          </div>
        </div>

        {showValidationToast && (
          <div
            className={`mb-3 p-3 rounded border ${
              validationErrors.length === 0
                ? "border-success border-opacity-50 bg-success bg-opacity-10"
                : "border-danger border-opacity-50 bg-danger bg-opacity-10"
            }`}
          >
            {validationErrors.length === 0 ? (
              <div className="text-success small fw-semibold">Structure is valid.</div>
            ) : (
              <div>
                <div className="text-danger small fw-semibold mb-2">Validation failed:</div>
                <ul className="mb-0 ps-3 text-white-50 small">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              size="sm"
              variant="link"
              className="text-white-50 p-0 mt-2"
              onClick={() => setShowValidationToast(false)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {isEmpty ? (
          <EmptySiteState onCreateSite={openCreateModal} />
        ) : (
          <>
            <div className="site-builder-toolbar d-flex align-items-center flex-wrap gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={handleValidate}
                >
                  Validate Structure
                </Button>
              </div>
              <div className="site-builder-toolbar-divider" />
              <div className="d-flex align-items-center gap-2">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={handleAddBuilding}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Building
                </Button>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => selectedNode && handleAddChild(selectedNode)}
                  disabled={!selectedNode || selectedNode.type !== "building"}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Floor
                </Button>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => setShowAddEquipment(true)}
                  disabled={!selectedNode || selectedNode.type !== "floor"}
                >
                  <FontAwesomeIcon icon={faBoxOpen} className="me-1" /> Add Equipment
                </Button>
              </div>
              <div className="site-builder-toolbar-divider" />
              <Dropdown>
                <Dropdown.Toggle
                  size="sm"
                  variant="dark"
                  className="legion-hero-btn legion-hero-btn--secondary border border-light border-opacity-15"
                >
                  Actions <FontAwesomeIcon icon={faEllipsisV} className="ms-1" />
                </Dropdown.Toggle>
                <Dropdown.Menu
                  align="end"
                  className="legion-dropdown-menu bg-dark border border-light border-opacity-10"
                >
                  <Dropdown.Item className="text-white" onClick={handleExpandAll}>
                    <FontAwesomeIcon icon={faExpandAlt} className="me-2" /> Expand All
                  </Dropdown.Item>
                  <Dropdown.Item className="text-white" onClick={handleCollapseAll}>
                    <FontAwesomeIcon icon={faCompressAlt} className="me-2" /> Collapse All
                  </Dropdown.Item>
                  <Dropdown.Divider className="border-light border-opacity-10" />
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileImport} className="me-2" /> Import Mock Site
                  </Dropdown.Item>
                  <Dropdown.Item className="text-white">
                    <FontAwesomeIcon icon={faFileExport} className="me-2" /> Export Structure
                  </Dropdown.Item>
                  <Dropdown.Divider className="border-light border-opacity-10" />
                  <Dropdown.Item className="text-danger">
                    <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Delete Site
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span className="text-white-50 small ms-1">
                {!selectedNode
                  ? "Select a node to edit."
                  : selectedNode?.type === "building"
                    ? "Click Edit or select a node to edit."
                    : selectedNode?.type === "site"
                      ? "Add a building to get started."
                      : ""}
              </span>
            </div>

            <Row className="g-3 align-items-start">
              <Col xs={12} lg={8} xl={9}>
                <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                  <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between">
                    <span className="text-white fw-bold">
                      <FontAwesomeIcon icon={faSitemap} className="me-2" />
                      Site Hierarchy
                    </span>
                  </Card.Header>
                  <Card.Body className="p-0 overflow-auto" style={{ minHeight: 320 }}>
                    <SiteTree
                      site={siteTree}
                      expandedIds={expandedIds}
                      selectedId={selectedId}
                      selectedEquipmentId={selectedEquipmentId}
                      onToggleExpand={toggleExpand}
                      onSelect={handleSelectNode}
                      onSelectEquipment={handleSelectEquipment}
                      onAddChild={handleAddChild}
                      onAddEquipment={(node) => {
                        handleSelectNode(node);
                        setShowAddEquipment(true);
                      }}
                      onEdit={(node) => handleSelectNode(node)}
                      onDelete={handleDeleteFromTree}
                    />
                  </Card.Body>
                </Card>
              </Col>

              <Col xs={12} lg={4} xl={3} className="align-self-start site-builder-editor-col">
                <NodeEditorPanel
                  node={selectedEquipment ? null : selectedNode}
                  selectedEquipment={selectedEquipment}
                  breadcrumb={breadcrumb}
                  floors={treeToFlatData(siteTree).floors}
                  onSave={handleSaveNode}
                  onSaveEquipment={handleSaveEquipment}
                  onDelete={handleDeleteNode}
                  onDeleteEquipment={handleDeleteEquipment}
                  onDeleteConfirm={handleDeleteConfirm}
                />
              </Col>
            </Row>
          </>
        )}
      </div>

      <CreateSiteModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onCreate={handleCreateSite}
      />

      <AddEquipmentModal
        show={showAddEquipment}
        onHide={() => setShowAddEquipment(false)}
        onCreate={handleAddEquipment}
        siteStructure={engineeringRepository.getEngineeringSiteStructureFromTree(siteTree)}
        defaultBuildingId={selectedNode?.type === "floor" ? selectedNode?.parentId : siteTree?.children?.[0]?.id}
        defaultFloorId={selectedNode?.type === "floor" ? selectedNode?.id : undefined}
      />

      <Modal
        centered
        show={!!deleteConfirmNode}
        onHide={() => setDeleteConfirmNode(null)}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Delete Node</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This node has children. Deleting it will remove all child nodes. Are you sure?
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={() => setDeleteConfirmNode(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmNode && handleDeleteNode(deleteConfirmNode.id)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
