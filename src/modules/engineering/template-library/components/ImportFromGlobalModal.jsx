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
import { faSearch, faFileImport } from "@fortawesome/free-solid-svg-icons";
import { engineeringRepository } from "../../../../lib/data";

/**
 * Modal (drawer-style) for importing templates from the Legion Global Template Library.
 * Shows mock global templates by type with search/filter and checkboxes.
 */
export default function ImportFromGlobalModal({
  show,
  onHide,
  onImport,
  existingEquipmentNames = [],
  existingGraphicNames = [],
}) {
  const [searchEquipment, setSearchEquipment] = useState("");
  const [searchGraphic, setSearchGraphic] = useState("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState(new Set());
  const [selectedGraphicIds, setSelectedGraphicIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("equipment");

  const filteredEquipment = useMemo(() => {
    const q = (searchEquipment || "").toLowerCase().trim();
    if (!q) return engineeringRepository.GLOBAL_EQUIPMENT_TEMPLATES;
    return engineeringRepository.GLOBAL_EQUIPMENT_TEMPLATES.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.equipmentType || "").toLowerCase().includes(q)
    );
  }, [searchEquipment]);

  const filteredGraphic = useMemo(() => {
    const q = (searchGraphic || "").toLowerCase().trim();
    if (!q) return engineeringRepository.GLOBAL_GRAPHIC_TEMPLATES;
    return engineeringRepository.GLOBAL_GRAPHIC_TEMPLATES.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.appliesToEquipmentType || "").toLowerCase().includes(q)
    );
  }, [searchGraphic]);

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

  const handleImport = () => {
    const equipmentToImport = engineeringRepository.GLOBAL_EQUIPMENT_TEMPLATES.filter((t) =>
      selectedEquipmentIds.has(t.id)
    );
    const graphicToImport = engineeringRepository.GLOBAL_GRAPHIC_TEMPLATES.filter((t) =>
      selectedGraphicIds.has(t.id)
    );
    if (typeof onImport === "function") {
      onImport({
        equipment: equipmentToImport,
        graphic: graphicToImport,
      });
    }
    setSelectedEquipmentIds(new Set());
    setSelectedGraphicIds(new Set());
    setSearchEquipment("");
    setSearchGraphic("");
    onHide();
  };

  const totalSelected = selectedEquipmentIds.size + selectedGraphicIds.size;
  const canImport = totalSelected > 0;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
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
      <Modal.Body className="d-flex flex-column overflow-hidden" style={{ minHeight: 360 }}>
        <p className="text-white-50 small mb-3">
          Select templates from the company-wide Legion Global Template Library to add them to this site.
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
              <Table className="discovery-table mb-0" size="sm">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Points</th>
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
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
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
              <Table className="discovery-table mb-0" size="sm">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Name</th>
                    <th>Applies To</th>
                    <th>Points</th>
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
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}

        <div className="pt-3 mt-auto border-top border-light border-opacity-10 d-flex justify-content-between align-items-center flex-shrink-0">
          <span className="text-white-50 small">
            {totalSelected > 0 ? `${totalSelected} template(s) selected` : "Select templates to import"}
          </span>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={onHide}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="legion-hero-btn legion-hero-btn--primary"
              disabled={!canImport}
              onClick={handleImport}
            >
              <FontAwesomeIcon icon={faFileImport} className="me-1" /> Import
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
