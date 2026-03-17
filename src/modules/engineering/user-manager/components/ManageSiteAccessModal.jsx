import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import { ROLES } from "../../../../lib/access/roles";

export default function ManageSiteAccessModal({
  show,
  onHide,
  membership,
  preselectedUserId,
  users,
  sites,
  currentSite,
  onSave,
}) {
  const isEdit = !!membership?.id;
  const [userId, setUserId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [canAccessEngineering, setCanAccessEngineering] = useState(true);
  const [canAccessOperator, setCanAccessOperator] = useState(true);
  const [roleOverrideKey, setRoleOverrideKey] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("active");

  useEffect(() => {
    if (membership) {
      setUserId(membership.userId);
      setSiteId(membership.siteId);
      setCanAccessEngineering(membership.canAccessEngineering);
      setCanAccessOperator(membership.canAccessOperator);
      setRoleOverrideKey(membership.roleOverrideKey || "");
      setMembershipStatus(membership.membershipStatus || "active");
    } else {
      setUserId(preselectedUserId || users?.[0]?.id || "");
      const defaultSite = (sites || []).find((s) => s.siteName === currentSite) || sites?.[0];
      setSiteId(defaultSite?.siteId || "");
      setCanAccessEngineering(true);
      setCanAccessOperator(true);
      setRoleOverrideKey("");
      setMembershipStatus("active");
    }
  }, [membership, preselectedUserId, users, sites, currentSite, show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const site = sites.find((s) => s.siteId === siteId);
    onSave({
      id: membership?.id,
      userId,
      siteId,
      siteName: site?.siteName || siteId,
      canAccessEngineering,
      canAccessOperator,
      roleOverrideKey: roleOverrideKey || null,
      membershipStatus,
    });
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      className="legion-modal-dark"
      contentClassName="bg-primary border border-light border-opacity-10"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="text-white">
          {isEdit ? "Edit site access" : "Assign site access"}
        </Modal.Title>
        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onHide} />
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white-50">
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">User</Form.Label>
            <Form.Select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
              required
              disabled={!!(membership?.userId && isEdit)}
            >
              {!userId && <option value="">Select user</option>}
              {(users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">Site</Form.Label>
            <Form.Select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
              required
              disabled={!!membership?.siteId}
            >
              {!siteId && <option value="">Select site</option>}
              {(sites || []).map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteName}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="eng-access"
              label="Engineering access"
              className="text-white"
              checked={canAccessEngineering}
              onChange={(e) => setCanAccessEngineering(e.target.checked)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="op-access"
              label="Operator access"
              className="text-white"
              checked={canAccessOperator}
              onChange={(e) => setCanAccessOperator(e.target.checked)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">Role override (optional)</Form.Label>
            <Form.Select
              value={roleOverrideKey}
              onChange={(e) => setRoleOverrideKey(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
            >
              <option value="">None (use user default)</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white-50 small">Membership status</Form.Label>
            <Form.Select
              value={membershipStatus}
              onChange={(e) => setMembershipStatus(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
            >
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {isEdit ? "Save changes" : "Assign"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
