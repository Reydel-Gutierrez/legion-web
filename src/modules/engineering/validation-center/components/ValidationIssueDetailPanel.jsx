import React from "react";
import { Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
import { SEVERITY } from "../data/mockValidationData";
import { getMockPointMappingRows } from "../data/mockValidationData";

/**
 * Right-side detail panel for a selected validation issue.
 * Shows mapping drilldown (template point -> BACnet) when relevant.
 */
export default function ValidationIssueDetailPanel({
  issue,
  onClose,
  onOpenTarget,
}) {
  if (!issue) return null;

  const severityVariant =
    issue.severity === SEVERITY.ERROR
      ? "danger"
      : issue.severity === SEVERITY.WARNING
      ? "warning"
      : "info";
  const mappingRows = getMockPointMappingRows(issue.equipmentOrDevice);

  const handleOpen = () => {
    if (onOpenTarget) onOpenTarget(issue.actionTarget);
    if (onClose) onClose();
  };

  return (
    <div className="d-flex flex-column h-100 validation-detail-panel">
      <div className="d-flex align-items-center justify-content-between border-bottom border-light border-opacity-10 pb-2 mb-3">
        <h6 className="text-white fw-bold mb-0">Issue details</h6>
        <Button
          variant="link"
          size="sm"
          className="text-white-50 p-0"
          onClick={onClose}
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faTimes} />
        </Button>
      </div>

      <div className="mb-3">
        <span className="text-white-50 small d-block">Severity</span>
        <span className={`badge bg-${severityVariant}`}>{issue.severity}</span>
      </div>
      <div className="mb-3">
        <span className="text-white-50 small d-block">Category</span>
        <span className="text-white">{issue.category}</span>
      </div>
      <div className="mb-3">
        <span className="text-white-50 small d-block">Equipment / Device</span>
        <span className="text-white">{issue.equipmentOrDevice}</span>
      </div>
      <div className="mb-3">
        <span className="text-white-50 small d-block">Issue</span>
        <span className="text-white">{issue.issue}</span>
      </div>
      {issue.relatedPointOrBinding && issue.relatedPointOrBinding !== "—" && (
        <div className="mb-3">
          <span className="text-white-50 small d-block">Related point / binding</span>
          <span className="text-white">{issue.relatedPointOrBinding}</span>
        </div>
      )}
      {issue.templatePoint && (
        <div className="mb-3">
          <span className="text-white-50 small d-block">Template point</span>
          <span className="text-white">{issue.templatePoint}</span>
        </div>
      )}
      {issue.mappedBacnetObject && (
        <div className="mb-3">
          <span className="text-white-50 small d-block">Mapped BACnet object</span>
          <span className="text-white">{issue.mappedBacnetObject}</span>
        </div>
      )}

      <div className="mb-3">
        <span className="text-white-50 small d-block">Why this matters</span>
        <p className="text-white small mb-0">{issue.whyThisMatters}</p>
      </div>
      <div className="mb-3">
        <span className="text-white-50 small d-block">Recommended fix</span>
        <p className="text-white small mb-0">{issue.fixSteps}</p>
      </div>

      {mappingRows.length > 0 && (
        <div className="mb-3">
          <span className="text-white-50 small d-block mb-2">Point mapping (Logical → BACnet)</span>
          <div className="validation-mapping-table border border-light border-opacity-10 rounded overflow-hidden">
            <table className="table table-sm mb-0 bg-dark bg-opacity-25">
              <thead>
                <tr>
                  <th className="border-light border-opacity-10 text-white-50 small">Template point</th>
                  <th className="border-light border-opacity-10 text-white-50 small">Mapped object</th>
                  <th className="border-light border-opacity-10 text-white-50 small">Status</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border-light border-opacity-10 text-white">{row.templatePoint}</td>
                    <td className="border-light border-opacity-10 text-white">{row.bacnetObject}</td>
                    <td className="border-light border-opacity-10">
                      <span
                        className={
                          row.status === "OK"
                            ? "text-success"
                            : row.status.startsWith("Error")
                            ? "text-danger"
                            : "text-warning"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-auto pt-3 border-top border-light border-opacity-10">
        <Button
          size="sm"
          className="legion-hero-btn legion-hero-btn--primary w-100"
          onClick={handleOpen}
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} className="me-1" />
          {issue.actionLabel}
        </Button>
      </div>
    </div>
  );
}
