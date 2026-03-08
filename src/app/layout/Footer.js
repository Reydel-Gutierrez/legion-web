import React from "react";
import { Card, Button } from '@themesberg/react-bootstrap';
import { Link, useHistory } from 'react-router-dom';
import { Routes } from "../../routes";
import { useState } from "react";
import { Modal } from '@themesberg/react-bootstrap';
import { useWorkspaceMode } from "../providers/WorkspaceModeProvider";

export default function Footer({ controllers = 18, devices = "1.42", ...props }) {
  const { currentMode, setCurrentMode } = useWorkspaceMode();
  const history = useHistory();

  const handleModeSwitch = (mode) => {
    setCurrentMode(mode);
    if (mode === "engineering") {
      history.push(Routes.EngineeringSiteBuilder.path);
    } else {
      history.push(Routes.LegionDashboard.path);
    }
  };
  const [showDefault, setShowDefault] = useState(false);
  const handleClose = () => setShowDefault(false);

  return (
    <div>
      <footer className="legion-footer">
        <div className="legion-footer-inner">
          <div className="legion-footer-left d-flex align-items-center gap-3">
            <span>© 2026 Legion Controls <span className="legion-footer-sep">·</span> BAS Portal</span>
          </div>
          <div className="legion-footer-center">
            Connected controllers · {controllers} <span className="legion-footer-sep">·</span> Devices {devices}
          </div>
          <div className="legion-footer-right d-flex align-items-center gap-3">
            <div className="legion-footer-mode-switch">
              <span className="legion-footer-mode-label">Mode:</span>
              <div className="legion-footer-segmented" role="group">
                <button
                  type="button"
                  className={`legion-footer-segment legion-footer-segment--operator ${currentMode === "operator" ? "active" : ""}`}
                  onClick={() => handleModeSwitch("operator")}
                  aria-pressed={currentMode === "operator"}
                >
                  Operator
                </button>
                <button
                  type="button"
                  className={`legion-footer-segment legion-footer-segment--engineering ${currentMode === "engineering" ? "active" : ""}`}
                  onClick={() => handleModeSwitch("engineering")}
                  aria-pressed={currentMode === "engineering"}
                >
                  Engineering
                </button>
              </div>
            </div>
            <span className="legion-footer-sep d-none d-sm-inline">·</span>
            <Link to={Routes.LegionDashboard.path} className="legion-footer-link">Legion</Link>
            <span className="legion-footer-sep">·</span>
            <button type="button" className="legion-footer-link legion-footer-link--btn" onClick={() => setShowDefault(true)}>
              Help
            </button>
            <span className="legion-footer-sep">·</span>
            <Link to={Routes.LegionSettings.path} className="legion-footer-link">Settings</Link>
          </div>
        </div>
      </footer>
      {/* Modal */}
        <Modal as={Modal.Dialog} centered show={showDefault} onHide={handleClose}>
          <Modal.Header>
            <Modal.Title className="h6">Legion BAS — Help & Support</Modal.Title>
            <Button variant="close" aria-label="Close" onClick={handleClose} />
          </Modal.Header>
            <Modal.Body>
              <p className="mb-3">
                Need help with the Legion Building Automation System portal?
              </p>

              <ul className="mb-3">
                <li>
                  <strong>General Support:</strong>{" "}
                  <a href="mailto:support@legioncontrols.com">
                    support@legioncontrols.com
                  </a>
                </li>
                <li>
                  <strong>Emergency / Critical Alarms:</strong>{" "}
                  Follow your site's emergency procedures or contact on-call support.
                </li>
                <li>
                  <strong>Business Hours:</strong> Monday–Friday, 8:00 AM – 6:00 PM
                </li>
              </ul>

              <p className="mb-0 text-muted">
                When contacting support, please include the site name, equipment ID
                (AHU, VAV, FCU, etc.), and a brief description of the issue.
              </p>
            </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              I Got It
          </Button>
            <Button variant="link" className="text-gray ms-auto" onClick={handleClose}>
              Close
          </Button>
          </Modal.Footer>
        </Modal>
    </div>
  );
}
