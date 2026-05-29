import React from "react";
import { Button } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList } from "@fortawesome/free-solid-svg-icons";
import LegionDrawer from "../legion/LegionDrawer";
import { LOG_CATEGORY } from "../../lib/app-activity/types";

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function categoryClass(category) {
  switch (category) {
    case LOG_CATEGORY.SUCCESS:
      return "legion-app-log-cat--success";
    case LOG_CATEGORY.ERROR:
      return "legion-app-log-cat--error";
    case LOG_CATEGORY.API:
      return "legion-app-log-cat--api";
    default:
      return "legion-app-log-cat--info";
  }
}

/**
 * @param {{ open: boolean, onClose: () => void, logs: import('../../lib/app-activity/types').AppLogEntry[], onClear: () => void }} props
 */
export default function AppLogsDrawer({ open, onClose, logs, onClear }) {
  return (
    <LegionDrawer open={open} onClose={onClose} maxWidth="480px" ariaLabel="App activity logs" panelClassName="legion-app-logs-drawer">
      <div className="legion-app-logs">
        <div className="legion-app-logs-header">
          <div className="d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faClipboardList} className="text-white-50" />
            <h2 className="legion-app-logs-title mb-0">Logs</h2>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="outline-light" className="legion-app-logs-clear-btn" onClick={onClear}>
              Clear logs
            </Button>
            <button type="button" className="legion-app-logs-close-btn" onClick={onClose} aria-label="Close logs">
              ×
            </button>
          </div>
        </div>
        <p className="legion-app-logs-subtitle">
          Application activity for saves, uploads, deployments, and API communication. Not BAS alarms or equipment status.
        </p>
        <div className="legion-app-logs-list">
          {logs.length === 0 ? (
            <div className="legion-app-logs-empty text-white-50 small">No activity logged yet.</div>
          ) : (
            logs.map((entry) => (
              <article key={entry.id} className="legion-app-log-entry">
                <div className="legion-app-log-entry-meta">
                  <time className="legion-app-log-time" dateTime={new Date(entry.timestamp).toISOString()}>
                    [{formatTime(entry.timestamp)}]
                  </time>
                  <span className={`legion-app-log-cat ${categoryClass(entry.category)}`}>{entry.category}</span>
                  {entry.api?.durationMs != null && (
                    <span className="legion-app-log-duration">{entry.api.durationMs}ms</span>
                  )}
                </div>
                <div className="legion-app-log-message">{entry.message}</div>
                {(entry.meta?.area || entry.meta?.action) && (
                  <div className="legion-app-log-details text-white-50 small">
                    {[entry.meta.area, entry.meta.action].filter(Boolean).join(" · ")}
                  </div>
                )}
                {entry.meta?.details && (
                  <div className="legion-app-log-details text-white-50 small">{entry.meta.details}</div>
                )}
                {entry.api?.error && (
                  <div className="legion-app-log-details text-white-50 small">{entry.api.error}</div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </LegionDrawer>
  );
}
