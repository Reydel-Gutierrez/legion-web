import React from "react";

/**
 * Scan progress / last-run helper text — wire to real job state later.
 */
export default function ScanStatusArea({ isScanning, scanPhase, lines = [], idleHint }) {
  if (isScanning) {
    return (
      <div className="discovery-scan-status rounded border border-light border-opacity-10 bg-dark bg-opacity-25 px-3 py-2 mb-3">
        <div className="text-white-50 small text-uppercase mb-1" style={{ letterSpacing: "0.04em" }}>
          Scan in progress
        </div>
        <div className="text-white small">{scanPhase || "Contacting supervisory engine…"}</div>
        {lines.length > 0 && (
          <ul className="text-white-50 small mb-0 mt-2 ps-3">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (lines && lines.length > 0) {
    return (
      <div className="discovery-scan-status rounded border border-light border-opacity-10 bg-dark bg-opacity-25 px-3 py-2 mb-3">
        <div className="text-white-50 small text-uppercase mb-1" style={{ letterSpacing: "0.04em" }}>
          Last scan
        </div>
        <ul className="text-white-50 small mb-0 ps-3">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (idleHint) {
    return (
      <div className="discovery-scan-status rounded border border-light border-opacity-10 bg-dark bg-opacity-10 px-3 py-2 mb-3">
        <div className="text-white-50 small mb-0">{idleHint}</div>
      </div>
    );
  }

  return null;
}
