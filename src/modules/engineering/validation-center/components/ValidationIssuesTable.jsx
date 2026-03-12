import React from "react";
import { Form } from "@themesberg/react-bootstrap";
import { SEVERITY } from "../../../../lib/data/repositories/engineeringRepository";

function SeverityBadge({ severity }) {
  const variant =
    severity === SEVERITY.ERROR ? "danger" : severity === SEVERITY.WARNING ? "warning" : "info";
  const label = severity === SEVERITY.ERROR ? "Error" : severity === SEVERITY.WARNING ? "Warning" : severity;
  return <span className={`badge bg-${variant} validation-severity-badge`}>{label}</span>;
}

export default function ValidationIssuesTable({
  issues,
  selectedId,
  onSelectRow,
  blockingOnly,
}) {
  const rows = blockingOnly
    ? issues.filter((i) => i.severity === SEVERITY.ERROR)
    : issues;

  if (rows.length === 0) {
    return (
      <div className="validation-table-empty py-5 text-center text-white-50">
        <p className="mb-0">No validation issues match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="validation-table-wrap">
      <table className="table validation-table discovery-table">
        <thead>
          <tr>
            <th className="discovery-table-header">Severity</th>
            <th className="discovery-table-header">Category</th>
            <th className="discovery-table-header">Equipment / Device</th>
            <th className="discovery-table-header">Issue</th>
            <th className="discovery-table-header">Related Point / Binding</th>
            <th className="discovery-table-header">Recommended Fix</th>
            <th className="discovery-table-header">Status</th>
            <th className="discovery-table-header discovery-table-header--actions">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((issue) => {
            const isSelected = selectedId === issue.id;
            return (
              <tr
                key={issue.id}
                className={`discovery-table-row ${isSelected ? "discovery-table-row--selected" : ""}`}
                onClick={() => onSelectRow(issue)}
              >
                <td className="discovery-table-cell">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="discovery-table-cell">{issue.category}</td>
                <td className="discovery-table-cell discovery-table-name">{issue.equipmentOrDevice}</td>
                <td className="discovery-table-cell">{issue.issue}</td>
                <td className="discovery-table-cell discovery-table-cell--muted">
                  {issue.relatedPointOrBinding}
                </td>
                <td className="discovery-table-cell small">{issue.recommendedFix}</td>
                <td className="discovery-table-cell">{issue.status}</td>
                <td className="discovery-table-cell discovery-table-cell--actions text-end">
                  <span className="text-white-50 small">{issue.actionLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
