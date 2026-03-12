import React, { useMemo, useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Form,
  Button,
  ButtonGroup,
} from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import StatusDotLabel from "../../../components/legion/StatusDotLabel";
import { useTablePagination } from "../../../hooks/useTablePagination";

export default function UsersPage() {
  const { site } = useSite();

  // Filters
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All"); // All | Operator | Engineer | Admin | Viewer
  const [status, setStatus] = useState("All"); // All | Active | Disabled

  // Mock current logged-in user (replace later with /me)
  const currentUser = useMemo(
    () => ({
      username: "reydel",
      displayName: "Reydel Gutierrez",
      role: "Engineer",
    }),
    []
  );

  // Mock data (replace with API later)
  const users = useMemo(
    () => [
      {
        id: "USR-1001",
        username: "reydel",
        displayName: "Reydel Gutierrez",
        email: "reydel@legion.local",
        role: "Engineer",
        status: "Active",
        sites: ["Miami HQ", "New Site"],
        lastLogin: "2/22/26 14:03",
        createdAt: "2/01/26 09:12",
      },
      {
        id: "USR-1002",
        username: "tech.jorge",
        displayName: "Jorge M.",
        email: "jorge@legion.local",
        role: "Operator",
        status: "Active",
        sites: ["Miami HQ"],
        lastLogin: "2/22/26 12:55",
        createdAt: "2/10/26 15:41",
      },
      {
        id: "USR-1003",
        username: "admin",
        displayName: "Site Admin",
        email: "admin@legion.local",
        role: "Admin",
        status: "Active",
        sites: ["Miami HQ", "New Site"],
        lastLogin: "2/22/26 08:04",
        createdAt: "1/18/26 10:00",
      },
      {
        id: "USR-1004",
        username: "viewer.nina",
        displayName: "Nina R.",
        email: "nina@legion.local",
        role: "Viewer",
        status: "Active",
        sites: ["Miami HQ"],
        lastLogin: "2/21/26 19:16",
        createdAt: "2/15/26 11:22",
      },
      {
        id: "USR-1005",
        username: "eng.paul",
        displayName: "Paul S.",
        email: "paul@legion.local",
        role: "Engineer",
        status: "Disabled",
        sites: ["New Site"],
        lastLogin: "2/10/26 09:44",
        createdAt: "1/28/26 13:09",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.id.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.sites.join(" ").toLowerCase().includes(q);

      const matchesRole = role === "All" || u.role === role;
      const matchesStatus = status === "All" || u.status === status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status]);

  const {
    page,
    setPage,
    pagedRows,
    total,
    totalPages,
    startIndex,
    endIndex,
    pageSize,
    hasPrev,
    hasNext,
  } = useTablePagination(filtered, 20, search, role, status);

  const counts = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "Active").length;
    const engineers = users.filter((u) => u.role === "Engineer").length;
    return { total, active, engineers };
  }, [users]);


  const canViewAllUsers = currentUser.role === "Admin" || currentUser.role === "Engineer";

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
            <h5 className="text-white fw-bold mb-1">Users</h5>
            <div className="text-white small">
              View user accounts and site access. User creation and role changes live in Engineering/Dev Mode.
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Total: {counts.total}
            </span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Active: {counts.active}
            </span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">
              Engineers: {counts.engineers}
            </span>
          </div>
        </div>

        <Row className="g-3">
          {/* My Account card */}
          <Col xs={12} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="text-white fw-bold">My Account</div>
                    <div className="text-white fw-semibold" style={{ fontSize: 18 }}>
                      {currentUser.displayName}
                    </div>
                    <div className="text-white">@{currentUser.username}</div>
                  </div>

                  <span className="text-white fw-semibold">{currentUser.role}</span>
                </div>

                <hr className="border-light border-opacity-10 my-3" />

                <div className="text-white fw-semibold mb-2">Quick Actions</div>
                <div className="d-flex flex-wrap gap-2">
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
                    Sessions (later)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-light"
                    className="border-opacity-10"
                    onClick={() => {}}
                  >
                    My Activity (later)
                  </Button>
                </div>

                <hr className="border-light border-opacity-10 my-3" />

                <div className="text-white small fw-semibold">
                  Note: Account provisioning, role assignments, and site access are managed from Engineering/Dev Mode.
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Users table */}
          <Col xs={12} lg={8}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="text-white fw-semibold">
                    Search Directory — {site}
                  </div>
                  <div className="text-white fw-semibold">Showing {total === 0 ? "0" : `${startIndex + 1}–${endIndex}`} of {total}</div>
                </div>

                {!canViewAllUsers ? (
                  <div className="border border-light border-opacity-10 rounded p-4 text-center">
                    <div className="text-white fw-bold mb-1">Restricted</div>
                    <div className="text-white">
                      Your role does not allow viewing the full directory.
                    </div>
                    <div className="text-white small mt-2">
                      You can still view and manage your own account from the left panel.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Filters */}
                    <Row className="g-2 align-items-end mb-3">
                      <Col xs={12} md={6}>
                        <Form.Label className="text-white fw-semibold small mb-1">
                          Search
                        </Form.Label>
                        <Form.Control
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search name, username, email, site, ID…"
                          className="bg-dark text-white border border-light border-opacity-10"
                        />
                      </Col>

                      <Col xs={6} md={3}>
                        <Form.Label className="text-white fw-semibold small mb-1">
                          Role
                        </Form.Label>
                        <Form.Select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="bg-dark text-white border border-light border-opacity-10"
                        >
                          <option>All</option>
                          <option>Admin</option>
                          <option>Engineer</option>
                          <option>Operator</option>
                          <option>Viewer</option>
                        </Form.Select>
                      </Col>

                      <Col xs={6} md={3}>
                        <Form.Label className="text-white fw-semibold small mb-1">
                          Status
                        </Form.Label>
                        <Form.Select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="bg-dark text-white border border-light border-opacity-10"
                        >
                          <option>All</option>
                          <option>Active</option>
                          <option>Disabled</option>
                        </Form.Select>
                      </Col>
                    </Row>

                    {/* Table */}
                    <div className="border border-light border-opacity-10 rounded overflow-hidden">
                      <Table responsive hover className="bg-primary border border-light border-opacity-10 shadow-sm">
                        <thead>
                          <tr className="text-white fw-semibold">
                            <th style={{ width: 220 }} className="text-white">User</th>
                            <th style={{ width: 160 }} className="text-white">Role</th>
                            <th style={{ width: 140 }} className="text-white">Status</th>
                            <th className="text-white">Site Access</th>
                            <th style={{ width: 170 }} className="text-white">
                              Last Login
                            </th>
                            <th style={{ width: 160 }} className="text-end text-white">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center text-white py-4">
                                No users match your filters.
                              </td>
                            </tr>
                          ) : (
                            pagedRows.map((u) => (
                              <tr key={u.id}>
                                <td>
                                  <div className="fw-bold text-white">{u.displayName}</div>
                                  <div className="text-white">@{u.username}</div>
                                  <div className="text-white">{u.email}</div>
                                </td>

                                <td className="text-white fw-semibold">{u.role}</td>

                                <td>
                                  <StatusDotLabel value={u.status} kind="status" />
                                </td>

                                <td className="text-white fw-semibold">
                                  {u.sites.join(" • ")}
                                </td>

                                <td className="text-white fw-semibold">{u.lastLogin}</td>

                                <td className="text-end">
                                  <ButtonGroup>
                                    <Button
                                      size="sm"
                                      variant="outline-light"
                                      className="border-opacity-10"
                                      onClick={() => {}}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-light"
                                      className="border-opacity-10"
                                      onClick={() => {}}
                                    >
                                      Access (later)
                                    </Button>
                                  </ButtonGroup>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>

                    <LegionTablePagination
                      page={page}
                      setPage={setPage}
                      totalPages={totalPages}
                      total={total}
                      startIndex={startIndex}
                      endIndex={endIndex}
                      pageSize={pageSize}
                      hasPrev={hasPrev}
                      hasNext={hasNext}
                    />

                    {/* Footer */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                      <div className="text-white small fw-semibold">
                        Tip: Keep Operators limited to site(s) they work on. Use Engineering/Dev Mode for role changes.
                      </div>
                      <Button
                        size="sm"
                        variant="outline-light"
                        className="border-opacity-10"
                        onClick={() => {}}
                      >
                        Export (later)
                      </Button>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Optional: permissions hint */}
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <div className="text-white fw-bold mb-1">Permissions Model (MVP)</div>
                <div className="text-white">
                  <strong>Viewer</strong>: read-only • <strong>Operator</strong>: commands + ack •{" "}
                  <strong>Engineer</strong>: device/point tools • <strong>Admin</strong>: user/site access.
                </div>
                <div className="text-white small mt-2">
                  You can keep this page read-only and push all edits into Dev Mode to reduce risk.
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}