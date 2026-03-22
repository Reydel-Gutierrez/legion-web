import React, { useMemo, useState, useEffect } from "react";
import { Modal, Form, Button, ListGroup } from "@themesberg/react-bootstrap";

/**
 * Assign template to the **current** asset by default; optional bulk section for more equipment.
 *
 * @param {{
 *   show: boolean;
 *   onHide: () => void;
 *   equipmentList: { id: string; label: string; type?: string; groupId?: string; templateKey?: string }[];
 *   groups: { id: string; label: string }[];
 *   currentEquipmentId: string;
 *   currentEquipmentLabel?: string;
 *   sameTemplateKey?: string | null;
 *   templates: { id: string; name: string }[];
 *   selectedTemplateId: string;
 *   onTemplateChange: (id: string) => void;
 *   onApply: (payload: { equipmentIds: string[]; trendDefinitionId: string }) => void;
 * }} props
 */
export default function TrendAssignModal({
  show,
  onHide,
  equipmentList,
  groups,
  currentEquipmentId,
  currentEquipmentLabel = "",
  sameTemplateKey,
  templates,
  selectedTemplateId,
  onTemplateChange,
  onApply,
}) {
  const [showBulk, setShowBulk] = useState(false);
  const [local, setLocal] = useState(() => new Set());
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    if (show) {
      setShowBulk(false);
      setGroupId(null);
      setLocal(new Set(currentEquipmentId ? [currentEquipmentId] : []));
    }
  }, [show, currentEquipmentId]);

  const toggle = (id) => {
    setLocal((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectGroup = (gid) => {
    setGroupId(gid);
    if (!gid) return;
    const ids = equipmentList.filter((e) => e.groupId === gid).map((e) => e.id);
    setLocal(new Set(ids));
  };

  const byTemplate = useMemo(() => {
    if (!sameTemplateKey) return [];
    return equipmentList.filter((e) => e.templateKey === sameTemplateKey).map((e) => e.id);
  }, [equipmentList, sameTemplateKey]);

  const applyTemplatePeers = () => {
    setLocal(new Set(byTemplate));
  };

  const canApply = templates.length > 0 && selectedTemplateId;

  const equipmentIdsToApply = useMemo(() => {
    if (!showBulk) {
      return currentEquipmentId ? [currentEquipmentId] : [];
    }
    return Array.from(local);
  }, [showBulk, currentEquipmentId, local]);

  const assignDisabled = !canApply || equipmentIdsToApply.length === 0;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header closeButton className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Assign template</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-white small mb-3 opacity-90">
          By default this assigns to the asset you have open on the Trends page. Each assignment is saved so the trend appears whenever you open that equipment later.
        </div>

        <Form.Group className="mb-3">
          <Form.Label className="small text-white">Template</Form.Label>
          <Form.Select
            size="sm"
            value={selectedTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="bg-primary text-white border border-light border-opacity-10"
            disabled={!templates.length}
          >
            {!templates.length ? <option value="">No templates saved yet</option> : null}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <div className="border border-light border-opacity-10 rounded p-3 mb-3 bg-dark bg-opacity-25">
          <div className="text-white fw-semibold small text-uppercase opacity-75 mb-1">Assign to (current)</div>
          <div className="text-white">
            {currentEquipmentId ? (
              <>
                <span className="fw-semibold">{currentEquipmentLabel || currentEquipmentId}</span>
                <span className="small opacity-75 ms-2">— this is the equipment selected in Trends</span>
              </>
            ) : (
              <span className="text-warning">Select an asset on the Trends page first.</span>
            )}
          </div>
        </div>

        {!showBulk ? (
          <Button
            size="sm"
            variant="outline-light"
            className="border-opacity-10 mb-0"
            onClick={() => {
              setLocal(new Set(currentEquipmentId ? [currentEquipmentId] : []));
              setGroupId(null);
              setShowBulk(true);
            }}
          >
            Assign to additional equipment…
          </Button>
        ) : (
          <div className="mt-2">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <span className="text-white small fw-semibold">Additional / bulk selection</span>
              <Button size="sm" variant="link" className="text-white text-opacity-75 p-0 small" onClick={() => setShowBulk(false)}>
                Use current asset only
              </Button>
            </div>
            <div className="text-white small opacity-75 mb-2">
              Tap equipment below to include them in this assignment (current asset stays included if selected).
            </div>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={() => selectGroup(null)}>
                Clear floor filter
              </Button>
              {groups.map((g) => (
                <Button
                  key={g.id}
                  size="sm"
                  variant={groupId === g.id ? "light" : "outline-light"}
                  className={groupId === g.id ? "text-primary fw-semibold" : "border-opacity-10"}
                  onClick={() => selectGroup(g.id)}
                >
                  Floor: {g.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline-light"
                className="border-opacity-10"
                disabled={!sameTemplateKey || byTemplate.length === 0}
                onClick={applyTemplatePeers}
              >
                Select similar equipment (same template)
              </Button>
            </div>
            <ListGroup variant="flush" className="border border-light border-opacity-10 rounded overflow-hidden" style={{ maxHeight: 240, overflowY: "auto" }}>
              {equipmentList.map((e) => (
                <ListGroup.Item
                  key={e.id}
                  action
                  active={local.has(e.id)}
                  onClick={() => toggle(e.id)}
                  className="bg-primary text-white border-light border-opacity-10 d-flex justify-content-between align-items-center"
                >
                  <span>{e.label}</span>
                  <span className="small opacity-75">{e.type}</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button variant="outline-light" className="border-opacity-10" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="light"
          className="text-primary fw-semibold"
          disabled={assignDisabled}
          onClick={() =>
            onApply({
              equipmentIds: equipmentIdsToApply,
              trendDefinitionId: selectedTemplateId,
            })
          }
        >
          {showBulk ? "Assign to selected equipment" : "Assign to current equipment"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
