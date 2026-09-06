import React from "react";
import { ReactComponent as LccLogo } from "../../assets/svgs/LCC-logo.svg";

/**
 * Operator sidebar brand: original LCC mark + LEGION CONTROLS wordmark.
 */
export default function LegionLogo({ className = "", compact = false }) {
  return (
    <div className={`legion-logo ${compact ? "legion-logo--compact" : ""} ${className}`.trim()} aria-label="Legion Controls">
      <LccLogo className="legion-logo__mark" aria-hidden="true" focusable="false" />
      <span className="legion-logo__wordmark">
        <span className="legion-logo__legion">LEGION</span>
        <span className="legion-logo__controls">CONTROLS</span>
      </span>
    </div>
  );
}
