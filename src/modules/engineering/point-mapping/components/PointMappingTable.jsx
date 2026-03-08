import React from "react";
import { Card } from "@themesberg/react-bootstrap";
import LegionFormSelect from "../../../../components/legion/LegionFormSelect";
import { MAPPING_STATUSES, BACNET_OBJECT_TYPES } from "../../data/mockPointMappingData";

const STATUS_CHIP_CLASS = {
  [MAPPING_STATUSES.MAPPED]: "point-mapping-row-chip point-mapping-row-chip--mapped",
  [MAPPING_STATUSES.AUTO_MAPPED]: "point-mapping-row-chip point-mapping-row-chip--auto-mapped",
  [MAPPING_STATUSES.MISSING]: "point-mapping-row-chip point-mapping-row-chip--missing",
  [MAPPING_STATUSES.OPTIONAL_UNMAPPED]: "point-mapping-row-chip point-mapping-row-chip--optional",
  [MAPPING_STATUSES.TYPE_MISMATCH]: "point-mapping-row-chip point-mapping-row-chip--type-mismatch",
  [MAPPING_STATUSES.DUPLICATE_ASSIGNMENT]: "point-mapping-row-chip point-mapping-row-chip--duplicate",
  [MAPPING_STATUSES.IGNORED]: "point-mapping-row-chip point-mapping-row-chip--ignored",
};

function formatValue(obj) {
  if (!obj) return "—";
  const v = obj.presentValue;
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return obj.units ? `${v}${obj.units}` : String(v);
  return String(v);
}

function PointMappingRow({
  templatePoint,
  mappedObject,
  discoveredObjects,
  mappingStatus,
  isAutoMapped,
  isSelected,
  onSelect,
  onAssignObject,
  onClearMapping,
  usedObjectIds,
}) {
  const objectOptions = [
    { value: "", label: "— Select —" },
    ...discoveredObjects.map((obj) => ({
      value: obj.id,
      label: `${obj.bacnetRef} / ${obj.displayName}`,
    })),
  ];

  const currentValue = mappedObject ? formatValue(mappedObject) : "—";
  const objectTypeLabel = mappedObject ? (BACNET_OBJECT_TYPES[mappedObject.objectType] || mappedObject.objectType) : "—";

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val && onAssignObject) onAssignObject(templatePoint.id, val);
    else if (onClearMapping) onClearMapping(templatePoint.id);
  };

  const chipClass = STATUS_CHIP_CLASS[mappingStatus] || "point-mapping-row-chip point-mapping-row-chip--muted";

  return (
    <tr
      className={`point-mapping-table-row ${isSelected ? "point-mapping-table-row--selected" : ""}`}
      onClick={() => onSelect && onSelect(templatePoint.id)}
    >
      <td className="point-mapping-table-cell">
        <span className="fw-semibold text-white">{templatePoint.displayName}</span>
        <div className="text-white-50 small">{templatePoint.key}</div>
      </td>
      <td className="point-mapping-table-cell text-center">
        {templatePoint.required ? (
          <span className="badge bg-warning text-dark">Yes</span>
        ) : (
          <span className="text-white-50 small">No</span>
        )}
      </td>
      <td className="point-mapping-table-cell">
        <span className="text-white-50 small">{templatePoint.expectedObjectType}</span>
      </td>
      <td className="point-mapping-table-cell" onClick={(e) => e.stopPropagation()}>
        <LegionFormSelect
          size="sm"
          value={mappedObject?.id || ""}
          onChange={handleSelectChange}
          options={objectOptions}
          placeholder="— Select —"
        />
      </td>
      <td className="point-mapping-table-cell text-white-50 small">
        {objectTypeLabel}
      </td>
      <td className="point-mapping-table-cell text-white-50">
        {currentValue}
      </td>
      <td className="point-mapping-table-cell">
        <span className={chipClass}>{mappingStatus}</span>
      </td>
    </tr>
  );
}

/**
 * Main mapping table: template points vs discovered BACnet objects.
 */
export default function PointMappingTable({
  templatePoints,
  discoveredObjects,
  mappings,
  mappingStatuses,
  autoMappedIds,
  selectedPointId,
  onSelectPoint,
  onAssignObject,
  onClearMapping,
  searchQuery,
  filterValue,
}) {
  const filteredPoints = React.useMemo(() => {
    let list = templatePoints || [];
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (tp) =>
          (tp.displayName || "").toLowerCase().includes(q) ||
          (tp.key || "").toLowerCase().includes(q)
      );
    }
    if (filterValue === "required") list = list.filter((tp) => tp.required);
    else if (filterValue === "missing") list = list.filter((tp) => tp.required && !mappings[tp.id]);
    else if (filterValue === "auto_mapped") list = list.filter((tp) => autoMappedIds && autoMappedIds.has(tp.id));
    else if (filterValue === "type_mismatch") list = list.filter((tp) => mappingStatuses[tp.id] === MAPPING_STATUSES.TYPE_MISMATCH);
    return list;
  }, [templatePoints, searchQuery, filterValue, mappings, mappingStatuses, autoMappedIds]);

  if (!templatePoints?.length) {
    return (
      <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
        <Card.Body className="py-5 text-center text-white-50">
          <div className="small">No template points available.</div>
          <div className="small mt-1">Select a template in Site Builder first.</div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="point-mapping-table-wrap">
      <table className="table point-mapping-table">
        <thead>
          <tr>
            <th className="point-mapping-table-header">Template Point</th>
            <th className="point-mapping-table-header text-center">Required</th>
            <th className="point-mapping-table-header">Expected Type</th>
            <th className="point-mapping-table-header">Mapped BACnet Object</th>
            <th className="point-mapping-table-header">Object Type</th>
            <th className="point-mapping-table-header">Current Value</th>
            <th className="point-mapping-table-header">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredPoints.map((tp) => {
            const mappedObjId = mappings[tp.id];
            const mappedObj = mappedObjId
              ? discoveredObjects?.find((o) => o.id === mappedObjId)
              : null;
            const status = mappingStatuses[tp.id] || (mappedObj ? MAPPING_STATUSES.MAPPED : tp.required ? MAPPING_STATUSES.MISSING : MAPPING_STATUSES.OPTIONAL_UNMAPPED);
            return (
              <PointMappingRow
                key={tp.id}
                templatePoint={tp}
                mappedObject={mappedObj}
                discoveredObjects={discoveredObjects || []}
                mappingStatus={status}
                isAutoMapped={status === MAPPING_STATUSES.AUTO_MAPPED}
                isSelected={selectedPointId === tp.id}
                onSelect={onSelectPoint}
                onAssignObject={onAssignObject}
                onClearMapping={onClearMapping}
                usedObjectIds={new Set(Object.values(mappings).filter(Boolean))}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
