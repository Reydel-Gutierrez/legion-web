import React from "react";
import { locationForFacilityNode } from "../../../lib/operator/operatorSelection";
import { useHistory } from "react-router-dom";
import { getFacilityBreadcrumb } from "../../../lib/operator/facilityTree";

export default function OperatorBreadcrumbs({ tree, selectedNode }) {
  const history = useHistory();
  const crumbs = getFacilityBreadcrumb(tree, selectedNode?.id);
  if (!crumbs.length) return null;

  return (
    <nav className="operator-breadcrumb" aria-label="Hierarchy">
      {crumbs.map((c, i) => (
        <span key={`${c.kind}-${c.id}`} className="operator-breadcrumb__item">
          {i > 0 ? <span className="operator-breadcrumb__sep">›</span> : null}
          {i === crumbs.length - 1 ? (
            <span className="operator-breadcrumb__current">{c.label}</span>
          ) : (
            <button
              type="button"
              className="operator-breadcrumb__link"
              onClick={() => history.push(locationForFacilityNode(c))}
            >
              {c.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
