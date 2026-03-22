import React, { useEffect, useState } from "react";
import { Modal, Form, Button } from "@themesberg/react-bootstrap";

/**
 * @param {{
 *   show: boolean;
 *   mode: "new" | "saveTemplate" | "edit";
 *   initialName: string;
 *   initialAsTemplate: boolean;
 *   initialAssignToAsset?: boolean;
 *   showAssignToAsset?: boolean;
 *   highlightUnsaved?: boolean;
 *   onHide: () => void;
 *   onConfirm: (payload: { name: string; saveAsTemplate: boolean; assignToAsset?: boolean }) => void;
 * }} props
 */
export default function TrendTemplateModal({
  show,
  mode,
  initialName,
  initialAsTemplate,
  initialAssignToAsset = false,
  showAssignToAsset = false,
  highlightUnsaved = false,
  onHide,
  onConfirm,
}) {
  const [name, setName] = useState(initialName);
  const [saveAsTemplate, setSaveAsTemplate] = useState(initialAsTemplate);
  const [assignToAsset, setAssignToAsset] = useState(initialAssignToAsset);

  useEffect(() => {
    if (show) {
      setName(initialName);
      setSaveAsTemplate(initialAsTemplate);
      setAssignToAsset(initialAssignToAsset);
    }
  }, [show, initialName, initialAsTemplate, initialAssignToAsset]);

  const title =
    mode === "new" ? "New trend" : mode === "saveTemplate" ? "Save as template" : "Edit trend";

  const primaryLabel = mode === "new" ? "Start trend" : mode === "saveTemplate" ? "Save template" : "Save";

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header closeButton className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label className="small">Trend name</Form.Label>
          <Form.Control
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-primary text-white border border-light border-opacity-10"
            placeholder="e.g. East zone cooling check"
          />
        </Form.Group>
        {mode === "new" ? (
          <Form.Check
            type="checkbox"
            id="tpl-flag"
            label="Save as reusable template"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="text-white small"
          />
        ) : null}
        {mode === "edit" ? (
          <Form.Check
            type="checkbox"
            id="tpl-flag-edit"
            label="Reusable template"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="text-white small"
          />
        ) : null}
        {mode === "saveTemplate" && showAssignToAsset ? (
          <Form.Check
            type="checkbox"
            id="tpl-assign-asset"
            label="Also assign to current asset"
            checked={assignToAsset}
            onChange={(e) => setAssignToAsset(e.target.checked)}
            className="text-white small mt-2"
          />
        ) : null}
        <div className="text-white small opacity-75 mt-2">
          {mode === "saveTemplate"
            ? "Creates a reusable definition from the current configuration. Assign it later or attach to this asset now."
            : "Templates keep points, ranges, and chart options so you can assign the same setup across many assets."}
        </div>
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button variant="outline-light" className="border-opacity-10" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant={highlightUnsaved ? "warning" : "light"}
          className={highlightUnsaved ? "text-dark fw-semibold" : "text-primary fw-semibold"}
          title={highlightUnsaved ? "Pending changes will be saved when you confirm" : undefined}
          onClick={() =>
            onConfirm({
              name: name.trim() || "Untitled trend",
              saveAsTemplate: mode === "saveTemplate" ? true : saveAsTemplate,
              assignToAsset: mode === "saveTemplate" ? assignToAsset : undefined,
            })
          }
        >
          {primaryLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
