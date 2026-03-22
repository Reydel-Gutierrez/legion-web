import React, { useEffect, useState, useMemo } from "react";
import { Modal, Form, Button, ListGroup } from "@themesberg/react-bootstrap";

/**
 * Pick points for the **open equipment** catalog. Use Apply to update plotted points only — recording is started from the panel.
 *
 * @param {{
 *   show: boolean;
 *   onHide: () => void;
 *   equipmentDisplayName: string;
 *   catalog: { id: string; label: string; unit?: string }[];
 *   selectedIds: string[];
 *   onApply: (pointIds: string[]) => void;
 *   templateMode?: boolean;
 * }} props
 */
export default function TrendPointsModal({ show, onHide, equipmentDisplayName, catalog, selectedIds, onApply, templateMode = false }) {
  const [local, setLocal] = useState(() => new Set(selectedIds));
  const [q, setQ] = useState("");

  useEffect(() => {
    if (show) {
      setLocal(new Set(selectedIds));
      setQ("");
    }
  }, [show, selectedIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter(
      (c) =>
        c.label.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s) ||
        (c.unit || "").toLowerCase().includes(s)
    );
  }, [catalog, q]);

  const toggle = (id) => {
    setLocal((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    setLocal(new Set(catalog.map((c) => c.id)));
  };

  const clearAll = () => {
    setLocal(new Set());
  };

  const applyOnly = () => {
    onApply(Array.from(local));
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="md" centered scrollable contentClassName="bg-primary border border-light border-opacity-10 text-white">
      <Modal.Header closeButton className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">{templateMode ? "Template point slugs (site-wide)" : "Points for this equipment"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-white fw-semibold small mb-1">{templateMode ? "Template editor" : equipmentDisplayName || "Equipment"}</div>
        <div className="text-white small opacity-90 mb-3">
          {templateMode ? (
            <>
              Select point <strong>types</strong> by slug. These names are stored on the template and resolve to each asset&apos;s BACnet points when you assign the template. Click <strong>Apply</strong> to update the template.
            </>
          ) : (
            <>
              Points listed below are for the asset currently open on Trends. Choose what to plot and click <strong>Apply</strong>. To begin or stop history collection, use{" "}
              <strong>Start recording</strong> or <strong>Stop recording</strong> in the trend panel.
            </>
          )}
        </div>
        <Form.Control
          size="sm"
          placeholder="Filter points…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-primary text-white border border-light border-opacity-10 mb-2"
        />
        <div className="d-flex flex-wrap gap-2 mb-2">
          <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={selectAll}>
            Select all
          </Button>
          <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={clearAll}>
            Clear all
          </Button>
        </div>
        <div
          className="border border-light border-opacity-10 rounded overflow-auto"
          style={{ maxHeight: "min(50vh, 360px)" }}
        >
          <ListGroup variant="flush" className="border-0 rounded-0">
            {filtered.map((c) => (
              <ListGroup.Item key={c.id} className="bg-primary text-white border-light border-opacity-10 py-2">
                <Form.Check
                  type="checkbox"
                  id={`trend-pt-${c.id}`}
                  checked={local.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="text-white"
                  label={
                    <span className="ms-1">
                      <span className="fw-semibold">{c.label}</span>
                      <span className="d-block small opacity-75 font-monospace">
                        {c.id}
                        {c.unit ? ` · ${c.unit}` : ""}
                      </span>
                    </span>
                  }
                />
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
        {filtered.length === 0 ? <div className="text-white small opacity-75 mt-2">No points match.</div> : null}
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10 flex-wrap gap-2 justify-content-end">
        <Button variant="outline-light" className="border-opacity-10" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="light" className="text-primary fw-semibold" onClick={applyOnly} disabled={!catalog.length}>
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
