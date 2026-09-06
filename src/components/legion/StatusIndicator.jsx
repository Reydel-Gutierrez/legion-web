import React from "react";

const TONE_CLASS = {
  LIVE: "ok",
  ONLINE: "ok",
  NORMAL: "ok",
  STALE: "warn",
  WARNING: "warn",
  OFFLINE: "fault",
  FAULT: "fault",
  ALARM: "fault",
  UNKNOWN: "unknown",
  UNBOUND: "unknown",
};

/**
 * Semantic status dot + optional label. Green only for healthy, amber stale, red fault.
 */
export default function StatusIndicator({ status, label, className = "" }) {
  const key = String(status || "UNKNOWN").toUpperCase();
  const tone = TONE_CLASS[key] || "unknown";
  return (
    <span className={`status-indicator status-indicator--${tone} ${className}`.trim()}>
      <span className="status-indicator__dot" aria-hidden="true" />
      {label ? <span className="status-indicator__label">{label}</span> : null}
    </span>
  );
}
