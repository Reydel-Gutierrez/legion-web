import React from "react";
import { Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook } from "@fortawesome/free-solid-svg-icons";

/**
 * Empty state when the site has no templates yet.
 * Reinforces: Site library = templates used in this job; Global library = standards to import.
 */
export default function EmptyTemplateState({
  onImportFromGlobal,
  onCreateEquipmentTemplate,
  onCreateGraphicTemplate,
  hasEquipmentTemplates,
}) {
  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="text-center py-5 px-4">
        <FontAwesomeIcon icon={faBook} className="fa-3x text-white-50 mb-3 opacity-50" />
        <h5 className="text-white fw-bold mb-2">No templates have been added to this site yet.</h5>
        <p className="text-white-50 mb-4" style={{ maxWidth: 440, margin: "0 auto 1rem" }}>
          Import a standard template from the Legion Global Template Library or create a new one for this job.
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          <button
            type="button"
            className="legion-hero-btn legion-hero-btn--primary"
            onClick={() => typeof onImportFromGlobal === "function" && onImportFromGlobal()}
            style={{ cursor: "pointer" }}
          >
            Import from Global Library
          </button>
          <button
            type="button"
            className="legion-hero-btn legion-hero-btn--secondary"
            onClick={() => typeof onCreateEquipmentTemplate === "function" && onCreateEquipmentTemplate()}
            style={{ cursor: "pointer" }}
          >
            Create Equipment Template
          </button>
          <button
            type="button"
            className="legion-hero-btn legion-hero-btn--secondary"
            disabled={!hasEquipmentTemplates}
            title={!hasEquipmentTemplates ? "Graphic templates require an equipment template." : undefined}
            onClick={() => typeof onCreateGraphicTemplate === "function" && onCreateGraphicTemplate()}
            style={{ cursor: hasEquipmentTemplates ? "pointer" : "not-allowed" }}
          >
            Create Graphic Template
          </button>
        </div>
        {!hasEquipmentTemplates && (
          <p className="text-white-50 small mt-3 mb-0">
            Graphic templates require an equipment template because bindings are based on template points.
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
