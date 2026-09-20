import React, { useCallback, useEffect, useRef, useState } from "react";
import { deploymentRepository } from "../../../lib/data";

const STATE_LABELS = {
  UNCOMMISSIONED: "Not commissioned",
  STAGED: "Package staged",
  VALIDATED: "Package validated",
  ACTIVATING: "Activating…",
  ACTIVE: "Active",
  FAILED: "Failed",
  ROLLBACK: "Rolling back…",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function ChangePreviewSummary({ preview }) {
  if (!preview) return null;
  const rows = Object.entries(preview.collections || {}).filter(
    ([, r]) => r.added.length || r.changed.length || r.removed.length || r.preserved.length
  );
  return (
    <div className="ls100-preview">
      <h3>Change preview</h3>
      {rows.length === 0 ? (
        <p className="ls100-muted">No configuration objects detected.</p>
      ) : (
        <table className="ls100-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Added</th>
              <th>Changed</th>
              <th>Removed</th>
              <th>Preserved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, r]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{r.added.length}</td>
                <td>{r.changed.length}</td>
                <td>{r.removed.length}</td>
                <td>{r.preserved.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {preview.unresolved?.length ? (
        <div className="ls100-alert ls100-alert--warning">
          <strong>{preview.unresolved.length} unresolved reference(s)</strong>
          <ul>
            {preview.unresolved.slice(0, 10).map((u, i) => (
              <li key={i}>
                {u.collection} {u.id}: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.preservedByPolicy?.length ? (
        <p className="ls100-muted">
          Always preserved on activation: {preview.preservedByPolicy.join("; ")}.
        </p>
      ) : null}
    </div>
  );
}

export default function Ls100ConsolePanel({ onBack }) {
  const [status, setStatus] = useState(null);
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingRecommission, setConfirmingRecommission] = useState(false);
  const fileInputRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await deploymentRepository.getLs100Status();
      setStatus(s);
    } catch (e) {
      setError(e.message || "Could not load LS-100 status");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const withBusy = useCallback((fn) => async (...args) => {
    setBusy(true);
    setError("");
    try {
      await fn(...args);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleImportFile = withBusy(async (file) => {
    const staged = await deploymentRepository.importPackage(file, "OFFLINE_IMPORT");
    setRecord(staged);
    await refreshStatus();
  });

  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleImportFile(file);
  };

  const handleValidate = withBusy(async () => {
    const validated = await deploymentRepository.validatePackageRecord(record.id);
    setRecord(validated);
  });

  const handleActivate = withBusy(async () => {
    const activated = await deploymentRepository.activatePackageRecord(record.id);
    setRecord(activated);
    await refreshStatus();
  });

  const handleDiscard = withBusy(async () => {
    await deploymentRepository.discardPackageRecord(record.id);
    setRecord(null);
  });

  const handleRollback = withBusy(async () => {
    if (!status?.commissioning?.activeSiteId) return;
    await deploymentRepository.rollbackSite(status.commissioning.activeSiteId);
    await refreshStatus();
  });

  const handleRecommission = withBusy(async () => {
    await deploymentRepository.recommission("Operator-initiated recommissioning");
    setConfirmingRecommission(false);
    setRecord(null);
    await refreshStatus();
  });

  const handleToggleHistory = withBusy(async () => {
    if (!showHistory) {
      const h = await deploymentRepository.getLs100History(status?.commissioning?.activeSiteId);
      setHistory(h);
    }
    setShowHistory((v) => !v);
  });

  if (!status) {
    return (
      <div className="operator-placeholder ls100-console">
        <h1>LS-100 Commissioning</h1>
        <p>Loading commissioning status…</p>
        {onBack ? (
          <button type="button" className="operator-btn" onClick={onBack}>
            Back to Operator Dashboard
          </button>
        ) : null}
      </div>
    );
  }

  const { commissioning, activePackage } = status;
  const uncommissioned = commissioning.state === "UNCOMMISSIONED";

  return (
    <div className="operator-placeholder ls100-console">
      <div className="ls100-console__header">
        <h1>LS-100 Commissioning</h1>
        <span className={`ls100-badge ls100-badge--${commissioning.state.toLowerCase()}`}>
          {STATE_LABELS[commissioning.state] || commissioning.state}
        </span>
      </div>

      {error ? <div className="ls100-alert ls100-alert--error">{error}</div> : null}

      {uncommissioned && !record ? (
        <p>
          No Legion Site commissioned. Connect using the Legion Engineering Workspace or import a
          Legion Site Package.
        </p>
      ) : null}

      {!uncommissioned && !record ? (
        <div className="ls100-summary">
          <dl className="details-grid">
            <div className="details-grid__row">
              <dt>Active Site</dt>
              <dd>{activePackage?.siteName || commissioning.activeSiteId || "—"}</dd>
            </div>
            <div className="details-grid__row">
              <dt>Package version</dt>
              <dd>{activePackage?.packageVersion || "—"}</dd>
            </div>
            <div className="details-grid__row">
              <dt>Activated</dt>
              <dd>{formatDate(activePackage?.activatedAt)}</dd>
            </div>
            <div className="details-grid__row">
              <dt>Source</dt>
              <dd>{activePackage?.source || "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {!record ? (
        <div className="ls100-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".lspkg"
            style={{ display: "none" }}
            onChange={onFileChosen}
          />
          <button
            type="button"
            className="operator-btn operator-btn--primary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Import Site Package…
          </button>
          {!uncommissioned ? (
            <>
              <button type="button" className="operator-btn" disabled={busy} onClick={handleRollback}>
                Roll back to previous version
              </button>
              <button
                type="button"
                className="operator-btn"
                disabled={busy}
                onClick={() => setConfirmingRecommission(true)}
              >
                Recommission (archive this Site)…
              </button>
            </>
          ) : null}
          <button type="button" className="operator-text-link" disabled={busy} onClick={handleToggleHistory}>
            {showHistory ? "Hide history" : "Show deployment history"}
          </button>
        </div>
      ) : null}

      {confirmingRecommission ? (
        <div className="ls100-alert ls100-alert--warning">
          <p>
            This archives the current active Site and clears LS-100 commissioning so a different
            Site's package can be activated. This does not delete history, users, or credentials.
          </p>
          <button type="button" className="operator-btn operator-btn--primary" disabled={busy} onClick={handleRecommission}>
            Confirm recommission
          </button>
          <button type="button" className="operator-btn" disabled={busy} onClick={() => setConfirmingRecommission(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {record ? (
        <div className="ls100-package">
          <h3>
            {record.siteName} — {record.packageVersion}
          </h3>
          <p className="ls100-muted">
            Status: <strong>{record.status}</strong> · Source: {record.source} · Schema v{record.schemaVersion}
          </p>
          {record.manifest?.simulationPackage ? (
            <p className="ls100-alert ls100-alert--warning">Simulation package (dev SIM controllers included).</p>
          ) : null}
          {record.manifest?.signature?.signed === false ? (
            <p className="ls100-muted">Unsigned development package — integrity verified via checksum only.</p>
          ) : null}
          {record.failureReason ? <div className="ls100-alert ls100-alert--error">{record.failureReason}</div> : null}
          {record.changePreview ? <ChangePreviewSummary preview={record.changePreview} /> : null}
          <div className="ls100-actions">
            {record.status === "STAGED" ? (
              <button type="button" className="operator-btn operator-btn--primary" disabled={busy} onClick={handleValidate}>
                Validate
              </button>
            ) : null}
            {record.status === "VALIDATED" ? (
              <button type="button" className="operator-btn operator-btn--primary" disabled={busy} onClick={handleActivate}>
                Activate
              </button>
            ) : null}
            {record.status !== "ACTIVE" ? (
              <button type="button" className="operator-btn" disabled={busy} onClick={handleDiscard}>
                Discard
              </button>
            ) : null}
            <button type="button" className="operator-text-link" disabled={busy} onClick={() => setRecord(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showHistory && history ? (
        <div className="ls100-history">
          <h3>Deployment history</h3>
          <table className="ls100-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Source</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {history.packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.packageVersion}</td>
                  <td>{p.status}</td>
                  <td>{p.source}</td>
                  <td>{formatDate(p.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Audit trail</h3>
          <table className="ls100-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Result</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {history.auditEntries.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.createdAt)}</td>
                  <td>{a.action}</td>
                  <td>{a.result}</td>
                  <td>{a.actor || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {onBack ? (
        <button type="button" className="operator-btn" onClick={onBack}>
          Back to Operator Dashboard
        </button>
      ) : null}
    </div>
  );
}
