import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  InputGroup,
  Table,
  Nav,
  Spinner,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faFileImport, faPen, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { engineeringRepository } from "../../../../lib/data";
import { USE_HIERARCHY_API } from "../../../../lib/data/config";

/**
 * Import templates from the Global Template Library (API-backed).
 * Includes rename/delete for global rows with confirmation steps.
 */
export default function ImportFromGlobalModal({
  show,
  onHide,
  onImport,
  existingEquipmentNames = [],
  existingGraphicNames = [],
  /** When opening from Template Library, match the active main tab (`equipment` | `graphic`). */
  initialTab = "equipment",
}) {
  const [searchEquipment, setSearchEquipment] = useState("");
  const [searchGraphic, setSearchGraphic] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());
  const [selectedGraphicIds, setSelectedGraphicIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("equipment");
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [graphicRows, setGraphicRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [mutateSaving, setMutateSaving] = useState(false);
  const [mutateError, setMutateError] = useState(null);

  const [renameFlow, setRenameFlow] = useState(null);
  const [deleteFlow, setDeleteFlow] = useState(null);

  const loadLists = useCallback(async () => {
    if (!USE_HIERARCHY_API) {
      setListError("Set REACT_APP_API_BASE_URL to use the Global Template Library.");
      setEquipmentRows([]);
      setGraphicRows([]);
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      const [eq, gfx] = await Promise.all([
        engineeringRepository.fetchGlobalEquipmentTemplatesList(),
        engineeringRepository.fetchGlobalGraphicTemplatesList(),
      ]);
      setEquipmentRows(Array.isArray(eq) ? eq : []);
      setGraphicRows(Array.isArray(gfx) ? gfx : []);
    } catch (e) {
      setListError(e?.message || "Failed to load global templates.");
      setEquipmentRows([]);
      setGraphicRows([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) {
      loadLists();
      setImportError(null);
      setSelectedEquipmentIds(new Set());
      setSelectedGraphicIds(new Set());
      setRenameFlow(null);
      setDeleteFlow(null);
      setMutateError(null);
      if (initialTab === "graphic" || initialTab === "equipment") {
        setActiveTab(initialTab);
      }
    }
  }, [show, loadLists, initialTab]);

  const closeRename = useCallback(() => {
    setRenameFlow(null);
    setMutateError(null);
  }, []);

  const closeDelete = useCallback(() => {
    setDeleteFlow(null);
    setMutateError(null);
  }, []);

  const filteredEquipment = useMemo(() => {
    const q = (searchEquipment || "").toLowerCase().trim();
    if (!q) return equipmentRows;
    return equipmentRows.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.equipmentType || "").toLowerCase().includes(q)
    );
  }, [searchEquipment, equipmentRows]);

  const filteredGraphic = useMemo(() => {
    const q = (searchGraphic || "").toLowerCase().trim();
    if (!q) return graphicRows;
    return graphicRows.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.appliesToEquipmentType || "").toLowerCase().includes(q)
    );
  }, [searchGraphic, graphicRows]);

  const toggleEquipment = (id) => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGraphic = (id) => {
    setSelectedGraphicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEquipment = () => {
    const ids = filteredEquipment
      .filter((t) => !existingEquipmentNames.includes(t.name))
      .map((t) => t.id);
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllGraphic = () => {
    const ids = filteredGraphic
      .filter((t) => !existingGraphicNames.includes(t.name))
      .map((t) => t.id);
    setSelectedGraphicIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleImport = async () => {
    if (!USE_HIERARCHY_API) return;
    const eqIds = [...selectedEquipmentIds];
    const gfxIds = [...selectedGraphicIds];
    if (eqIds.length === 0 && gfxIds.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const equipmentToImport = await Promise.all(
        eqIds.map((id) => engineeringRepository.fetchGlobalEquipmentTemplateById(id))
      );
      const graphicToImport = await Promise.all(
        gfxIds.map((id) => engineeringRepository.fetchGlobalGraphicTemplateById(id))
      );
      if (typeof onImport === "function") {
        onImport({ equipment: equipmentToImport, graphic: graphicToImport });
      }
      setSelectedEquipmentIds(new Set());
      setSelectedGraphicIds(new Set());
      setSearchEquipment("");
      setSearchGraphic("");
      onHide();
    } catch (e) {
      setImportError(e?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const openRename = (kind, row) => {
    setMutateError(null);
    setRenameFlow({
      kind,
      id: row.id,
      originalName: row.name,
      draftName: row.name,
      step: "edit",
    });
  };

  const renameGoConfirm = () => {
    if (!renameFlow) return;
    const next = (renameFlow.draftName || "").trim();
    if (!next) {
      setMutateError("Name is required.");
      return;
    }
    setMutateError(null);
    setRenameFlow({ ...renameFlow, draftName: next, step: "confirm" });
  };

  const renameGoBack = () => {
    if (!renameFlow) return;
    setMutateError(null);
    setRenameFlow({ ...renameFlow, step: "edit" });
  };

  const applyRename = async () => {
    if (!renameFlow || renameFlow.step !== "confirm") return;
    const newName = (renameFlow.draftName || "").trim();
    setMutateSaving(true);
    setMutateError(null);
    try {
      if (renameFlow.kind === "equipment") {
        await engineeringRepository.patchGlobalEquipmentTemplateName(renameFlow.id, { name: newName });
      } else {
        await engineeringRepository.patchGlobalGraphicTemplateName(renameFlow.id, { name: newName });
      }
      await loadLists();
      closeRename();
    } catch (e) {
      setMutateError(e?.message || "Rename failed.");
    } finally {
      setMutateSaving(false);
    }
  };

  const applyDelete = async () => {
    if (!deleteFlow) return;
    setMutateSaving(true);
    setMutateError(null);
    try {
      if (deleteFlow.kind === "equipment") {
        await engineeringRepository.deleteGlobalEquipmentTemplate(deleteFlow.id);
        setSelectedEquipmentIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteFlow.id);
          return next;
        });
      } else {
        await engineeringRepository.deleteGlobalGraphicTemplate(deleteFlow.id);
        setSelectedGraphicIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteFlow.id);
          return next;
        });
      }
      await loadLists();
      closeDelete();
    } catch (e) {
      setMutateError(e?.message || "Delete failed.");
    } finally {
      setMutateSaving(false);
    }
  };

  const totalSelected = selectedEquipmentIds.size + selectedGraphicIds.size;
  const canImport = totalSelected > 0 && !importing && USE_HIERARCHY_API && !listLoading;
  const nestedOpen = !!(renameFlow || deleteFlow);

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        centered
        size="xl"
        enforceFocus={false}
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
        className="template-library-import-modal"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="text-white fw-bold h6">
            Import from Global Library
          </Modal.Title>
          <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={onHide} aria-label="Close">
            <span aria-hidden>×</span>
          </Button>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column overflow-hidden" style={{ minHeight: 400 }}>
          <p className="text-white-50 small mb-3">
            Select templates from the company-wide Global Template Library to add copies to this site. Use Rename or Delete
            to manage global entries (site copies you already imported are not changed). Edits stay on this project until
            you publish to the library again.
          </p>

          {!USE_HIERARCHY_API && (
            <div className="alert alert-warning bg-warning bg-opacity-10 border-warning text-warning small mb-3">
              Configure <code className="text-reset">REACT_APP_API_BASE_URL</code> to load and import global templates.
            </div>
          )}

          {listError && (
            <div className="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger small mb-3">{listError}</div>
          )}
          {importError && (
            <div className="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger small mb-3">{importError}</div>
          )}

          <Nav variant="tabs" className="mb-3 legion-tabs">
            <Nav.Item>
              <Nav.Link
                active={activeTab === "equipment"}
                onClick={() => setActiveTab("equipment")}
                className="text-white-50"
              >
                Equipment Templates
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "graphic"}
                onClick={() => setActiveTab("graphic")}
                className="text-white-50"
              >
                Graphic Templates
              </Nav.Link>
            </Nav.Item>
          </Nav>

          {listLoading ? (
            <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-white-50">
              <Spinner animation="border" size="sm" />
              <span className="small">Loading global library…</span>
            </div>
          ) : (
            <>
              {activeTab === "equipment" && (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <InputGroup className="legion-search-bar flex-grow-1">
                      <InputGroup.Text className="legion-search-bar-addon">
                        <FontAwesomeIcon icon={faSearch} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search equipment templates..."
                        className="legion-search-bar-input"
                        value={searchEquipment}
                        onChange={(e) => setSearchEquipment(e.target.value)}
                      />
                    </InputGroup>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="legion-hero-btn legion-hero-btn--secondary"
                      onClick={selectAllEquipment}
                      disabled={!USE_HIERARCHY_API}
                    >
                      Select all
                    </Button>
                  </div>
                  <div
                    className="flex-grow-1 overflow-auto border border-light border-opacity-10 rounded"
                    style={{ minHeight: 260 }}
                  >
                    {filteredEquipment.length === 0 ? (
                      <div className="p-4 text-center text-white-50 small">
                        {USE_HIERARCHY_API
                          ? "No global equipment templates yet. Publish from a project using Save to Global Library."
                          : "—"}
                      </div>
                    ) : (
                      <Table className="discovery-table mb-0" size="sm" responsive>
                        <thead>
                          <tr>
                            <th style={{ width: 44 }}></th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Points</th>
                            <th className="text-end" style={{ minWidth: 140 }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEquipment.map((t) => {
                            const alreadyInSite = existingEquipmentNames.includes(t.name);
                            return (
                              <tr key={t.id} className="discovery-table-row">
                                <td>
                                  <Form.Check
                                    type="checkbox"
                                    checked={selectedEquipmentIds.has(t.id)}
                                    disabled={alreadyInSite}
                                    onChange={() => toggleEquipment(t.id)}
                                    className="text-white-50"
                                  />
                                </td>
                                <td className="fw-semibold text-white">
                                  {t.name}
                                  {alreadyInSite && (
                                    <span className="text-white-50 small ms-1">(already in site)</span>
                                  )}
                                </td>
                                <td className="text-white-50">{t.equipmentType}</td>
                                <td className="text-white-50">{t.pointCount}</td>
                                <td className="text-end text-nowrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="link"
                                    className="text-white-50 py-0 px-1"
                                    disabled={!USE_HIERARCHY_API || nestedOpen}
                                    title="Rename in global library"
                                    onClick={() => openRename("equipment", t)}
                                  >
                                    <FontAwesomeIcon icon={faPen} className="me-1" />
                                    Rename
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="link"
                                    className="text-danger py-0 px-1"
                                    disabled={!USE_HIERARCHY_API || nestedOpen}
                                    title="Remove from global library"
                                    onClick={() => setDeleteFlow({ kind: "equipment", id: t.id, name: t.name })}
                                  >
                                    <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    )}
                  </div>
                </>
              )}

              {activeTab === "graphic" && (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <InputGroup className="legion-search-bar flex-grow-1">
                      <InputGroup.Text className="legion-search-bar-addon">
                        <FontAwesomeIcon icon={faSearch} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Search graphic templates..."
                        className="legion-search-bar-input"
                        value={searchGraphic}
                        onChange={(e) => setSearchGraphic(e.target.value)}
                      />
                    </InputGroup>
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="legion-hero-btn legion-hero-btn--secondary"
                      onClick={selectAllGraphic}
                      disabled={!USE_HIERARCHY_API}
                    >
                      Select all
                    </Button>
                  </div>
                  <div
                    className="flex-grow-1 overflow-auto border border-light border-opacity-10 rounded"
                    style={{ minHeight: 260 }}
                  >
                    {filteredGraphic.length === 0 ? (
                      <div className="p-4 text-center text-white-50 small">
                        {USE_HIERARCHY_API
                          ? "No global graphic templates yet. Publish from a project using Save to Global Library."
                          : "—"}
                      </div>
                    ) : (
                      <Table className="discovery-table mb-0" size="sm" responsive>
                        <thead>
                          <tr>
                            <th style={{ width: 44 }}></th>
                            <th>Name</th>
                            <th>Applies To</th>
                            <th>Points</th>
                            <th className="text-end" style={{ minWidth: 140 }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGraphic.map((t) => {
                            const alreadyInSite = existingGraphicNames.includes(t.name);
                            return (
                              <tr key={t.id} className="discovery-table-row">
                                <td>
                                  <Form.Check
                                    type="checkbox"
                                    checked={selectedGraphicIds.has(t.id)}
                                    disabled={alreadyInSite}
                                    onChange={() => toggleGraphic(t.id)}
                                    className="text-white-50"
                                  />
                                </td>
                                <td className="fw-semibold text-white">
                                  {t.name}
                                  {alreadyInSite && (
                                    <span className="text-white-50 small ms-1">(already in site)</span>
                                  )}
                                </td>
                                <td className="text-white-50">{t.appliesToEquipmentType}</td>
                                <td className="text-white-50">{t.boundPointCount}</td>
                                <td className="text-end text-nowrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="link"
                                    className="text-white-50 py-0 px-1"
                                    disabled={!USE_HIERARCHY_API || nestedOpen}
                                    title="Rename in global library"
                                    onClick={() => openRename("graphic", t)}
                                  >
                                    <FontAwesomeIcon icon={faPen} className="me-1" />
                                    Rename
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="link"
                                    className="text-danger py-0 px-1"
                                    disabled={!USE_HIERARCHY_API || nestedOpen}
                                    title="Remove from global library"
                                    onClick={() => setDeleteFlow({ kind: "graphic", id: t.id, name: t.name })}
                                  >
                                    <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          <div className="pt-3 mt-auto border-top border-light border-opacity-10 d-flex justify-content-between align-items-center flex-shrink-0">
            <span className="text-white-50 small">
              {importing
                ? "Fetching full templates…"
                : totalSelected > 0
                  ? `${totalSelected} template(s) selected`
                  : "Select templates to import"}
            </span>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="legion-hero-btn legion-hero-btn--secondary"
                onClick={onHide}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                disabled={!canImport}
                onClick={handleImport}
              >
                {importing ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Importing…
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faFileImport} className="me-1" /> Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <Modal
        show={!!renameFlow}
        onHide={closeRename}
        centered
        size="md"
        enforceFocus={false}
        dialogClassName="global-library-nested-modal"
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="text-white fw-bold h6">
            {renameFlow?.step === "confirm" ? "Confirm rename" : "Rename global template"}
          </Modal.Title>
          <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={closeRename} aria-label="Close">
            <span aria-hidden>×</span>
          </Button>
        </Modal.Header>
        <Modal.Body>
          {mutateError && (
            <div className="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger small mb-3">
              {mutateError}
            </div>
          )}
          {renameFlow?.step === "edit" && (
            <>
              <p className="text-white-50 small mb-2">
                Global {renameFlow.kind === "equipment" ? "equipment" : "graphic"} template — current name:{" "}
                <span className="text-white fw-semibold">{renameFlow.originalName}</span>
              </p>
              <Form.Label className="text-white-50 small">New name</Form.Label>
              <Form.Control
                className="bg-dark border-light border-opacity-25 text-white"
                value={renameFlow.draftName}
                onChange={(e) => setRenameFlow({ ...renameFlow, draftName: e.target.value })}
                autoFocus
              />
            </>
          )}
          {renameFlow?.step === "confirm" && (
            <p className="text-white mb-0">
              Rename{" "}
              <span className="fw-semibold text-warning text-break">{renameFlow.originalName}</span>
              {" → "}
              <span className="fw-semibold text-success text-break">{renameFlow.draftName.trim()}</span>
              {"?"}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          {renameFlow?.step === "edit" ? (
            <>
              <Button size="sm" variant="secondary" onClick={closeRename} disabled={mutateSaving}>
                Cancel
              </Button>
              <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" onClick={renameGoConfirm} disabled={mutateSaving}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={renameGoBack} disabled={mutateSaving}>
                Back
              </Button>
              <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" onClick={applyRename} disabled={mutateSaving}>
                {mutateSaving ? <Spinner animation="border" size="sm" /> : "Rename"}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      <Modal
        show={!!deleteFlow}
        onHide={closeDelete}
        centered
        size="sm"
        enforceFocus={false}
        dialogClassName="global-library-nested-modal"
        contentClassName="bg-primary border border-light border-opacity-10 text-white"
      >
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="text-white fw-bold h6">Delete global template</Modal.Title>
          <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={closeDelete} aria-label="Close">
            <span aria-hidden>×</span>
          </Button>
        </Modal.Header>
        <Modal.Body>
          {mutateError && (
            <div className="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger small mb-3">
              {mutateError}
            </div>
          )}
          <p className="text-white mb-0">
            Delete{" "}
            <span className="fw-semibold text-warning text-break">&quot;{deleteFlow?.name}&quot;</span> from the global
            library? This removes it for all projects. Copies already imported into sites are not deleted.
          </p>
        </Modal.Body>
        <Modal.Footer className="border-light border-opacity-10">
          <Button size="sm" variant="secondary" onClick={closeDelete} disabled={mutateSaving}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={applyDelete} disabled={mutateSaving}>
            {mutateSaving ? <Spinner animation="border" size="sm" /> : "Delete"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
