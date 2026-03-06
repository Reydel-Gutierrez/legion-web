import React from "react";
import { Card, Button } from '@themesberg/react-bootstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../routes";
import { useState } from "react";
import { Modal } from '@themesberg/react-bootstrap';

export default function Footer({ controllers = 18, devices = "1.42", ...props }) {
  const [showDefault, setShowDefault] = useState(false);
  const handleClose = () => setShowDefault(false);

  return (
    <div>
      <footer className="legion-footer">
        <div className="legion-footer-inner">
          <div className="legion-footer-left d-flex align-items-center gap-3">
            <Link to={Routes.Upgrade.path} className="legion-footer-dev-link">
              <FontAwesomeIcon icon={faArrowRight} className="me-1" />
              Switch to Dev-Mode
            </Link>
            <span className="legion-footer-sep">·</span>
            <span>© 2026 Legion Controls <span className="legion-footer-sep">·</span> BAS Portal</span>
          </div>
          <div className="legion-footer-center">
            Connected controllers · {controllers} <span className="legion-footer-sep">·</span> Devices {devices}
          </div>
          <div className="legion-footer-right">
            <Link to={Routes.LegionDashboard.path}>Legion</Link>
            <span className="legion-footer-sep">·</span>
            <Card.Link as={Button} variant="link" className="p-0 text-white" onClick={() => setShowDefault(true)}>
              Help
            </Card.Link>
            <span className="legion-footer-sep">·</span>
            <Link to={Routes.LegionSettings.path}>Settings</Link>
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
                  Follow your site’s emergency procedures or contact on-call support.
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
};


