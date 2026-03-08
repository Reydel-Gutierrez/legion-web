import React from "react";
import { Card, Collapse } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { BACNET_OBJECT_TYPES } from "../../data/mockPointMappingData";

function formatValue(obj) {
  if (!obj) return "—";
  const v = obj.presentValue;
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return obj.units ? `${v} ${obj.units}` : String(v);
  return String(v);
}

/**
 * Collapsible panel showing discovered BACnet objects not mapped to any template point.
 */
export default function UnusedObjectsPanel({ discoveredObjects, usedObjectIds, isExpanded, onToggle }) {
  const unused = (discoveredObjects || []).filter((obj) => !(usedObjectIds && usedObjectIds.has(obj.id)));

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm mt-3">
      <Card.Header
        className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between cursor-pointer"
        onClick={onToggle}
        style={{ cursor: "pointer" }}
      >
        <span className="text-white fw-bold">
          Unused Discovered Objects
          <span className="text-white-50 fw-normal ms-2">({unused.length})</span>
        </span>
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="text-white-50 fa-sm"
        />
      </Card.Header>
      <Collapse in={isExpanded}>
        <Card.Body className="p-0">
          {unused.length === 0 ? (
            <div className="p-3 text-center text-white-50 small">
              All discovered objects are mapped.
            </div>
          ) : (
            <div className="unused-objects-table-wrap">
              <table className="table table-sm mb-0 point-mapping-table">
                <thead>
                  <tr>
                    <th className="point-mapping-table-header">BACnet Object</th>
                    <th className="point-mapping-table-header">Object Type</th>
                    <th className="point-mapping-table-header">Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {unused.map((obj) => (
                    <tr key={obj.id} className="point-mapping-table-row">
                      <td className="point-mapping-table-cell">
                        <span className="text-white">{obj.bacnetRef}</span>
                        <div className="text-white-50 small">{obj.displayName}</div>
                      </td>
                      <td className="point-mapping-table-cell text-white-50 small">
                        {BACNET_OBJECT_TYPES[obj.objectType] || obj.objectType}
                      </td>
                      <td className="point-mapping-table-cell text-white-50">
                        {formatValue(obj)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Collapse>
    </Card>
  );
}
