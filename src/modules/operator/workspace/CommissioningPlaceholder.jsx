import React from "react";

export default function CommissioningPlaceholder({ onBack }) {
  return (
    <div className="operator-placeholder">
      <h1>Commissioning Dashboard</h1>
      <p>
        Commissioning is not part of this Operator redesign. Use Engineering tools for discovery,
        mapping, and deployment. This selector is shown only to roles that already have engineering
        access.
      </p>
      <button type="button" className="operator-btn operator-btn--primary" onClick={onBack}>
        Back to Operator Dashboard
      </button>
    </div>
  );
}
