import React, { useState, useCallback, useMemo } from "react";
import {
  Container,
  Card,
  Nav,
  Button,
  Dropdown,
  Form,
  InputGroup,
  Table,
  Badge,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCog,
  faPlus,
  faSearch,
  faEllipsisV,
  faEye,
  faEdit,
  faKey,
  faSitemap,
  faUserSlash,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import LegionTablePagination from "../../../components/legion/LegionTablePagination";
import { useTablePagination } from "../../../hooks/useTablePagination";
import { useSite } from "../../../app/providers/SiteProvider";
import { isEmptySite } from "../../../lib/sites";
import { accessRepository } from "../../../lib/data";
import { canViewUserManager, canManageUsers, canEditSiteMemberships } from "../../../lib/access/currentUserAccess";
import { USER_STATUS } from "../../../lib/access/types";
import { getRoleName } from "../../../lib/access/roles";
import AddEditUserModal from "./components/AddEditUserModal";
import ManageSiteAccessModal from "./components/ManageSiteAccessModal";
import ConfirmActionModal from "./components/ConfirmActionModal";

const TAB_KEYS = { users: "users", roles: "roles", siteAccess: "site-access" };

function formatLastSeen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }) {
  const variant =
    status === USER_STATUS.ACTIVE ? "success" : status === USER_STATUS.DISABLED ? "secondary" : "warning";
  const label = status === USER_STATUS.ACTIVE ? "Active" : status === USER_STATUS.DISABLED ? "Disabled" : "Invited";
  return <Badge bg={variant}>{label}</Badge>;
}

export default function UserManagerPage() {
  const { site: currentSite } = useSite();
  const currentUser = useMemo(() => accessRepository.getCurrentUserForAccess(), []);
  const canView = canViewUserManager(currentUser);
  const canManage = canManageUsers(currentUser);
  const canEditSites = canEditSiteMemberships(currentUser);

  const [activeTab, setActiveTab] = useState(TAB_KEYS.users);
  const [users, setUsers] = useState(() => accessRepository.getUsers());
  const [roles] = useState(() => accessRepository.getRoles());
  const [siteMemberships, setSiteMemberships] = useState(() => accessRepository.getSiteMemberships());
  const sites = useMemo(() => {
    const list = accessRepository.getSitesForAccess();
    if (currentSite && !list.some((s) => s.siteName === currentSite)) {
      return [...list, { siteId: currentSite.toLowerCase().replace(/\s+/g, "-"), siteName: currentSite }];
    }
    return list;
  }, [currentSite]);

  const refreshUsers = useCallback(() => setUsers(accessRepository.getUsers()), []);
  const refreshMemberships = useCallback(() => setSiteMemberships(accessRepository.getSiteMemberships()), []);

  // Users tab filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");

  const isNewSite = isEmptySite(currentSite);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let usersInCurrentProject;
    if (isNewSite) {
      const fullRecord = users.find((u) => u.id === currentUser.id);
      const builderUser = fullRecord || {
        id: currentUser.id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        status: USER_STATUS.ACTIVE,
        roleKey: currentUser.roleKey,
        roleName: currentUser.roleName,
        siteCount: 1,
        lastSeenAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      usersInCurrentProject = [builderUser];
    } else {
      usersInCurrentProject = users.filter((u) =>
        siteMemberships.some((m) => m.userId === u.id && m.siteName === currentSite)
      );
    }
    return usersInCurrentProject.filter((u) => {
      const matchSearch =
        !q ||
        (u.fullName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.roleKey === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      const matchSite = siteFilter === "all" || siteFilter === currentSite;
      return matchSearch && matchRole && matchStatus && matchSite;
    });
  }, [users, search, roleFilter, statusFilter, siteFilter, siteMemberships, currentSite, isNewSite, currentUser]);

  const {
    page,
    setPage,
    pagedRows: pagedUsers,
    total: totalUsers,
    totalPages,
    startIndex,
    endIndex,
    pageSize,
    hasPrev,
    hasNext,
  } = useTablePagination(filteredUsers, 10, search, roleFilter, statusFilter, siteFilter);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showSiteAccessModal, setShowSiteAccessModal] = useState(false);
  const [editingMembership, setEditingMembership] = useState(null);
  const [preselectedUserId, setPreselectedUserId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSaveUser = useCallback(
    (payload) => {
      if (payload.id) {
        accessRepository.updateUser(payload.id, {
          fullName: payload.fullName,
          email: payload.email,
          roleKey: payload.roleKey,
          status: payload.status,
        });
        showToast("User updated.");
      } else {
        accessRepository.createUser(payload);
        showToast("User added.");
      }
      refreshUsers();
      setEditingUser(null);
    },
    [refreshUsers, showToast]
  );

  const handleSaveSiteAccess = useCallback(
    (payload) => {
      if (payload.id) {
        accessRepository.updateSiteMembership(payload.id, {
          canAccessEngineering: payload.canAccessEngineering,
          canAccessOperator: payload.canAccessOperator,
          roleOverrideKey: payload.roleOverrideKey,
          membershipStatus: payload.membershipStatus,
        });
        showToast("Site access updated.");
      } else {
        accessRepository.createSiteMembership(payload);
        showToast("Site access assigned.");
      }
      refreshMemberships();
      refreshUsers();
      setEditingMembership(null);
    },
    [refreshMemberships, refreshUsers, showToast]
  );

  const handleDisableUser = useCallback(
    (u) => {
      accessRepository.updateUser(u.id, { status: USER_STATUS.DISABLED });
      refreshUsers();
      setConfirmAction(null);
      showToast("User disabled.");
    },
    [refreshUsers, showToast]
  );

  const handleReenableUser = useCallback(
    (u) => {
      accessRepository.updateUser(u.id, { status: USER_STATUS.ACTIVE });
      refreshUsers();
      setConfirmAction(null);
      showToast("User re-enabled.");
    },
    [refreshUsers, showToast]
  );

  const membershipsWithUser = useMemo(() => {
    return siteMemberships.map((m) => {
      const u = users.find((x) => x.id === m.userId);
      const roleName = m.roleOverrideKey ? getRoleName(m.roleOverrideKey) : (u?.roleName || "—");
      return { ...m, userName: u?.fullName || m.userId, roleName };
    });
  }, [siteMemberships, users]);

  const filteredMemberships = useMemo(() => {
    const forCurrentSite = membershipsWithUser.filter((m) => m.siteName === currentSite);
    if (isNewSite) {
      const siteIdForNew = currentSite.toLowerCase().replace(/\s+/g, "-");
      const builderMembership = {
        id: "_builder-default",
        userId: currentUser.id,
        siteId: siteIdForNew,
        siteName: currentSite,
        canAccessEngineering: true,
        canAccessOperator: true,
        roleOverrideKey: null,
        membershipStatus: "active",
        userName: currentUser.fullName,
        roleName: currentUser.roleName,
      };
      return [builderMembership];
    }
    return forCurrentSite;
  }, [membershipsWithUser, currentSite, isNewSite, currentUser]);

  if (!canView) {
    return (
      <Container fluid className="px-0">
        <div className="px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>
        <div className="px-3 px-md-4 pb-4">
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Body className="py-5 text-center">
              <FontAwesomeIcon icon={faUserCog} className="fa-3x text-white-50 mb-3 opacity-50" />
              <h5 className="text-white mb-2">Access restricted</h5>
              <p className="text-white-50 mb-0">
                You do not have permission to view User Manager. Contact your org admin for access.
              </p>
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h5 className="text-white fw-bold mb-1">
              <FontAwesomeIcon icon={faUserCog} className="me-2" />
              User Manager
            </h5>
            <div className="text-white-50 small">
              Manage users, roles, and site access for engineering and operator workflows.
            </div>
          </div>
          {activeTab === TAB_KEYS.users && canManage && (
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              onClick={() => {
                setEditingUser(null);
                setShowUserModal(true);
              }}
            >
              <FontAwesomeIcon icon={faPlus} className="me-1" /> Add User
            </Button>
          )}
        </div>

        <Nav variant="tabs" className="mb-3 template-library-tabs validation-tabs">
          <Nav.Item>
            <Nav.Link
              active={activeTab === TAB_KEYS.users}
              onClick={() => setActiveTab(TAB_KEYS.users)}
              className="text-white-50"
            >
              Users
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === TAB_KEYS.roles}
              onClick={() => setActiveTab(TAB_KEYS.roles)}
              className="text-white-50"
            >
              Roles
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === TAB_KEYS.siteAccess}
              onClick={() => setActiveTab(TAB_KEYS.siteAccess)}
              className="text-white-50"
            >
              Site Access
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {/* USERS TAB */}
        {activeTab === TAB_KEYS.users && (
          <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <InputGroup size="sm" className="validation-search" style={{ maxWidth: 260 }}>
                <InputGroup.Text className="bg-dark border-light border-opacity-10 text-white-50">
                  <FontAwesomeIcon icon={faSearch} />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search name, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-dark border-light border-opacity-10 text-white"
                />
              </InputGroup>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white validation-filter-select"
                style={{ width: 140 }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Role: All</option>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white validation-filter-select"
                style={{ width: 140 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Status: All</option>
                <option value={USER_STATUS.ACTIVE}>Active</option>
                <option value={USER_STATUS.INVITED}>Invited</option>
                <option value={USER_STATUS.DISABLED}>Disabled</option>
              </Form.Select>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white validation-filter-select"
                style={{ width: 140 }}
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
              >
                <option value="all">Site: All</option>
                <option value={currentSite}>{currentSite}</option>
              </Form.Select>
            </div>

            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span className="text-white fw-bold">Users</span>
                <span className="text-white-50 small">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</span>
              </Card.Header>
              <Card.Body className="p-0 overflow-visible">
                <div className="user-manager-table-wrap discovery-table-wrap">
                  <Table responsive className="table-dark discovery-table mb-0">
                    <thead>
                      <tr>
                        <th className="border-light border-opacity-10 text-white-50">Name</th>
                        <th className="border-light border-opacity-10 text-white-50">Email</th>
                        <th className="border-light border-opacity-10 text-white-50">Role</th>
                        <th className="border-light border-opacity-10 text-white-50">Status</th>
                        <th className="border-light border-opacity-10 text-white-50">Sites</th>
                        <th className="border-light border-opacity-10 text-white-50">Last Seen</th>
                        <th className="border-light border-opacity-10 text-white-50 text-end discovery-table-header--actions" style={{ width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center text-white-50 py-4">
                            No users match your filters.
                          </td>
                        </tr>
                      ) : (
                        pagedUsers.map((u) => (
                          <tr key={u.id} className="discovery-table-row">
                            <td className="border-light border-opacity-10 text-white fw-semibold">{u.fullName}</td>
                            <td className="border-light border-opacity-10 text-white-50">{u.email}</td>
                            <td className="border-light border-opacity-10">
                              <Badge bg="dark" className="border border-light border-opacity-25">{u.roleName}</Badge>
                            </td>
                            <td className="border-light border-opacity-10">
                              <StatusBadge status={u.status} />
                            </td>
                            <td className="border-light border-opacity-10 text-white-50">{u.siteCount}</td>
                            <td className="border-light border-opacity-10 text-white-50">{formatLastSeen(u.lastSeenAt)}</td>
                            <td className="border-light border-opacity-10 text-end discovery-table-cell--actions" onClick={(e) => e.stopPropagation()}>
                              {canManage ? (
                                <Dropdown align="end" className="d-inline-block" drop="down">
                                  <Dropdown.Toggle
                                    as={Button}
                                    variant="outline-light"
                                    size="sm"
                                    className="border-opacity-10 text-white-50 p-1 px-2 dropdown-toggle-no-caret"
                                    id={`user-actions-${u.id}`}
                                    aria-label="User actions"
                                  >
                                    <FontAwesomeIcon icon={faEllipsisV} />
                                  </Dropdown.Toggle>
                                  <Dropdown.Menu className="legion-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    <Dropdown.Item className="text-white" onClick={() => { setEditingUser(u); setShowUserModal(true); }}>
                                      <FontAwesomeIcon icon={faEye} className="me-2" /> View details
                                    </Dropdown.Item>
                                    <Dropdown.Item className="text-white" onClick={() => { setEditingUser(u); setShowUserModal(true); }}>
                                      <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit user
                                    </Dropdown.Item>
                                    <Dropdown.Item className="text-white" onClick={() => { setEditingUser(u); setShowUserModal(true); }}>
                                      <FontAwesomeIcon icon={faKey} className="me-2" /> Change role
                                    </Dropdown.Item>
                                    <Dropdown.Item className="text-white" onClick={() => { setEditingMembership(null); setPreselectedUserId(u.id); setShowSiteAccessModal(true); }}>
                                      <FontAwesomeIcon icon={faSitemap} className="me-2" /> Manage site access
                                    </Dropdown.Item>
                                    <Dropdown.Divider className="border-light border-opacity-10" />
                                    {u.status === USER_STATUS.DISABLED ? (
                                      <Dropdown.Item className="text-success" onClick={() => handleReenableUser(u)}>
                                        <FontAwesomeIcon icon={faUserCheck} className="me-2" /> Re-enable user
                                      </Dropdown.Item>
                                    ) : (
                                      <Dropdown.Item
                                        className="text-danger"
                                        onClick={() =>
                                          setConfirmAction({
                                            title: "Disable user",
                                            body: `Disable ${u.fullName}? They will not be able to sign in.`,
                                            onConfirm: () => handleDisableUser(u),
                                          })
                                        }
                                      >
                                        <FontAwesomeIcon icon={faUserSlash} className="me-2" /> Disable user
                                      </Dropdown.Item>
                                    )}
                                  </Dropdown.Menu>
                                </Dropdown>
                              ) : (
                                <span className="text-white-50 small">View only</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
                <div className="px-3 pb-3">
                  <LegionTablePagination
                    page={page}
                    setPage={setPage}
                    totalPages={totalPages}
                    total={totalUsers}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    pageSize={pageSize}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                  />
                </div>
              </Card.Body>
            </Card>
          </>
        )}

        {/* ROLES TAB */}
        {activeTab === TAB_KEYS.roles && (
          <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
            <Card.Header className="bg-transparent border-light border-opacity-10 text-white fw-bold">
              System roles
            </Card.Header>
            <Card.Body>
              <p className="text-white-50 small mb-3">
                These roles are used across the platform. System roles cannot be deleted.
              </p>
              <div className="user-manager-table-wrap discovery-table-wrap table-responsive">
                <Table className="table-dark discovery-table mb-0">
                  <thead>
                    <tr>
                      <th className="border-light border-opacity-10 text-white-50">Name</th>
                      <th className="border-light border-opacity-10 text-white-50">Key</th>
                      <th className="border-light border-opacity-10 text-white-50">Description</th>
                      <th className="border-light border-opacity-10 text-white-50">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r.key} className="discovery-table-row">
                        <td className="border-light border-opacity-10 text-white fw-semibold">{r.name}</td>
                        <td className="border-light border-opacity-10 text-white-50"><code className="small">{r.key}</code></td>
                        <td className="border-light border-opacity-10 text-white-50">{r.description}</td>
                        <td className="border-light border-opacity-10">
                          {r.isSystemRole && <Badge bg="secondary">System role</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* SITE ACCESS TAB */}
        {activeTab === TAB_KEYS.siteAccess && (
          <>
            {canEditSites && (
              <div className="mb-3">
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--secondary"
                  onClick={() => {
                    setEditingMembership(null);
                    setPreselectedUserId(null);
                    setShowSiteAccessModal(true);
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" /> Assign site access
                </Button>
              </div>
            )}
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span className="text-white fw-bold">Site access</span>
                <span className="text-white-50 small">{filteredMemberships.length} assignment{filteredMemberships.length !== 1 ? "s" : ""} for {currentSite}</span>
              </Card.Header>
              <Card.Body className="p-0 overflow-visible">
                <div className="user-manager-table-wrap discovery-table-wrap">
                  <Table responsive className="table-dark discovery-table mb-0">
                    <thead>
                      <tr>
                        <th className="border-light border-opacity-10 text-white-50">User</th>
                        <th className="border-light border-opacity-10 text-white-50">Role</th>
                        <th className="border-light border-opacity-10 text-white-50">Site</th>
                        <th className="border-light border-opacity-10 text-white-50">Engineering</th>
                        <th className="border-light border-opacity-10 text-white-50">Operator</th>
                        <th className="border-light border-opacity-10 text-white-50">Status</th>
                        <th className="border-light border-opacity-10 text-white-50 text-end" style={{ width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMemberships.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center text-white-50 py-4">
                            No site assignments for {currentSite}. Assign access from the button above.
                          </td>
                        </tr>
                      ) : (
                        filteredMemberships.map((m) => (
                          <tr key={m.id} className="discovery-table-row">
                            <td className="border-light border-opacity-10 text-white fw-semibold">{m.userName}</td>
                            <td className="border-light border-opacity-10 text-white-50">{m.roleName}</td>
                            <td className="border-light border-opacity-10 text-white-50">{m.siteName}</td>
                            <td className="border-light border-opacity-10">
                              {m.canAccessEngineering ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}
                            </td>
                            <td className="border-light border-opacity-10">
                              {m.canAccessOperator ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}
                            </td>
                            <td className="border-light border-opacity-10 text-white-50">{m.membershipStatus}</td>
                            <td className="border-light border-opacity-10 text-end">
                              {m.id === "_builder-default" ? (
                                <Badge bg="secondary" className="text-white-50">Builder (default)</Badge>
                              ) : canEditSites ? (
                                <Button
                                  size="sm"
                                  variant="outline-light"
                                  className="border-opacity-10"
                                  onClick={() => {
                                    setEditingMembership(m);
                                    setShowSiteAccessModal(true);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faEdit} />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </>
        )}

        {toast && (
          <div
            className="position-fixed bottom-0 end-0 m-3 p-3 bg-success text-white rounded shadow"
            style={{ zIndex: 1100 }}
          >
            {toast}
          </div>
        )}
      </div>

      <AddEditUserModal
        show={showUserModal}
        onHide={() => { setShowUserModal(false); setEditingUser(null); }}
        user={editingUser}
        onSave={handleSaveUser}
      />
      <ManageSiteAccessModal
        show={showSiteAccessModal}
        onHide={() => { setShowSiteAccessModal(false); setEditingMembership(null); setPreselectedUserId(null); }}
        membership={editingMembership}
        preselectedUserId={preselectedUserId}
        users={users}
        sites={sites}
        currentSite={currentSite}
        onSave={handleSaveSiteAccess}
      />
      {confirmAction && (
        <ConfirmActionModal
          show={!!confirmAction}
          onHide={() => setConfirmAction(null)}
          onConfirm={confirmAction.onConfirm}
          title={confirmAction.title}
          body={confirmAction.body}
          confirmLabel="Disable"
          confirmVariant="danger"
        />
      )}
    </Container>
  );
}
