import React from "react";

/**
 * Summary bar above mapping table: totals, mapped, missing, unused.
 */
export default function MappingSummaryBar({
  totalTemplatePoints,
  requiredPoints,
  mappedRequired,
  missingRequired,
  unusedObjects,
}) {
  return (
    <div className="point-mapping-summary-bar d-flex flex-wrap align-items-center gap-3 py-2 px-3 rounded border border-light border-opacity-10 bg-dark bg-opacity-25 mb-3">
      <span className="text-white small fw-semibold">
        {totalTemplatePoints} Template Point{totalTemplatePoints !== 1 ? "s" : ""}
      </span>
      <span className="text-white-50 small">|</span>
      <span className="text-white-50 small">
        {requiredPoints} Required
      </span>
      <span className="text-white-50 small">|</span>
      <span className="text-success small">
        {mappedRequired} Required Mapped
      </span>
      <span className="text-white-50 small">|</span>
      <span className={missingRequired > 0 ? "text-warning small" : "text-white-50 small"}>
        {missingRequired} Missing
      </span>
      <span className="text-white-50 small">|</span>
      <span className="text-white-50 small">
        {unusedObjects} Unused Object{unusedObjects !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
