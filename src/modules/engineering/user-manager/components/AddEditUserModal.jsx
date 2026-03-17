import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import { ROLES, ROLE_KEYS } from "../../../../lib/access/roles";
import { USER_STATUS } from "../../../../lib/access/types";

export default function AddEditUserModal({ show, onHide, user, onSave }) {
  const isEdit = !!user?.id;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(ROLE_KEYS.VIEWER);
  const [status, setStatus] = useState(USER_STATUS.ACTIVE);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setEmail(user.email || "");
      setRoleKey(user.roleKey || ROLE_KEYS.VIEWER);
      setStatus(user.status || USER_STATUS.ACTIVE);
    } else {
      setFullName("");
      setEmail("");
      setRoleKey(ROLE_KEYS.VIEWER);
      setStatus(USER_STATUS.ACTIVE);
    }
  }, [user, show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: user?.id,
      fullName: fullName.trim(),
      email: email.trim(),
      roleKey,
      status,
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
        <Modal.Title className="text-white">{isEdit ? "Edit User" : "Add User"}</Modal.Title>
        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onHide} />
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="text-white-50">
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">Full name</Form.Label>
            <Form.Control
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="Jane Doe"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="jane@example.com"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white-50 small">Default role</Form.Label>
            <Form.Select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white-50 small">Status</Form.Label>
            <Form.Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-dark border border-light border-opacity-10 text-white"
            >
              <option value={USER_STATUS.ACTIVE}>Active</option>
              <option value={USER_STATUS.INVITED}>Invited</option>
              <option value={USER_STATUS.DISABLED}>Disabled</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {isEdit ? "Save changes" : "Add user"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
