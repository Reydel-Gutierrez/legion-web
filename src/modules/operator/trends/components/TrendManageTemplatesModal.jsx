import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Table } from "@themesberg/react-bootstrap";

/**
 * @param {{
 *   show: boolean;
 *   templates: { id: string; name: string }[];
 *   onHide: () => void;
 *   onRename: (templateId: string, newName: string) => void;
 *   onDelete: (templateId: string) => void;
 *   onEditTemplate?: (templateId: string) => void;
 * }} props
 */
export default function TrendManageTemplatesModal({ show, templates, onHide, onRename, onDelete, onEditTemplate }) {
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState("");

  useEffect(() => {
    if (!show) {
      setEditingId("");
      setEditName("");
      setDeleteId("");
    }
  }, [show]);

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditName("");
  };

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed || !editingId) return;
    onRename(editingId, trimmed);
    cancelEdit();
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    onDelete(deleteId);
    setDeleteId("");
  };

  const pendingDelete = templates.find((t) => t.id === deleteId);

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg" contentClassName="bg-primary border border-light border-opacity-10 text-white">
        <Modal.Header closeButton className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Manage templates</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {!templates.length ? (
            <div className="text-white small opacity-75">No saved templates yet. Use <strong>Save as Template</strong> from the trend workspace.</div>
          ) : (
            <div className="table-responsive">
              <Table borderless size="sm" className="text-white mb-0 align-middle">
                <thead>
                  <tr className="small opacity-75">
                    <th>Name</th>
                    <th className="text-end" style={{ minWidth: 300 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-top border-light border-opacity-10">
                      <td>
                        {editingId === t.id ? (
                          <Form.Control
                            size="sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="bg-dark text-white border border-light border-opacity-25"
                            autoFocus
                          />
                        ) : (
                          <span className="text-white">{t.name || "Untitled"}</span>
                        )}
                      </td>
                      <td className="text-end">
                        {editingId === t.id ? (
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            <Button size="sm" variant="light" className="text-primary fw-semibold" onClick={saveEdit}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline-light" className="border-opacity-25" onClick={cancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="d-flex gap-1 justify-content-end flex-wrap">
                            {onEditTemplate ? (
                              <Button
                                size="sm"
                                variant="light"
                                className="text-primary fw-semibold"
                                onClick={() => {
                                  onEditTemplate(t.id);
                                  onHide();
                                }}
                                disabled={!!editingId}
                                title="Open template settings on the main Trends page (no asset)"
                              >
                                Edit settings
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline-light"
                              className="border-opacity-25"
                              onClick={() => startEdit(t)}
                              disabled={!!editingId}
                            >
                              Rename
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="border-opacity-50"
                              onClick={() => setDeleteId(t.id)}
                              disabled={!!editingId}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <div className="text-white small opacity-75 mt-3 mb-0">
            Deleting a template removes it for all sites using this browser storage and removes assignments that referenced it.
          </div>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="outline-light" className="border-opacity-10" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={!!deleteId}
        onHide={() => setDeleteId("")}
        centered
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header closeButton className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">Delete template?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-white small mb-0">
            Remove <strong>{pendingDelete?.name || "this template"}</strong>? Assignments that use this template will be removed from all assets.
          </p>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="outline-light" className="border-opacity-10" onClick={() => setDeleteId("")}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete template
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
