import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt, faMapMarkerAlt, faCopy, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import { Routes } from "../../../../routes";
import { EQUIPMENT_TYPE_OPTIONS } from "../equipmentTypes";
import { engineeringRepository } from "../../../../lib/data";
import { USE_HIERARCHY_API } from "../../../../lib/data/config";
import { flattenDiscoveryTree } from "../../network/discoveryScan";
import { sortEquipmentForDisplay } from "../../site-builder/siteBuilderEquipmentUtils";

/** Legacy demo IDs — only used when not on API-backed projects (local mock sites). */
const LEGACY_MOCK_CONTROLLER_OPTIONS = [
  { value: "43001", label: "BACnet/IP: 43001" },
  { value: "43002", label: "BACnet/IP: 43002" },
  { value: "43020", label: "BACnet/IP: 43020" },
  { value: "43021", label: "BACnet/IP: 43021" },
  { value: "43100", label: "BACnet/IP: 43100" },
];

function buildControllerAssignOptions(discoveredDevices, currentControllerRef, includeLegacyMock) {
  const opts = [{ value: "", label: "Unassigned" }];
  const seen = new Set();
  const flat = flattenDiscoveryTree(discoveredDevices || []);
  flat.forEach((d) => {
    const inst = d?.deviceInstance != null ? String(d.deviceInstance).trim() : "";
    if (!inst || seen.has(inst)) return;
    seen.add(inst);
    const network = (d.network || "BACnet/IP").replace(/\s+/g, " ").trim();
    const nm = (d.name || "").trim();
    const addr = (d.address != null && String(d.address).trim()) ? String(d.address).trim() : "";
    const label = nm
      ? `${network}: ${inst} — ${nm}${addr ? ` · #${addr}` : ""}`
      : `${network}: ${inst}${addr ? ` · #${addr}` : ""}`;
    opts.push({ value: inst, label });
  });
  const cur = currentControllerRef != null ? String(currentControllerRef).trim() : "";
  if (cur && !seen.has(cur)) {
    opts.push({ value: cur, label: `${cur} (not in discovery)` });
  }
  if (includeLegacyMock) {
    LEGACY_MOCK_CONTROLLER_OPTIONS.forEach((o) => {
      if (!seen.has(o.value)) {
        seen.add(o.value);
        opts.push(o);
      }
    });
  }
  return opts;
}

/**
 * Right panel: Edit selected equipment.
 * Template dropdown uses only the current site's templates (working version templates).
 * If no templates have been imported or created for the site, only "Select template" is shown.
 */
/**
 * Current graphic selection value for the dropdown: "template:id" | "graphic:equipmentId" | "".
 */
function getGraphicSelectionValue(equipment, graphics = {}, graphicTemplates = []) {
  if (!equipment?.id) return "";
  const graphic = graphics[equipment.id];
  const templateId = equipment.graphicTemplateId || graphic?.graphicTemplateId;
  if (templateId && graphicTemplates?.length) {
    const template = graphicTemplates.find((t) => t.id === templateId);
    if (template) return `template:${templateId}`;
  }
  if (graphic?.name) return `graphic:${equipment.id}`;
  return "";
}

/**
 * Build dropdown options: "No graphic", then graphic templates, then project graphics (named graphics from other equipments).
 */
function buildGraphicOptions(equipmentId, graphics = {}, graphicTemplates = [], equipmentList = []) {
  const options = [{ value: "", label: "No graphic" }];
  const templateOpts = (graphicTemplates || []).map((t) => ({
    value: `template:${t.id}`,
    label: t.name || t.id || "Unnamed template",
  }));
  if (templateOpts.length) options.push(...templateOpts);
  const equipmentById = (equipmentList || []).reduce((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {});
  const projectGraphicOpts = Object.entries(graphics || {})
    .filter(([eqId, g]) => g && (g.name || "").trim())
    .map(([eqId, g]) => ({
      value: `graphic:${eqId}`,
      label: `${g.name.trim()} (${equipmentById[eqId]?.displayLabel || equipmentById[eqId]?.name || eqId})`,
    }));
  if (projectGraphicOpts.length) options.push(...projectGraphicOpts);
  return options;
}

export default function EquipmentEditorPanel({
  equipment,
  breadcrumb,
  floors,
  onSave,
  onDelete,
  equipmentTemplates = [],
  existingInstanceNumbers = [],
  graphics = {},
  graphicTemplates = [],
  equipmentList = [],
  onGraphicChange,
  discoveredDevices = [],
  onDuplicateEquipment,
  onMoveEquipment,
}) {
  const [form, setForm] = useState({
    name: "",
    displayLabel: "",
    equipmentType: "",
    instanceNumber: "",
    controllerRef: "",
    templateName: "",
    floorId: "",
    address: "",
    locationLabel: "",
    notes: "",
  });

  const baseTemplateOptions = equipmentTemplates.map((t) => ({ value: t.name || t.id || "", label: t.name || t.id || "Unnamed" }));
  const hasCurrentInList = !!(equipment?.templateName && baseTemplateOptions.some((o) => o.value === equipment.templateName));
  const instanceConflict =
    !!(form.instanceNumber && existingInstanceNumbers.some((n) => String(n).trim() === String(form.instanceNumber).trim()));
  const templateOptions = [
    { value: "", label: equipmentTemplates.length === 0 ? "No templates — add in Template Library" : "Select template" },
    ...baseTemplateOptions,
    // Keep current selection in list if it was removed from library (e.g. after template delete)
    ...(equipment?.templateName && !hasCurrentInList ? [{ value: equipment.templateName, label: `${equipment.templateName} (not in library)` }] : []),
  ];

  const graphicOptions = buildGraphicOptions(equipment?.id, graphics, graphicTemplates, equipmentList);
  const graphicSelectionValue = getGraphicSelectionValue(equipment, graphics, graphicTemplates);

  const controllerOptions = useMemo(
    () =>
      buildControllerAssignOptions(discoveredDevices, form.controllerRef, !USE_HIERARCHY_API),
    [discoveredDevices, form.controllerRef]
  );

  const floorPeers = useMemo(
    () =>
      equipment?.floorId
        ? sortEquipmentForDisplay((equipmentList || []).filter((e) => e.floorId === equipment.floorId))
        : [],
    [equipmentList, equipment]
  );
  const floorIndex = floorPeers.findIndex((e) => e.id === equipment?.id);
  const canMoveUp = floorIndex > 0;
  const canMoveDown = floorIndex >= 0 && floorIndex < floorPeers.length - 1;

  useEffect(() => {
    if (equipment) {
      setForm({
        name: equipment.name || "",
        displayLabel: equipment.displayLabel || equipment.name || "",
        equipmentType: equipment.type || "",
        instanceNumber: equipment.instanceNumber ?? "",
        controllerRef: equipment.controllerRef || "",
        templateName: equipment.templateName || "",
        floorId: equipment.floorId || "",
        address: equipment.address ?? "",
        locationLabel: equipment.locationLabel || "",
        notes: equipment.notes || "",
      });
    }
  }, [equipment]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleControllerRefChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, controllerRef: value };
      const inst = String(value || "").trim();
      if (!String(prev.address || "").trim() && inst) {
        const flat = flattenDiscoveryTree(discoveredDevices || []);
        const dev = flat.find((d) => String(d.deviceInstance ?? "").trim() === inst);
        if (dev?.address) next.address = String(dev.address);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (onSave && equipment) {
      onSave(equipment.id, form);
    }
  };

  const handleDelete = () => {
    if (onDelete && equipment) {
      onDelete(equipment.id);
    }
  };

  if (!equipment) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center text-white-50 py-5">
          <div className="small">Select equipment to edit.</div>
        </Card.Body>
      </Card>
    );
  }

  const STATUSES = engineeringRepository.EQUIPMENT_STATUSES || {};
  const statusLabel = STATUSES[equipment.status] || equipment.status || "Draft";

  return (
    <Card className="bg-primary border border-light border-opacity-10 align-self-start">
      <Card.Header className="bg-transparent border-light border-opacity-10">
        <div className="text-white fw-bold">Edit Equipment</div>
        <div className="text-white-50 small mt-1">{breadcrumb || equipment.name}</div>
      </Card.Header>
      <Card.Body className="d-flex flex-column">
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Name</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Equipment name"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Display Label</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.displayLabel}
              onChange={(e) => handleChange("displayLabel", e.target.value)}
              placeholder="Display label"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Equipment Type</Form.Label>
            <LegionFormSelect
              size="sm"
              value={form.equipmentType}
              onChange={(e) => handleChange("equipmentType", e.target.value)}
              options={EQUIPMENT_TYPE_OPTIONS}
              placeholder="Select type..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Address #</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Equipment address # for mapping"
            />
            <Form.Text className="text-white-50 small">
              Enter the address # for this equipment. If the controller has an address in Network Discovery, choosing that
              controller fills this when empty.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Instance Number</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.instanceNumber}
              onChange={(e) => handleChange("instanceNumber", e.target.value)}
              placeholder="e.g. 1001 or VAV-2-01 (unique per site)"
              title="Unique identifier for this equipment; used in operator detail view and URLs."
            />
            {instanceConflict && (
              <Form.Text className="text-warning small">Instance number already in use by another equipment.</Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Assign Controller</Form.Label>
            <LegionFormSelect
              size="sm"
              value={form.controllerRef || ""}
              onChange={(e) => handleControllerRefChange(e.target.value)}
              options={controllerOptions}
              placeholder="Unassigned"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Template</Form.Label>
            <LegionFormSelect
              size="sm"
              value={form.templateName || ""}
              onChange={(e) => handleChange("templateName", e.target.value)}
              options={templateOptions}
              placeholder={equipmentTemplates.length === 0 ? "Add templates in Template Library" : "Select template"}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Graphic</Form.Label>
            <LegionFormSelect
              size="sm"
              value={graphicSelectionValue}
              onChange={(e) => onGraphicChange?.(equipment.id, e.target.value)}
              options={graphicOptions}
              placeholder="Select graphic template or project graphic"
              title="Graphic templates from Template Library or graphics built and named in Graphics Manager"
            />
            <Form.Text className="text-white-50 small">
              Choose a graphic template (from Template Library) or a graphic created for another equipment in this project.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Status</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-50 border border-light border-opacity-10 text-white-50"
              value={statusLabel}
              readOnly
              disabled
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Floor</Form.Label>
            <LegionFormSelect
              size="sm"
              value={form.floorId}
              onChange={(e) => handleChange("floorId", e.target.value)}
              options={[{ value: "", label: "Select floor" }, ...(floors || []).map((f) => ({ value: f.id, label: f.name }))]}
              placeholder="Select floor"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Location (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.locationLabel}
              onChange={(e) => handleChange("locationLabel", e.target.value)}
              placeholder="e.g. North zone, mechanical room"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </Form.Group>
        </Form>

        <div className="d-flex flex-column gap-2 mt-auto pt-3 border-top border-light border-opacity-10">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {onDuplicateEquipment && (
              <Button
                type="button"
                size="sm"
                variant="outline-light"
                className="border-opacity-25"
                onClick={() => onDuplicateEquipment(equipment.id)}
              >
                <FontAwesomeIcon icon={faCopy} className="me-1" />
                Duplicate
              </Button>
            )}
            {onMoveEquipment && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-light"
                  className="border-opacity-25"
                  disabled={!canMoveUp}
                  title="Move up in floor list"
                  onClick={() => onMoveEquipment(-1)}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-light"
                  className="border-opacity-25"
                  disabled={!canMoveDown}
                  title="Move down in floor list"
                  onClick={() => onMoveEquipment(1)}
                >
                  <FontAwesomeIcon icon={faArrowDown} />
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            as={Link}
            to={`${Routes.EngineeringPointMapping.path}?equipmentId=${equipment.id}`}
            className="legion-hero-btn legion-hero-btn--secondary w-100"
            disabled={!form.controllerRef || !form.templateName}
            title={!form.controllerRef || !form.templateName ? "Assign a controller and template first" : ""}
          >
            <FontAwesomeIcon icon={faMapMarkerAlt} className="me-1" />
            Map Points
          </Button>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="outline-danger"
              className="border-opacity-25"
              onClick={handleDelete}
            >
              <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
              Delete Equipment
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary ms-auto"
              onClick={handleSave}
              disabled={instanceConflict}
              title={instanceConflict ? "Resolve duplicate instance number first" : undefined}
            >
              Save Node
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
