import React from "react";
import { Form, Button, ButtonGroup, Dropdown } from "@themesberg/react-bootstrap";

/**
 * @param {{
 *   equipSearch: string;
 *   onEquipSearchChange: (v: string) => void;
 *   equipmentOptions: { id: string; label: string }[];
 *   selectedEquipmentId: string;
 *   onEquipmentChange: (id: string) => void;
 *   assignedTrends: { id: string; name: string }[];
 *   selectedAssignmentId: string;
 *   onAssignmentSelect: (id: string) => void;
 *   onNewTrend: () => void;
 *   onSaveChanges: () => void;
 *   hasUnsavedDefinitionChanges?: boolean;
 *   definitionIsTemplate?: boolean;
 *   onSaveAsTemplate: () => void;
 *   onAssignTemplate: () => void;
 *   assignTemplateDisabled?: boolean;
 *   assignTemplateTitle?: string;
 *   onDuplicateTrend: () => void;
 *   onEditTrend: () => void;
 *   range: string;
 *   onRangeChange: (r: string) => void;
 *   sessionActive: boolean;
 *   templateEditorMode?: boolean;
 *   templateName?: string;
 *   onExitTemplateEditor?: () => void;
 * }} props
 */
export default function TrendToolbar({
  equipSearch,
  onEquipSearchChange,
  equipmentOptions,
  selectedEquipmentId,
  onEquipmentChange,
  assignedTrends,
  selectedAssignmentId,
  onAssignmentSelect,
  onNewTrend,
  onSaveChanges,
  hasUnsavedDefinitionChanges = false,
  definitionIsTemplate = false,
  onSaveAsTemplate,
  onAssignTemplate,
  assignTemplateDisabled = false,
  assignTemplateTitle,
  onDuplicateTrend,
  onEditTrend,
  range,
  onRangeChange,
  sessionActive,
  templateEditorMode = false,
  templateName = "",
  onExitTemplateEditor,
}) {
  const canEditDefinition = sessionActive || templateEditorMode;
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex flex-wrap align-items-end gap-2 justify-content-between">
        <div className="d-flex flex-wrap gap-2 align-items-end flex-grow-1">
          {templateEditorMode ? (
            <div className="flex-grow-1" style={{ minWidth: 200, maxWidth: 480 }}>
              <Form.Label className="text-white fw-semibold small mb-1">Template editor</Form.Label>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="text-white small">
                  No asset selected — editing <strong>{templateName || "template"}</strong> settings only.
                </span>
                <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={onExitTemplateEditor}>
                  Back to asset trends
                </Button>
              </div>
            </div>
          ) : (
            <>
          <div className="flex-grow-1" style={{ minWidth: 160, maxWidth: 320 }}>
            <Form.Label className="text-white fw-semibold small mb-1">Search / select asset</Form.Label>
            <Form.Control
              size="sm"
              value={equipSearch}
              onChange={(e) => onEquipSearchChange(e.target.value)}
              placeholder="Search equipment or device…"
              className="bg-primary text-white border border-light border-opacity-10"
            />
          </div>
          <div className="flex-grow-1" style={{ minWidth: 180, maxWidth: 320 }}>
            <Form.Label className="text-white fw-semibold small mb-1">Asset</Form.Label>
            <Form.Select
              size="sm"
              value={selectedEquipmentId}
              onChange={(e) => onEquipmentChange(e.target.value)}
              className="bg-primary text-white border border-light border-opacity-10"
            >
              <option value="">— Select asset —</option>
              {equipmentOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Form.Select>
          </div>
            </>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Button size="sm" variant="light" className="text-primary fw-semibold" onClick={onNewTrend} disabled={!selectedEquipmentId || templateEditorMode}>
            New Trend
          </Button>
          <Button
            size="sm"
            variant={hasUnsavedDefinitionChanges ? "warning" : "outline-light"}
            className={hasUnsavedDefinitionChanges ? "text-dark fw-semibold" : "border-opacity-10"}
            onClick={onSaveChanges}
            disabled={!canEditDefinition}
            title={hasUnsavedDefinitionChanges ? "You have unsaved changes for this trend" : undefined}
          >
            Save Changes
          </Button>
          <Button
            size="sm"
            variant={hasUnsavedDefinitionChanges ? "warning" : "outline-light"}
            className={hasUnsavedDefinitionChanges ? "text-dark fw-semibold" : "border-opacity-10"}
            onClick={onSaveAsTemplate}
            disabled={!canEditDefinition}
            title={
              hasUnsavedDefinitionChanges
                ? definitionIsTemplate
                  ? "Update the stored template (includes points) — confirm in the dialog"
                  : "Save current configuration as a template (includes points)"
                : undefined
            }
          >
            Save as Template
          </Button>
          <Button
            size="sm"
            variant="outline-light"
            className="border-opacity-10"
            onClick={onAssignTemplate}
            disabled={assignTemplateDisabled || templateEditorMode}
            title={assignTemplateTitle ?? (assignTemplateDisabled ? "Save a template first (Save as Template)" : undefined)}
          >
            Assign Template
          </Button>
          <ButtonGroup>
            <Button size="sm" variant="outline-light" className="border-opacity-10" active={range === "6H"} disabled={!canEditDefinition} onClick={() => onRangeChange("6H")}>
              6H
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-10" active={range === "24H"} disabled={!canEditDefinition} onClick={() => onRangeChange("24H")}>
              24H
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-10" active={range === "7D"} disabled={!canEditDefinition} onClick={() => onRangeChange("7D")}>
              7D
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-10" active={range === "14D"} disabled={!canEditDefinition} onClick={() => onRangeChange("14D")}>
              14D
            </Button>
            <Button size="sm" variant="outline-light" className="border-opacity-10" active={range === "30D"} disabled={!canEditDefinition} onClick={() => onRangeChange("30D")}>
              30D
            </Button>
          </ButtonGroup>
          <Dropdown align="end">
            <Dropdown.Toggle size="sm" variant="outline-light" className="border-opacity-10" id="trend-actions-dropdown" disabled={!canEditDefinition}>
              More
            </Dropdown.Toggle>
            <Dropdown.Menu variant="dark" className="border border-light border-opacity-10">
              <Dropdown.Item onClick={onDuplicateTrend} disabled={templateEditorMode}>
                Duplicate trend
              </Dropdown.Item>
              <Dropdown.Item onClick={onEditTrend}>Edit trend details</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {selectedEquipmentId && !templateEditorMode ? (
        <div>
          <Form.Label className="text-white fw-semibold small mb-1">Assigned trends (this asset)</Form.Label>
          {assignedTrends.length ? (
            <div className="d-flex flex-wrap gap-1">
              {assignedTrends.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={selectedAssignmentId === t.id ? "light" : "outline-light"}
                  className={selectedAssignmentId === t.id ? "text-primary fw-semibold" : "border-opacity-10"}
                  onClick={() => onAssignmentSelect(t.id)}
                >
                  {t.name}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-white small opacity-75">No trends assigned yet — use New Trend or Apply Template.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

