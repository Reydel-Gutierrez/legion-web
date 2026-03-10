import React from "react";
import { Modal, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faObjectGroup } from "@fortawesome/free-solid-svg-icons";

/**
 * Modal to choose between creating an Equipment Template or a Graphic Template.
 * Create Graphic Template can show helper text when no equipment templates exist.
 */
export default function CreateTemplateModal({
  show,
  onHide,
  onCreateEquipmentTemplate,
  onCreateGraphicTemplate,
  hasEquipmentTemplates,
}) {
  const handleCreateEquipment = () => {
    if (typeof onCreateEquipmentTemplate === "function") {
      onCreateEquipmentTemplate();
    }
    onHide();
  };

  const handleCreateGraphic = () => {
    if (!hasEquipmentTemplates) return;
    if (typeof onCreateGraphicTemplate === "function") {
      onCreateGraphicTemplate();
    }
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Create Template</Modal.Title>
        <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={onHide} aria-label="Close">
          <span aria-hidden>×</span>
        </Button>
      </Modal.Header>
      <Modal.Body>
        <p className="text-white-50 small mb-3">
          Choose the type of template to create for this site.
        </p>
        <div className="d-flex flex-column gap-2">
          <Button
            variant="outline-light"
            className="legion-hero-btn legion-hero-btn--secondary d-flex align-items-center justify-content-start text-start py-3"
            onClick={handleCreateEquipment}
          >
            <FontAwesomeIcon icon={faBoxOpen} className="me-3 fa-lg text-white-50" />
            <div>
              <span className="fw-semibold d-block">Create Equipment Template</span>
              <span className="small text-white-50">Define equipment type, points, and defaults.</span>
            </div>
          </Button>
          <Button
            variant="outline-light"
            className="legion-hero-btn legion-hero-btn--secondary d-flex align-items-center justify-content-start text-start py-3"
            disabled={!hasEquipmentTemplates}
            onClick={handleCreateGraphic}
            title={!hasEquipmentTemplates ? "Add an equipment template first." : undefined}
          >
            <FontAwesomeIcon icon={faObjectGroup} className="me-3 fa-lg text-white-50" />
            <div>
              <span className="fw-semibold d-block">Create Graphic Template</span>
              <span className="small text-white-50">
                {hasEquipmentTemplates
                  ? "Create a graphic that binds to an equipment template's points."
                  : "Graphic templates require an equipment template because bindings are based on template points."}
              </span>
            </div>
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button
          size="sm"
          variant="secondary"
          className="legion-hero-btn legion-hero-btn--secondary"
          onClick={onHide}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
