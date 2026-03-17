import React, { useState, useMemo } from "react";
import {
  Modal,
  Button,
  Form,
  InputGroup,
  Table,
  Nav,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faCloudUploadAlt } from "@fortawesome/free-solid-svg-icons";
import { engineeringRepository } from "../../../../lib/data";

/**
 * Modal for saving site templates to the Legion Global Template Library.
 * User selects which equipment and/or graphic templates to publish to the company-wide library.
 */
export default function SaveToGlobalModal({
  show,
  onHide,
  equipmentTemplates = [],
  graphicTemplates = [],
  onSaved,
}) {
  const [searchEquipment, setSearchEquipment] = useState("");
  const [searchGraphic, setSearchGraphic] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());
  const [selectedGraphicIds, setSelectedGraphicIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("equipment");
  const [saving, setSaving] = useState(false);

  const filteredEquipment = useMemo(() => {
    const q = (searchEquipment || "").toLowerCase().trim();
    if (!q) return equipmentTemplates;
    return equipmentTemplates.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.equipmentType || "").toLowerCase().includes(q)
    );
  }, [equipmentTemplates, searchEquipment]);

  const filteredGraphic = useMemo(() => {
    const q = (searchGraphic || "").toLowerCase().trim();
    if (!q) return graphicTemplates;
    return graphicTemplates.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.appliesTo || "").toLowerCase().includes(q)
    );
  }, [graphicTemplates, searchGraphic]);

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
    const ids = filteredEquipment.map((t) => t.id);
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllGraphic = () => {
    const ids = filteredGraphic.map((t) => t.id);
    setSelectedGraphicIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleSaveToGlobal = () => {
    const equipmentToSave = equipmentTemplates.filter((t) => selectedEquipmentIds.has(t.id));
    const graphicToSave = graphicTemplates.filter((t) => selectedGraphicIds.has(t.id));
    if (equipmentToSave.length === 0 && graphicToSave.length === 0) return;
    setSaving(true);
    try {
      equipmentToSave.forEach((t) => engineeringRepository.addEquipmentTemplateToGlobal(t));
      graphicToSave.forEach((t) =>
        engineeringRepository.addGraphicTemplateToGlobal(t, equipmentTemplates)
      );
      const total = equipmentToSave.length + graphicToSave.length;
      if (typeof onSaved === "function") onSaved({ equipment: equipmentToSave.length, graphic: graphicToSave.length, total });
      setSelectedEquipmentIds(new Set());
      setSelectedGraphicIds(new Set());
      setSearchEquipment("");
      setSearchGraphic("");
      onHide();
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selectedEquipmentIds.size + selectedGraphicIds.size;
  const canSave = totalSelected > 0 && !saving;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
      className="template-library-save-to-global-modal"
    >
      <Modal.Header className="border-light border-opacity-10">
        <Modal.Title className="text-white fw-bold h6">
          Save to Global Library
        </Modal.Title>
        <Button variant="link" className="text-white-50 p-0 ms-auto" onClick={onHide} aria-label="Close">
          <span aria-hidden>×</span>
        </Button>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column overflow-hidden" style={{ minHeight: 360 }}>
        <p className="text-white-50 small mb-3">
          Select equipment and graphic templates from this site to publish to the company-wide Legion Global Template Library. They will then be available for import on other projects.
        </p>

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
              >
                Select all
              </Button>
            </div>
            <div className="flex-grow-1 overflow-auto border border-light border-opacity-10 rounded" style={{ minHeight: 220 }}>
              {filteredEquipment.length === 0 ? (
                <div className="p-4 text-center text-white-50 small">
                  No equipment templates in this site. Create or import templates first.
                </div>
              ) : (
                <Table className="discovery-table mb-0" size="sm">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Points</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEquipment.map((t) => (
                      <tr key={t.id} className="discovery-table-row">
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedEquipmentIds.has(t.id)}
                            onChange={() => toggleEquipment(t.id)}
                            className="text-white-50"
                          />
                        </td>
                        <td className="fw-semibold text-white">{t.name}</td>
                        <td className="text-white-50">{t.equipmentType}</td>
                        <td className="text-white-50">{t.pointCount ?? (t.points?.length ?? 0)}</td>
                        <td className="text-white-50 small">{t.source || "—"}</td>
                      </tr>
                    ))}
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
              >
                Select all
              </Button>
            </div>
            <div className="flex-grow-1 overflow-auto border border-light border-opacity-10 rounded" style={{ minHeight: 220 }}>
              {filteredGraphic.length === 0 ? (
                <div className="p-4 text-center text-white-50 small">
                  No graphic templates in this site. Create or import templates first.
                </div>
              ) : (
                <Table className="discovery-table mb-0" size="sm">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Name</th>
                      <th>Applies To</th>
                      <th>Points</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGraphic.map((t) => (
                      <tr key={t.id} className="discovery-table-row">
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedGraphicIds.has(t.id)}
                            onChange={() => toggleGraphic(t.id)}
                            className="text-white-50"
                          />
                        </td>
                        <td className="fw-semibold text-white">{t.name}</td>
                        <td className="text-white-50">{t.appliesTo}</td>
                        <td className="text-white-50">{t.boundPointCount ?? 0}</td>
                        <td className="text-white-50 small">{t.source || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}

        <div className="pt-3 mt-auto border-top border-light border-opacity-10 d-flex justify-content-between align-items-center flex-shrink-0">
          <span className="text-white-50 small">
            {totalSelected > 0 ? `${totalSelected} template(s) selected` : "Select templates to save to Global Library"}
          </span>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={onHide}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              disabled={!canSave}
              onClick={handleSaveToGlobal}
            >
              <FontAwesomeIcon icon={faCloudUploadAlt} className="me-1" />
              {saving ? "Saving…" : "Save to Global Library"}
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
