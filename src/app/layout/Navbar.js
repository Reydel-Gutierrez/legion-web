import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCog,
  faIdBadge,
  faSignOutAlt,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import { faUserCircle } from "@fortawesome/free-regular-svg-icons";
import { Row, Col, Nav, Navbar, Dropdown, Container, ListGroup, Button, Modal } from "@themesberg/react-bootstrap";
import { Link, useHistory } from "react-router-dom";
import PageBreadcrumbs from "../../components/ui/PageBreadcrumbs";
import NOTIFICATIONS_DATA from "../../lib/data/notifications";
import { useSite } from "../providers/SiteProvider";
import { useWorkspaceMode } from "../providers/WorkspaceModeProvider";

export default function TopNavbar() {
  const { site } = useSite();
  const { currentMode } = useWorkspaceMode();
  const history = useHistory();
  const [notifications, setNotifications] = useState(NOTIFICATIONS_DATA);
  const [showHelp, setShowHelp] = useState(false);
  const [alarmsMuted, setAlarmsMuted] = useState(false);

  const areNotificationsRead = notifications.every((n) => n.read);
  const markNotificationsAsRead = () =>
    setTimeout(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), 250);

  const [lastSync] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  return (
    <>
      <div className="legion-topbar">
        <Navbar variant="dark" expanded className="legion-topbar-navbar">
          <Container fluid className="legion-topbar-container">
            <div className="d-flex justify-content-between align-items-center w-100">
              {/* Left: breadcrumbs */}
              <div className="legion-topbar-breadcrumb">
                <PageBreadcrumbs />
              </div>

              {/* Right: chips + icons */}
              <div className="d-flex align-items-center gap-2">
                {currentMode === "engineering" && (
                  <span className="legion-topbar-engineering-badge">Engineering</span>
                )}
                <div className="legion-topbar-chips d-none d-md-flex">
                  <span className="legion-topbar-chip">Last sync: {lastSync}</span>
                  <span className="legion-topbar-chip">
                    <span className="legion-topbar-dot" /> Server: Online
                  </span>
                  <span className="legion-topbar-chip">
                    <span className="legion-topbar-dot" /> Comm Health: 98%
                  </span>
                </div>

                <Nav className="align-items-center">
                  {/* Notifications */}
                  <Dropdown as={Nav.Item} onToggle={markNotificationsAsRead} align="end">
                    <Dropdown.Toggle
                      as={Nav.Link}
                      className="legion-topbar-btn legion-topbar-btn--icon"
                      aria-label="Notifications"
                    >
                      <span className="legion-topbar-icon">
                        <FontAwesomeIcon icon={faBell} />
                        {areNotificationsRead ? null : (
                          <span className="legion-topbar-badge unread-notifications" />
                        )}
                      </span>
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="legion-topbar-menu legion-topbar-menu--notifications mt-2 py-0">
                      <div className="legion-topbar-menu-header d-flex align-items-center justify-content-between px-3 py-2">
                        <div className="d-flex flex-column">
                          <span className="legion-topbar-menu-title mb-0">Notifications</span>
                          <small className="text-white-50">
                            {alarmsMuted
                              ? "Alarms muted"
                              : `${notifications.filter((n) => !n.read).length} unread`}
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          <Button
                            size="sm"
                            variant={alarmsMuted ? "outline-warning" : "outline-light"}
                            onClick={() => setAlarmsMuted((prev) => !prev)}
                          >
                            {alarmsMuted ? "Unmute alarms" : "Mute all alarms"}
                          </Button>
                          {!areNotificationsRead && (
                            <Button
                              size="sm"
                              variant="outline-light"
                              onClick={() =>
                                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                              }
                            >
                              Mark all read
                            </Button>
                          )}
                        </div>
                      </div>

                      <ListGroup className="list-group-flush">
                        {notifications.length === 0 ? (
                          <ListGroup.Item className="legion-topbar-menu-item text-center text-white-50">
                            No notifications
                          </ListGroup.Item>
                        ) : (
                          notifications.map((n) => (
                            <ListGroup.Item
                              key={`notification-${n.id}`}
                              action
                              href={n.link}
                              className="legion-topbar-menu-item"
                            >
                              <Row className="align-items-start g-2">
                                <Col className="ps-1">
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <div className="fw-semibold text-white" style={{ fontSize: 12 }}>
                                      {n.sender}
                                    </div>
                                    <small className={n.read ? "text-white-50" : "text-warning"}>
                                      {n.time}
                                    </small>
                                  </div>
                                  <div className="text-white-50" style={{ fontSize: 12 }}>
                                    {n.message}
                                  </div>
                                </Col>
                              </Row>
                            </ListGroup.Item>
                          ))
                        )}

                        <Dropdown.Item className="legion-topbar-menu-footer">
                          View all
                        </Dropdown.Item>
                      </ListGroup>
                    </Dropdown.Menu>
                  </Dropdown>

                  {/* User */}
                  <Dropdown as={Nav.Item} align="end">
                    <Dropdown.Toggle
                      as={Nav.Link}
                      className="legion-topbar-btn legion-topbar-btn--user"
                      aria-label="User menu"
                    >
                      <FontAwesomeIcon icon={faIdBadge} className="me-2" />
                      <span className="legion-topbar-user-name d-none d-lg-inline">
                        Reydel Gutierrez
                      </span>
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="legion-topbar-menu mt-2">
                      <Dropdown.Item as={Link} to="/legion/users" className="fw-bold">
                        <FontAwesomeIcon icon={faUserCircle} className="me-2" /> My Profile
                      </Dropdown.Item>
                      <Dropdown.Item as={Link} to="/legion/settings" className="fw-bold">
                        <FontAwesomeIcon icon={faCog} className="me-2" /> Settings
                      </Dropdown.Item>
                      <Dropdown.Item className="fw-bold" onClick={() => setShowHelp(true)}>
                        <FontAwesomeIcon icon={faUserShield} className="me-2" /> Support
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item
                        className="fw-bold text-danger"
                        onClick={() => history.push("/login")}
                      >
                        <FontAwesomeIcon icon={faSignOutAlt} className="me-2" /> Logout
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </Nav>
              </div>
            </div>
          </Container>
        </Navbar>
      </div>

      <Modal as={Modal.Dialog} centered show={showHelp} onHide={() => setShowHelp(false)}>
        <Modal.Header>
          <Modal.Title className="h6">Legion BAS — Help & Support</Modal.Title>
          <Button variant="close" aria-label="Close" onClick={() => setShowHelp(false)} />
        </Modal.Header>

        <Modal.Body>
          <p className="mb-3">Need help with the Legion Building Automation System portal?</p>
          <ul className="mb-3">
            <li>
              <strong>General Support:</strong>{" "}
              <a href="mailto:support@legioncontrols.com">support@legioncontrols.com</a>
            </li>
            <li>
              <strong>Emergency / Critical Alarms:</strong> Follow your site's emergency procedures
              or contact on-call support.
            </li>
            <li>
              <strong>Business Hours:</strong> Monday–Friday, 8:00 AM – 6:00 PM
            </li>
          </ul>
          <p className="mb-0 text-muted">
            When contacting support, please include the site name, equipment ID (AHU, VAV, FCU,
            etc.), and a brief description of the issue.
          </p>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHelp(false)}>
            I Got It
          </Button>
          <Button variant="link" className="text-gray ms-auto" onClick={() => setShowHelp(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
