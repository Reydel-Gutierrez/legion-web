import React from "react";
import { Card, Form, Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave } from "@fortawesome/free-solid-svg-icons";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import { engineeringRepository } from "../../../../lib/data";

/**
 * Right-side inspector panel for selected point mapping.
 */
export default function PointDetailsPanel({
  equipment,
  templatePoint,
  mappedObject,
  discoveredObjects,
  onAssignObject,
  onClearMapping,
}) {
  const breadcrumb = equipment
    ? `${equipment.site} / ${equipment.building} / ${equipment.floor} / ${equipment.name}`
    : "";

  if (!templatePoint) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center text-white-50 py-5">
          <div className="small">Select a mapping row to view details</div>
        </Card.Body>
      </Card>
    );
  }

  const objectOptions = [
    { value: "", label: "— Unmapped —" },
    ...(discoveredObjects || []).map((obj) => ({
      value: obj.id,
      label: `${obj.bacnetRef} / ${obj.displayName}`,
    })),
  ];

  const handleAssign = (e) => {
    const val = e.target.value;
    if (val && onAssignObject) {
      onAssignObject(templatePoint.id, val);
    } else if (onClearMapping) {
      onClearMapping(templatePoint.id);
    }
  };

  const formatPv = (obj) => {
    if (!obj) return "—";
    const v = obj.presentValue;
    if (v === undefined || v === null) return "—";
    if (typeof v === "number") return obj.units ? `${v} ${obj.units}` : String(v);
    return String(v);
  };

  return (
    <Card className="bg-primary border border-light border-opacity-10 h-100">
      <Card.Header className="bg-transparent border-light border-opacity-10">
        <div className="text-white fw-bold">Point Details</div>
        <div className="text-white-50 small mt-1">{breadcrumb}</div>
      </Card.Header>
      <Card.Body className="overflow-auto">
        {/* Template Point Section */}
        <div className="mb-4">
          <div className="text-white small fw-semibold mb-2">Template Point</div>
          <div className="bg-dark bg-opacity-25 rounded p-3 border border-light border-opacity-10">
            <div className="mb-2">
              <span className="text-white-50 small">Point</span>
              <div className="text-white font-monospace">{templatePoint.key}</div>
            </div>
            <div className="mb-2">
              <span className="text-white-50 small">Point description</span>
              <div className="text-white">{templatePoint.displayName}</div>
            </div>
            <div className="mb-2">
              <span className="text-white-50 small">Command type</span>
              <div className="text-white">{templatePoint.commandType || "none"}</div>
            </div>
            {templatePoint.mappingHint ? (
              <div className="mb-2">
                <span className="text-white-50 small">Mapping hint</span>
                <div className="text-white font-monospace small">{templatePoint.mappingHint}</div>
              </div>
            ) : null}
            <div className="mb-2">
              <span className="text-white-50 small">Expected Object Type</span>
              <div className="text-white">{templatePoint.expectedObjectType}</div>
            </div>
            <div className="mb-2">
              <span className="text-white-50 small">Units</span>
              <div className="text-white">{templatePoint.units || "—"}</div>
            </div>
            <div>
              <span className="text-white-50 small">Description</span>
              <div className="text-white small">{templatePoint.description || "—"}</div>
            </div>
          </div>
        </div>

        {/* Selected BACnet Object Section */}
        <div className="mb-4">
          <div className="text-white small fw-semibold mb-2">Selected BACnet Object</div>
          {mappedObject ? (
            <div className="bg-dark bg-opacity-25 rounded p-3 border border-light border-opacity-10">
              <div className="mb-2">
                <span className="text-white-50 small">BACnet Ref</span>
                <div className="text-white">{mappedObject.bacnetRef}</div>
              </div>
              <div className="mb-2">
                <span className="text-white-50 small">Display Name</span>
                <div className="text-white">{mappedObject.displayName}</div>
              </div>
              <div className="mb-2">
                <span className="text-white-50 small">Object Type</span>
                <div className="text-white">
                  {engineeringRepository.BACNET_OBJECT_TYPES[mappedObject.objectType] || mappedObject.objectType}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-white-50 small">Current Value</span>
                <div className="text-white">{formatPv(mappedObject)}</div>
              </div>
              <div className="mb-2">
                <span className="text-white-50 small">Writable</span>
                <div className="text-white">{mappedObject.writable ? "Yes" : "No"}</div>
              </div>
              <div>
                <span className="text-white-50 small">Device</span>
                <div className="text-white small">{mappedObject.sourceDevice}</div>
              </div>
            </div>
          ) : (
            <div className="text-white-50 small py-2">No BACnet object assigned</div>
          )}
        </div>

        {/* Mapping Controls */}
        <div className="mb-3">
          <div className="text-white small fw-semibold mb-2">Assign Object</div>
          <LegionFormSelect
            size="sm"
            value={mappedObject?.id || ""}
            onChange={handleAssign}
            options={objectOptions}
            placeholder="— Select BACnet object —"
          />
        </div>

        <div className="d-flex gap-2 pt-3 border-top border-light border-opacity-10">
          <Button
            size="sm"
            className="legion-hero-btn legion-hero-btn--secondary"
            onClick={() => onClearMapping && onClearMapping(templatePoint.id)}
            disabled={!mappedObject}
          >
            <FontAwesomeIcon icon={faTimes} className="me-1" />
            Clear Mapping
          </Button>
          <Button size="sm" className="legion-hero-btn legion-hero-btn--primary ms-auto">
            <FontAwesomeIcon icon={faSave} className="me-1" />
            Save Mapping
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
