import React, { useState, useMemo } from "react";
import { Row, Col, Form, Button, Badge } from "@themesberg/react-bootstrap";
import RangeEditor from "./RangeEditor";
import TrendPointsModal from "./TrendPointsModal";
import TrendStartModal from "./TrendStartModal";

/**
 * @param {{
 *   equipmentLabel: string;
 *   catalog: { id: string; label: string; unit: string }[];
 *   pointIds: string[];
 *   onPointIdsChange: (ids: string[]) => void;
 *   latestByPoint: Record<string, { value: number; unit: string; ts: string; source?: string }>;
 *   referenceBands: import("../trendDomain").TrendReferenceBand[];
 *   onBandsChange: (bands: import("../trendDomain").TrendReferenceBand[]) => void;
 *   overlaySettings: import("../trendDomain").TrendOverlaySettings;
 *   onOverlayChange: (patch: Partial<import("../trendDomain").TrendOverlaySettings>) => void;
 *   chartStyle: string;
 *   onChartStyleChange: (v: string) => void;
 *   assignmentSummary: string;
 *   sessionActive: boolean;
 *   equipmentDisplayName: string;
 *   recordingActive: boolean;
 *   recordingDurationDays: number;
 *   onStartRecording: (durationDays: number) => void;
 *   onStopRecording: () => void;
 *   templateEditorMode?: boolean;
 * }} props
 */
export default function TrendConfigPanel({
  equipmentLabel,
  equipmentDisplayName,
  catalog,
  pointIds,
  onPointIdsChange,
  latestByPoint,
  referenceBands,
  onBandsChange,
  overlaySettings,
  onOverlayChange,
  chartStyle,
  onChartStyleChange,
  assignmentSummary,
  sessionActive,
  recordingActive,
  recordingDurationDays,
  onStartRecording,
  onStopRecording,
  templateEditorMode = false,
}) {
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const off = !sessionActive && !templateEditorMode;

  const selectedCatalog = useMemo(
    () => catalog.filter((c) => pointIds.includes(c.id)),
    [catalog, pointIds]
  );

  const removePoint = (id) => {
    onPointIdsChange(pointIds.filter((x) => x !== id));
  };

  return (
    <div className={`d-flex flex-column gap-2 ${off ? "opacity-50 user-select-none" : ""}`} style={off ? { pointerEvents: "none" } : undefined}>
      {templateEditorMode ? (
        <div className="text-white small border border-info border-opacity-25 rounded p-2 bg-dark bg-opacity-25">
          Editing a <strong>template</strong> without an asset. Point selections are saved as <strong>slugs</strong> (shared across compatible equipment). Use <strong>Save Changes</strong> to update the stored template.
        </div>
      ) : !sessionActive ? (
        <div className="text-white small border border-info border-opacity-25 rounded p-2 bg-dark bg-opacity-25">
          Select an asset, then choose an assigned trend or create one. Open <strong>Add points to trend</strong> to pick BACnet points, then use <strong>Start recording</strong> below to choose duration and begin the session.
        </div>
      ) : null}
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
        <div>
          <div className="text-white fw-semibold small text-uppercase opacity-75">{templateEditorMode ? "Asset" : "Selected asset"}</div>
          <div className="text-white">{templateEditorMode ? "— (template editor)" : equipmentLabel || "—"}</div>
        </div>
        <div className="text-white small opacity-90" style={{ maxWidth: 420 }}>
          {assignmentSummary}
        </div>
      </div>

      {sessionActive ? (
        <div className="border border-light border-opacity-10 rounded p-2">
          <div className="text-white fw-semibold small mb-2">Trend recording</div>
          {recordingActive ? (
            <>
              <div className="text-white small opacity-90">
                Recording is active — {recordingDurationDays}-day session (mock historian). Use <strong>Stop recording</strong> to end before you can start again.
              </div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline-warning" className="border-opacity-50" onClick={onStopRecording}>
                  Stop recording
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-white small opacity-90 mb-2">
                Add points above (or in <strong>Add points to trend</strong>), then start a session here. The points dialog only updates which signals are plotted — it does not start recording.
              </div>
              <Button
                size="sm"
                variant="light"
                className="text-primary fw-semibold"
                disabled={!pointIds.length}
                onClick={() => setStartModalOpen(true)}
                title={!pointIds.length ? "Select at least one point first" : undefined}
              >
                Start recording
              </Button>
            </>
          )}
        </div>
      ) : null}

      <div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="text-white fw-semibold small">Points</div>
          <Button
            size="sm"
            variant="light"
            className="text-primary fw-semibold"
            disabled={off || !catalog.length}
            onClick={() => setPointsModalOpen(true)}
          >
            Add points to trend
          </Button>
        </div>
        {!pointIds.length ? (
          <div className="text-white small opacity-75 border border-light border-opacity-10 rounded p-2">
            No points yet. Click <strong>Add points to trend</strong> to choose from the full point list for this equipment.
          </div>
        ) : (
          <div className="d-flex flex-wrap gap-1 align-items-center mb-2">
            {selectedCatalog.map((c) => (
              <Badge
                key={c.id}
                bg="dark"
                className="border border-light border-opacity-25 text-white fw-normal d-inline-flex align-items-center gap-1 py-2 px-2"
              >
                {c.label}
                <button
                  type="button"
                  className="btn btn-link btn-sm text-white text-opacity-75 p-0 ms-1 lh-1"
                  style={{ fontSize: 14 }}
                  title={`Remove ${c.label}`}
                  onClick={() => removePoint(c.id)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <TrendPointsModal
        show={pointsModalOpen}
        onHide={() => setPointsModalOpen(false)}
        equipmentDisplayName={equipmentDisplayName || equipmentLabel}
        catalog={catalog}
        selectedIds={pointIds}
        onApply={onPointIdsChange}
        templateMode={templateEditorMode}
      />

      <TrendStartModal
        show={startModalOpen}
        onHide={() => setStartModalOpen(false)}
        onConfirm={(days) => {
          onStartRecording(days);
          setStartModalOpen(false);
        }}
      />

      <Row className="g-2">
        {selectedCatalog.map((c) => {
          const lv = latestByPoint[c.id];
          return (
            <Col xs={12} md={4} key={c.id}>
              <div className="border border-light border-opacity-10 rounded p-3 h-100">
                <div className="text-white fw-semibold small">{c.label}</div>
                <div className="text-white fw-bold" style={{ fontSize: 22 }}>
                  {lv ? `${lv.value} ${lv.unit}` : "—"}
                </div>
                <div className="text-white small opacity-75">
                  {lv?.source === "live" ? (
                    <span className="text-info text-opacity-75">Live value</span>
                  ) : lv?.source === "history" ? (
                    <span>History (latest)</span>
                  ) : null}{" "}
                  {lv?.ts || "—"}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      <RangeEditor catalog={catalog} bands={referenceBands} onChange={onBandsChange} disabled={off} />

      <div className="border border-light border-opacity-10 rounded p-2">
        <div className="text-white fw-semibold small mb-2">Chart display</div>
        <div className="d-flex flex-wrap gap-3 align-items-center">
          <Form.Select
            size="sm"
            style={{ maxWidth: 200 }}
            value={chartStyle}
            onChange={(e) => onChartStyleChange(e.target.value)}
            className="bg-primary text-white border border-light border-opacity-10"
          >
            <option value="line">Line (multi-series)</option>
            <option value="line-thin">Line — fine stroke</option>
          </Form.Select>
          <div className="text-white small opacity-75">Comparison overlays (future): hold for stacked compare.</div>
        </div>
      </div>

      <div className="border border-light border-opacity-10 rounded p-2">
        <div className="text-white fw-semibold small mb-2">Event overlays</div>
        <div className="d-flex flex-wrap gap-3">
          <Form.Check
            type="switch"
            id="ov-alarm"
            label="Alarms"
            checked={overlaySettings.alarms}
            onChange={(e) => onOverlayChange({ alarms: e.target.checked })}
            className="text-white small"
          />
          <Form.Check
            type="switch"
            id="ov-sch"
            label="Schedule"
            checked={overlaySettings.schedule}
            onChange={(e) => onOverlayChange({ schedule: e.target.checked })}
            className="text-white small"
          />
          <Form.Check
            type="switch"
            id="ov-comm"
            label="Communication loss"
            checked={overlaySettings.commLoss}
            onChange={(e) => onOverlayChange({ commLoss: e.target.checked })}
            className="text-white small"
          />
          <Form.Check
            type="switch"
            id="ov-mode"
            label="Mode changes"
            checked={overlaySettings.modeChange}
            onChange={(e) => onOverlayChange({ modeChange: e.target.checked })}
            className="text-white small"
          />
        </div>
      </div>
    </div>
  );
}
