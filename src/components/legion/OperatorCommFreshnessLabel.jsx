import React from "react";
import { getCommFreshnessDotClassName } from "../../lib/operator/statusUtils";

/**
 * LIVE / STALE / OFFLINE indicator: colored dot + optional label.
 *
 * @param {{ status: string, variant?: "tree" | "table", className?: string }} props
 * - tree: dot only (green / soft yellow / red — no text; matches offline rows)
 * - table: "LIVE" / "STALE" / "OFFLINE" next to the dot
 */
export default function OperatorCommFreshnessLabel({ status, variant = "table", className = "" }) {
  if (!status) return null;
  const s = String(status).toUpperCase();
  const label =
    variant === "tree"
      ? null
      : s === "LIVE" || s === "STALE" || s === "OFFLINE"
        ? s
        : null;

  return (
    <span className={`legion-comm-freshness-label ${className}`.trim()}>
      <span className={getCommFreshnessDotClassName(s)} role="presentation" />
      {label ? <span className="legion-comm-freshness-label__text">{label}</span> : null}
    </span>
  );
}
