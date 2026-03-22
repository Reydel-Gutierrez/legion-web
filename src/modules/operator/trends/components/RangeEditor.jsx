import React from "react";
import { Form, Button } from "@themesberg/react-bootstrap";
import { newBandId } from "../trendDomain";

/**
 * @param {{
 *   catalog: { id: string; label: string; unit: string; min: number; max: number }[];
 *   bands: import("../trendDomain").TrendReferenceBand[];
 *   onChange: (bands: import("../trendDomain").TrendReferenceBand[]) => void;
 *   disabled?: boolean;
 * }} props
 */
export default function RangeEditor({ catalog, bands, onChange, disabled = false }) {
  const addBand = () => {
    const first = catalog[0];
    onChange([
      ...bands,
      {
        id: newBandId(),
        pointId: first?.id || "output_a",
        min: first ? (first.min + first.max) / 2 - 5 : 0,
        max: first ? (first.min + first.max) / 2 + 5 : 10,
        label: "Normal band",
        enabled: true,
        showOnChart: true,
      },
    ]);
  };

  const update = (id, patch) => {
    onChange(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const remove = (id) => {
    onChange(bands.filter((b) => b.id !== id));
  };

  return (
    <div className="border border-light border-opacity-10 rounded p-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div className="text-white fw-semibold small">Normal / reference ranges</div>
        <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={addBand} disabled={disabled || !catalog.length}>
          Add range
        </Button>
      </div>
      {!bands.length ? (
        <div className="text-white small opacity-75">Optional. Add a min/max band or target range to compare against live data.</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {bands.map((b) => (
            <div
              key={b.id}
              className="d-flex flex-wrap align-items-end gap-2 pb-2 border-bottom border-light border-opacity-10"
            >
              <div style={{ minWidth: 140 }}>
                <Form.Label className="text-white small mb-1">Point</Form.Label>
                <Form.Select
                  size="sm"
                  value={b.pointId}
                  onChange={(e) => update(b.id, { pointId: e.target.value })}
                  className="bg-primary text-white border border-light border-opacity-10"
                  disabled={disabled}
                >
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div style={{ width: 72 }}>
                <Form.Label className="text-white small mb-1">Min</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  value={b.min}
                  onChange={(e) => update(b.id, { min: Number(e.target.value) })}
                  className="bg-primary text-white border border-light border-opacity-10"
                  disabled={disabled}
                />
              </div>
              <div style={{ width: 72 }}>
                <Form.Label className="text-white small mb-1">Max</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  value={b.max}
                  onChange={(e) => update(b.id, { max: Number(e.target.value) })}
                  className="bg-primary text-white border border-light border-opacity-10"
                  disabled={disabled}
                />
              </div>
              <div className="flex-grow-1" style={{ minWidth: 160 }}>
                <Form.Label className="text-white small mb-1">Label</Form.Label>
                <Form.Control
                  size="sm"
                  value={b.label}
                  onChange={(e) => update(b.id, { label: e.target.value })}
                  placeholder="e.g. Expected cooling band"
                  className="bg-primary text-white border border-light border-opacity-10"
                  disabled={disabled}
                />
              </div>
              <Form.Check
                type="switch"
                id={`en-${b.id}`}
                label="Use"
                checked={b.enabled}
                onChange={(e) => update(b.id, { enabled: e.target.checked })}
                className="text-white small"
                disabled={disabled}
              />
              <Form.Check
                type="switch"
                id={`sh-${b.id}`}
                label="Chart"
                checked={b.showOnChart}
                onChange={(e) => update(b.id, { showOnChart: e.target.checked })}
                className="text-white small"
                disabled={disabled}
              />
              <Button size="sm" variant="outline-danger" className="border-opacity-25" onClick={() => remove(b.id)} disabled={disabled}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
