import React, { useMemo, useState } from "react";
import { useSite } from "../../../components/SiteContext";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  ButtonGroup,
} from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";

export default function SettingsPage() {
  const { site } = useSite();

  // Mock "me" (replace later with /me)
  const me = useMemo(
    () => ({
      displayName: "Reydel Gutierrez",
      username: "reydel",
      email: "reydel@legion.local",
      role: "Engineer",
      sites: ["Miami HQ", "Tampa Demo"],
      lastLogin: "2/22/26 14:03",
    }),
    []
  );

  // UI Preferences
  const [defaultLanding, setDefaultLanding] = useState("Dashboard"); // Dashboard | Equipment | Alarms | Trends | Events
  const [defaultSite, setDefaultSite] = useState(site); // keep in sync with site selector optionally
  const [tableDensity, setTableDensity] = useState("Comfortable"); // Comfortable | Dense
  const [timeFormat, setTimeFormat] = useState("24H"); // 12H | 24H
  const [tempUnits, setTempUnits] = useState("°F"); // °F | °C

  // Notifications
  const [browserNotifications, setBrowserNotifications] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [notifySeverity, setNotifySeverity] = useState("Warning+"); // Critical only | Warning+ | All

  // Simple “unsaved changes” indicator
  const [savedAt, setSavedAt] = useState("2/22/26 14:10");

  const saveMock = () => {
    // later: POST /user/preferences
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setSavedAt(`${m}/${d}/${yy} ${hh}:${mm}`);
  };

  const resetMock = () => {
    setDefaultLanding("Dashboard");
    setDefaultSite(site);
    setTableDensity("Comfortable");
    setTimeFormat("24H");
    setTempUnits("°F");
    setBrowserNotifications(true);
    setSoundAlerts(false);
    setNotifySeverity("Warning+");
  };

  const variantForRole = (role) => {
    if (role === "Admin") return "warning";
    if (role === "Engineer") return "info";
    if (role === "Operator") return "primary";
    return "secondary";
  };

  const serverUrl = "http://legion-server.local"; // mock
  const webVersion = "0.1.0-alpha"; // mock
  const engineStatus = "Connected"; // mock

  return (
    <Container fluid className="px-0">
      {/* HERO / BANNER */}
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      {/* PAGE CONTENT */}
      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h5 className="text-white fw-bold mb-1">Settings</h5>
            <div className="text-white small">
              Personal preferences, notifications, and system info. Site configuration lives in Engineering/Dev Mode.
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Saved: {savedAt}
            </span>
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              onClick={saveMock}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              onClick={resetMock}
            >
              Reset
            </Button>
          </div>
        </div>

        <Row className="g-3">
          {/* Left column */}
          <Col xs={12} lg={6}>
            {/* My Profile */}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="text-white fw-bold">My Profile</div>
                    <div className="text-white fw-semibold" style={{ fontSize: 18 }}>
                      {me.displayName}
                    </div>
                    <div className="text-white">@{me.username}</div>
                    <div className="text-white">{me.email}</div>
                    <div className="text-white small mt-2">Last login: {me.lastLogin}</div>
                  </div>

                  <span className="text-white fw-semibold">{me.role}</span>
                </div>

                <hr className="border-light border-opacity-10 my-3" />

                <Row className="g-2">
                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Display Name
                    </Form.Label>
                    <Form.Control
                      defaultValue={me.displayName}
                      className="bg-dark text-white border border-light border-opacity-10"
                    />
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Email (read-only)
                    </Form.Label>
                    <Form.Control
                      value={me.email}
                      readOnly
                      className="bg-dark text-white border border-light border-opacity-10"
                    />
                  </Col>
                </Row>

                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    Change Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    Log out
                  </Button>
                </div>
              </Card.Body>
            </Card>

            {/* UI Preferences */}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <div className="text-white fw-bold mb-2">UI Preferences</div>

                <Row className="g-2">
                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Default Landing Page
                    </Form.Label>
                    <Form.Select
                      value={defaultLanding}
                      onChange={(e) => setDefaultLanding(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>Dashboard</option>
                      <option>Equipment</option>
                      <option>Alarms</option>
                      <option>Trends</option>
                      <option>Events</option>
                    </Form.Select>
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Default Site
                    </Form.Label>
                    <Form.Select
                      value={defaultSite}
                      onChange={(e) => setDefaultSite(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      {me.sites.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Table Density
                    </Form.Label>
                    <Form.Select
                      value={tableDensity}
                      onChange={(e) => setTableDensity(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>Comfortable</option>
                      <option>Dense</option>
                    </Form.Select>
                    <div className="text-white small mt-1">
                      (Later: apply density globally to tables.)
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Time Format
                    </Form.Label>
                    <Form.Select
                      value={timeFormat}
                      onChange={(e) => setTimeFormat(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option value="24H">24-hour</option>
                      <option value="12H">12-hour</option>
                    </Form.Select>
                  </Col>

                  <Col xs={12} md={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Temperature Units
                    </Form.Label>
                    <Form.Select
                      value={tempUnits}
                      onChange={(e) => setTempUnits(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option>°F</option>
                      <option>°C</option>
                    </Form.Select>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Right column */}
          <Col xs={12} lg={6}>
            {/* Notifications */}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
              <Card.Body>
                <div className="text-white fw-bold mb-2">Notifications</div>

                <Row className="g-2">
                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="text-white fw-semibold">Browser Notifications</div>
                        <Form.Check
                          type="switch"
                          id="notif-browser"
                          checked={browserNotifications}
                          onChange={(e) => setBrowserNotifications(e.target.checked)}
                        />
                      </div>
                      <div className="text-white small mt-1">
                        Show popups for alarms and critical events (if allowed by browser).
                      </div>
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="text-white fw-semibold">Sound Alerts</div>
                        <Form.Check
                          type="switch"
                          id="notif-sound"
                          checked={soundAlerts}
                          onChange={(e) => setSoundAlerts(e.target.checked)}
                        />
                      </div>
                      <div className="text-white small mt-1">
                        Play a sound for unacked Critical/Warning alarms.
                      </div>
                    </div>
                  </Col>

                  <Col xs={12}>
                    <Form.Label className="text-white fw-semibold small mb-1">
                      Notify Severity
                    </Form.Label>
                    <Form.Select
                      value={notifySeverity}
                      onChange={(e) => setNotifySeverity(e.target.value)}
                      className="bg-dark text-white border border-light border-opacity-10"
                    >
                      <option value="Critical only">Critical only</option>
                      <option value="Warning+">Warning + Critical</option>
                      <option value="All">All</option>
                    </Form.Select>
                    <div className="text-white small mt-1">
                      (Later: per-site and per-equipment notification routing.)
                    </div>
                  </Col>
                </Row>

                <hr className="border-light border-opacity-10 my-3" />

                <div className="d-flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    Test (later)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    Rules (later)
                  </Button>
                </div>
              </Card.Body>
            </Card>

            {/* Access & Role */}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
              <Card.Body>
                <div className="text-white fw-bold mb-2">Access & Role</div>

                <Row className="g-2">
                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Role</div>
                      <div className="text-white fw-bold" style={{ fontSize: 18 }}>
                        {me.role}
                      </div>
                      <div className="text-white small mt-1">
                        Viewer (read) • Operator (ack/command) • Engineer (tools) • Admin (users)
                      </div>
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Site Access</div>
                      <div className="text-white fw-semibold mt-1">
                        {me.sites.join(" • ")}
                      </div>
                      <div className="text-white small mt-1">
                        Role/site access changes happen in Engineering/Dev Mode.
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* System Info */}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <div className="text-white fw-bold mb-2">System Info</div>

                <Row className="g-2">
                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Legion-Web Version</div>
                      <div className="text-white fw-bold" style={{ fontSize: 18 }}>
                        {webVersion}
                      </div>
                      <div className="text-white small mt-1">
                        UI build info (for support)
                      </div>
                    </div>
                  </Col>

                  <Col xs={12} md={6}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="text-white fw-semibold">Server</div>
                      <div className="text-white fw-semibold">{serverUrl}</div>
                      <div className="text-white small mt-1">
                        Deployment: On-Prem (mock)
                      </div>
                    </div>
                  </Col>

                  <Col xs={12}>
                    <div className="border border-light border-opacity-10 rounded p-3">
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                          <div className="text-white fw-semibold">Engine Status</div>
                          <div className="text-white fw-bold" style={{ fontSize: 18 }}>
                            {engineStatus}
                          </div>
                          <div className="text-white small mt-1">
                            (Later: show engine ID, last heartbeat, and device comm health.)
                          </div>
                        </div>

                        <span className="badge bg-dark border border-light border-opacity-25 text-white">
                          Last sync: 2/22/26 14:09
                        </span>
                      </div>
                    </div>
                  </Col>
                </Row>

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                  <div className="text-white small fw-semibold">
                    Support: add a “Contact / About” link later.
                  </div>
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    Copy Diagnostics (later)
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}