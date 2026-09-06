import React from "react";

export default function OperatorHelpModal({ show, onHide }) {
  if (!show) return null;
  return (
    <div className="operator-modal-backdrop" role="presentation" onClick={onHide}>
      <div
        className="operator-modal"
        role="dialog"
        aria-labelledby="operator-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="operator-modal__header">
          <h2 id="operator-help-title">Legion BAS — Help &amp; Support</h2>
          <button type="button" className="operator-modal__close" aria-label="Close" onClick={onHide}>
            ×
          </button>
        </header>
        <div className="operator-modal__body">
          <p>Need help with the Legion Building Automation System portal?</p>
          <ul>
            <li>
              <strong>General Support:</strong>{" "}
              <a href="mailto:support@legioncontrols.com">support@legioncontrols.com</a>
            </li>
            <li>
              <strong>Emergency / Critical Alarms:</strong> Follow your site&apos;s emergency procedures or
              contact on-call support.
            </li>
            <li>
              <strong>Business Hours:</strong> Monday–Friday, 8:00 AM – 6:00 PM
            </li>
          </ul>
          <p>
            When contacting support, include the site name, equipment ID, and a brief description of the
            issue.
          </p>
        </div>
        <footer className="operator-modal__footer">
          <button type="button" className="operator-btn" onClick={onHide}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
