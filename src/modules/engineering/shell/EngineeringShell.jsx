import React from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { engineeringRepository } from "../../../lib/data";
import { EngineeringArchiveProvider } from "../../../app/providers/EngineeringArchiveProvider";
import EngineeringFacilitySidebar from "./EngineeringFacilitySidebar";
import EngineeringTopBar from "./EngineeringTopBar";
import CreateSiteModal from "../site-builder/components/CreateSiteModal";
import AddEquipmentModal from "../equipment-builder/components/AddEquipmentModal";
import { EngineeringSiteTreeProvider, useEngineeringSiteTree } from "./EngineeringSiteTreeContext";

function EngineeringSharedModals() {
  const {
    siteTree,
    selectedNode,
    workingState,

    showCreateModal,
    setShowCreateModal,
    handleCreateSite,

    showAddEquipment,
    setShowAddEquipment,
    handleAddEquipment,

    deleteConfirmNode,
    setDeleteConfirmNode,
    handleDeleteNode,

    generateModalField,
    setGenerateModalField,
    generateStartInput,
    setGenerateStartInput,
    generateApplying,
    closeGenerateModal,
    handleApplyBulkGenerate,
  } = useEngineeringSiteTree();

  return (
    <>
      <CreateSiteModal show={showCreateModal} onHide={() => setShowCreateModal(false)} onCreate={handleCreateSite} />

      <AddEquipmentModal
        show={showAddEquipment}
        onHide={() => setShowAddEquipment(false)}
        onCreate={handleAddEquipment}
        siteStructure={engineeringRepository.getEngineeringSiteStructureFromTree(siteTree)}
        defaultBuildingId={selectedNode?.type === "floor" ? selectedNode?.parentId : siteTree?.children?.[0]?.id}
        defaultFloorId={selectedNode?.type === "floor" ? selectedNode?.id : undefined}
        equipmentTemplates={workingState.templates?.equipmentTemplates ?? []}
      />

      <Modal
        centered
        show={generateModalField != null}
        onHide={() => {
          if (!generateApplying) closeGenerateModal();
        }}
        className="engineering-light-form"
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header closeButton={!generateApplying} className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">
            {generateModalField === "instanceNumber"
              ? "Generate instance numbers"
              : generateModalField === "address"
                ? "Generate address numbers"
                : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-warning mb-2">
            Applying will overwrite existing{" "}
            {generateModalField === "instanceNumber" ? "instance numbers" : "address numbers"} for
            every equipment on this site.
          </p>
          <p className="small text-white-50 mb-3">
            Enter a starting value that ends in digits. Each row in site order gets the next number
            (e.g. 350025, then 350026, 350027). Prefix text is kept; only the trailing digits advance.
          </p>
          <Form.Group>
            <Form.Label className="text-white small">Starting value</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={generateStartInput}
              onChange={(e) => setGenerateStartInput(e.target.value)}
              placeholder={generateModalField === "instanceNumber" ? "e.g. 350025" : "e.g. 1001"}
              disabled={generateApplying}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={closeGenerateModal} disabled={generateApplying}>
            Cancel
          </Button>
          <Button
            className="legion-hero-btn legion-hero-btn--primary"
            onClick={handleApplyBulkGenerate}
            disabled={generateApplying}
          >
            {generateApplying ? "Applying…" : "Apply"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        centered
        show={!!deleteConfirmNode}
        onHide={() => setDeleteConfirmNode(null)}
        className="engineering-light-form"
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
          <Button variant="danger" onClick={() => deleteConfirmNode && handleDeleteNode(deleteConfirmNode.id)}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

/** Shows the quick client-side hierarchy check (Tools → Validate Structure) above whichever workspace view is active. */
function EngineeringValidationToast() {
  const { validationErrors, showValidationToast, setShowValidationToast } = useEngineeringSiteTree();
  if (!showValidationToast) return null;

  return (
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
      <Button size="sm" variant="link" className="text-white-50 p-0 mt-2" onClick={() => setShowValidationToast(false)}>
        Dismiss
      </Button>
    </div>
  );
}

export default function EngineeringShell({ children }) {
  return (
    <EngineeringArchiveProvider>
      <EngineeringSiteTreeProvider>
        <div className="engineering-shell">
          <EngineeringFacilitySidebar />
          <div className="engineering-shell__main">
            <EngineeringTopBar />
            <div className="engineering-shell__workspace">
              <EngineeringValidationToast />
              {children}
            </div>
          </div>
        </div>
        <EngineeringSharedModals />
      </EngineeringSiteTreeProvider>
    </EngineeringArchiveProvider>
  );
}
