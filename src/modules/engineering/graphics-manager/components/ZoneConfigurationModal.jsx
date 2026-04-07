import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Nav } from "@themesberg/react-bootstrap";
import SearchablePointSelect from "./SearchablePointSelect";
import * as engineeringRepository from "../../../../lib/data/repositories/engineeringRepository";
import {
  mergeZoneConfig,
  createDefaultZoneConfig,
  createDefaultStateColors,
  VISUAL_PRESETS,
  WEDGE_PRESETS,
  DATA_PRESETS,
  applyVisualPreset,
  applyTemperatureSimpleVisualPreset,
  applyWedgePreset,
  applyDataPreset,
  clampTemperatureBandDeg,
} from "../floorZoneModel";
import { Routes } from "../../../../routes";

const STATE_KEYS = ["normal", "cooling", "heating", "warning", "alarm", "offline", "hover", "selected"];

const WEDGE_FIELD_DEFS = [
  { key: "zoneName", label: "Zone name" },
  { key: "equipmentName", label: "Equipment name" },
  { key: "zoneTemp", label: "Zone temperature" },
  { key: "spaceTemp", label: "Space temperature" },
  { key: "setpoint", label: "Setpoint" },
  { key: "occupancy", label: "Occupancy" },
  { key: "alarmState", label: "Alarm state" },
  { key: "statusChip", label: "Quick status chip" },
];

/** Point bindings shown in Data bindings tab (zone fill uses zone temp vs setpoint). */
const POINT_BINDING_FIELDS = [
  ["zoneTemp", "Zone temperature"],
  ["setpoint", "Zone setpoint"],
];

export default function ZoneConfigurationModal({
  show,
  onHide,
  zoneConfig,
  onSave,
  equipmentList = [],
  templates = null,
  initialTab = "general",
}) {
  const [local, setLocal] = useState(() => mergeZoneConfig(null, {}));
  const [tab, setTab] = useState(initialTab);
  const [showLegacyVisualColors, setShowLegacyVisualColors] = useState(false);

  useEffect(() => {
    if (show) {
      setLocal(mergeZoneConfig(zoneConfig, {}));
      setTab(initialTab);
    }
  }, [show, zoneConfig, initialTab]);

  const equipmentOptions = useMemo(
    () =>
      (equipmentList || []).map((e) => ({
        id: e.id,
        label: e.displayLabel || e.name || e.id,
      })),
    [equipmentList]
  );

  const linkedEquipment = useMemo(() => {
    const id = (local.linkedEquipmentId || "").trim();
    if (!id) return null;
    return equipmentList.find((e) => e.id === id) || null;
  }, [local.linkedEquipmentId, equipmentList]);

  const bindingPoints = useMemo(() => {
    if (!linkedEquipment) return [];
    return engineeringRepository.getPointDisplayInfoForEquipment(linkedEquipment, templates);
  }, [linkedEquipment, templates]);

  const update = (patch) => {
    setLocal((prev) => mergeZoneConfig(prev, patch));
  };

  const updateStateColor = (stateKey, field, value) => {
    setLocal((prev) => {
      const sc = { ...(prev.stateColors || {}) };
      sc[stateKey] = { ...(sc[stateKey] || {}), [field]: value };
      return mergeZoneConfig(prev, { stateColors: sc });
    });
  };

  const handleSave = () => {
    const route =
      local.linkedEquipmentId &&
      `${Routes.LegionEquipmentDetail.path.replace(":equipmentId", encodeURIComponent(local.linkedEquipmentId))}`;
    onSave(mergeZoneConfig(local, { linkedEquipmentRoute: route || local.linkedEquipmentRoute }));
    onHide();
  };

  const applyVisualPresetKey = (key) => {
    update({ stateColors: { ...createDefaultStateColors(), ...applyVisualPreset(key) } });
  };

  const applyWedgePresetKey = (key) => {
    const w = applyWedgePreset(key);
    update({
      wedgeFields: w.wedgeFields,
      wedgeCompact: w.wedgeCompact,
      wedgeMaxWidth: w.wedgeMaxWidth,
    });
  };

  const applyDataPresetKey = (key) => {
    const p = applyDataPreset(key);
    update({
      zoneType: p.zoneType,
      pointBindings: { ...createDefaultZoneConfig().pointBindings, ...p.pointBindings },
    });
  };

  const zoneVisualMode = local.zoneVisualMode !== "legacy" ? "temperature" : "legacy";
  const bandDeg = clampTemperatureBandDeg(local.temperatureBandDeg);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="zone-config-modal">
      <Modal.Header closeButton className="bg-primary border-light border-opacity-10">
        <Modal.Title className="text-white">Floor zone configuration</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-primary">
        <Nav variant="tabs" className="border-bottom border-light border-opacity-10 mb-3">
          {["general", "bindings", "visual", "wedge"].map((k) => (
            <Nav.Item key={k}>
              <Nav.Link
                className={tab === k ? "active text-white" : "text-white-50"}
                onClick={() => setTab(k)}
                style={{ cursor: "pointer" }}
              >
                {k === "general" && "General"}
                {k === "bindings" && "Data bindings"}
                {k === "visual" && "Visual states"}
                {k === "wedge" && "Wedge & interaction"}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        {tab === "general" && (
          <div className="text-white small">
            <Form.Group className="mb-2">
              <Form.Label>Zone name</Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.zoneName || ""}
                onChange={(e) => update({ zoneName: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Description</Form.Label>
              <Form.Control
                size="sm"
                as="textarea"
                rows={2}
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.zoneDescription || ""}
                onChange={(e) => update({ zoneDescription: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Zone type</Form.Label>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.zoneType || "room"}
                onChange={(e) => update({ zoneType: e.target.value })}
              >
                <option value="room">Room</option>
                <option value="vav">VAV zone</option>
                <option value="fcu">FCU zone</option>
                <option value="ahu">AHU area</option>
                <option value="other">Other</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Linked equipment</Form.Label>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.linkedEquipmentId || ""}
                onChange={(e) => update({ linkedEquipmentId: e.target.value })}
              >
                <option value="">— None —</option>
                {equipmentOptions.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-white-50">
                Data bindings use that equipment&apos;s template points (zone temperature and zone setpoint).
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Badge / icon hint (optional)</Form.Label>
              <Form.Control
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                placeholder="e.g. VAV"
                value={local.badgeIcon || ""}
                onChange={(e) => update({ badgeIcon: e.target.value })}
              />
            </Form.Group>
            <div className="mt-3 pt-2 border-top border-light border-opacity-10">
              <div className="text-white-50 mb-1">Data layout presets</div>
              <div className="d-flex flex-wrap gap-1">
                {Object.entries(DATA_PRESETS).map(([k, label]) => (
                  <Button key={k} size="sm" variant="outline-secondary" className="text-white-50" onClick={() => applyDataPresetKey(k)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "bindings" && (
          <div className="text-white small">
            {!linkedEquipment ? (
              <p className="text-warning">Select linked equipment on the General tab to load template points.</p>
            ) : (
              <p className="text-white-50 mb-3">
                Template points from <strong>{linkedEquipment.displayLabel || linkedEquipment.name}</strong>. Bind{" "}
                <strong>zone temperature</strong> and <strong>zone setpoint</strong>. Zone fill is green within ±{bandDeg}
                °, red if hotter than setpoint, blue if colder (band is set under Visual states).
              </p>
            )}
            <div className="fw-semibold text-white mb-2">Point bindings</div>
            {POINT_BINDING_FIELDS.map(([field, label]) => (
              <Form.Group className="mb-2" key={field}>
                <Form.Label>{label}</Form.Label>
                <SearchablePointSelect
                  points={bindingPoints}
                  value={(local.pointBindings || {})[field] || ""}
                  onChange={(id) =>
                    update({
                      pointBindings: { ...(local.pointBindings || {}), [field]: id || "" },
                    })
                  }
                  placeholder="Select template point…"
                  disabled={!bindingPoints.length}
                />
              </Form.Group>
            ))}
          </div>
        )}

        {tab === "visual" && (
          <div className="text-white small">
            <Form.Group className="mb-3">
              <Form.Label>Zone fill logic</Form.Label>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                value={zoneVisualMode}
                onChange={(e) => update({ zoneVisualMode: e.target.value === "legacy" ? "legacy" : "temperature" })}
              >
                <option value="temperature">Temperature — band vs setpoint (green / red / blue)</option>
                <option value="legacy">Legacy — alarm / mode / comms heuristics</option>
              </Form.Select>
            </Form.Group>
            {zoneVisualMode === "temperature" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Comfort band (±°)</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    className="bg-dark border-light border-opacity-10 text-white"
                    style={{ maxWidth: 120 }}
                    value={bandDeg}
                    onChange={(e) =>
                      update({ temperatureBandDeg: clampTemperatureBandDeg(e.target.value) })
                    }
                  />
                  <Form.Text className="text-white-50">
                    Green when |zone temp − setpoint| ≤ this value (e.g. 3 or 5). Red if zone is hotter; blue if colder.
                  </Form.Text>
                </Form.Group>
                <div className="mb-3 p-2 rounded border border-light border-opacity-10">
                  <p className="text-white-50 mb-2 small">
                    Fill uses <strong>zone temp</strong> minus <strong>setpoint</strong>: within ±{bandDeg}° green, above +
                    {bandDeg}° warm red, below −{bandDeg}° cool blue. Reset colors if needed.
                  </p>
                  <div className="d-flex flex-wrap gap-1 align-items-center">
                    {Object.entries(VISUAL_PRESETS).map(([k, label]) => (
                      <Button key={k} size="sm" variant="outline-secondary" className="text-white-50" onClick={() => applyVisualPresetKey(k)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {zoneVisualMode === "legacy" && (
              <p className="text-white-50 small mb-2">Legacy mode uses occupancy/alarm/mode bindings for fill state when configured.</p>
            )}
            {zoneVisualMode === "temperature" && (
              <Form.Check
                type="checkbox"
                id="show-adv-colors"
                className="mb-3 text-white-50"
                label="Edit per-state colors (advanced)"
                checked={showLegacyVisualColors}
                onChange={(e) => setShowLegacyVisualColors(e.target.checked)}
              />
            )}
            {(zoneVisualMode === "legacy" || showLegacyVisualColors) &&
              STATE_KEYS.map((sk) => (
              <div key={sk} className="mb-3 p-2 rounded border border-light border-opacity-10">
                <div className="fw-semibold mb-2 text-capitalize">{sk}</div>
                <div className="row g-2">
                  <div className="col-md-6">
                    <Form.Label className="small text-white-50">Fill</Form.Label>
                    <Form.Control
                      size="sm"
                      type="text"
                      className="bg-dark border-light border-opacity-10 text-white"
                      value={(local.stateColors?.[sk] || {}).fill || ""}
                      onChange={(e) => updateStateColor(sk, "fill", e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <Form.Label className="small text-white-50">Border</Form.Label>
                    <Form.Control
                      size="sm"
                      type="text"
                      className="bg-dark border-light border-opacity-10 text-white"
                      value={(local.stateColors?.[sk] || {}).borderColor || ""}
                      onChange={(e) => updateStateColor(sk, "borderColor", e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <Form.Label className="small text-white-50">Fill opacity</Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      className="bg-dark border-light border-opacity-10 text-white"
                      value={(local.stateColors?.[sk] || {}).fillOpacity ?? ""}
                      onChange={(e) => updateStateColor(sk, "fillOpacity", parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="col-md-4">
                    <Form.Label className="small text-white-50">Glow color</Form.Label>
                    <Form.Control
                      size="sm"
                      type="text"
                      className="bg-dark border-light border-opacity-10 text-white"
                      value={(local.stateColors?.[sk] || {}).glowColor || ""}
                      onChange={(e) => updateStateColor(sk, "glowColor", e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <Form.Label className="small text-white-50">Glow intensity</Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      className="bg-dark border-light border-opacity-10 text-white"
                      value={(local.stateColors?.[sk] || {}).glowIntensity ?? ""}
                      onChange={(e) => updateStateColor(sk, "glowIntensity", parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="col-12">
                    <Form.Check
                      type="checkbox"
                      id={`pulse-${sk}`}
                      label="Pulse animation"
                      checked={!!(local.stateColors?.[sk] || {}).pulse}
                      onChange={(e) => updateStateColor(sk, "pulse", e.target.checked)}
                      className="text-white-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "wedge" && (
          <div className="text-white small">
            <Form.Check
              type="checkbox"
              id="wedge-en"
              className="mb-2"
              label="Enable wedge"
              checked={local.wedgeEnabled !== false}
              onChange={(e) => update({ wedgeEnabled: e.target.checked })}
            />
            <Form.Check
              type="checkbox"
              id="glass-overview-chip"
              className="mb-2"
              label="Glass overview chip above zone (space temp & setpoint)"
              checked={local.showGlassOverviewChip !== false}
              onChange={(e) => update({ showGlassOverviewChip: e.target.checked })}
            />
            <Form.Check
              type="checkbox"
              className="mb-2"
              label="Hover preview chip"
              checked={local.hoverPreviewEnabled !== false}
              onChange={(e) => update({ hoverPreviewEnabled: e.target.checked })}
            />
            <Form.Check
              type="checkbox"
              className="mb-2"
              label="Pinned by default"
              checked={!!local.wedgePinnedByDefault}
              onChange={(e) => update({ wedgePinnedByDefault: e.target.checked })}
            />
            <Form.Check type="checkbox" className="mb-3" label="Compact wedge style" checked={!!local.wedgeCompact} onChange={(e) => update({ wedgeCompact: e.target.checked })} />
            <Form.Group className="mb-2">
              <Form.Label>Collapse delay (ms)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="200"
                max="5000"
                step="50"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.collapseDelayMs ?? 900}
                onChange={(e) => update({ collapseDelayMs: parseInt(e.target.value, 10) || 900 })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Max width (px)</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="180"
                max="480"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.wedgeMaxWidth ?? 280}
                onChange={(e) => update({ wedgeMaxWidth: parseInt(e.target.value, 10) || 280 })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Placement preference</Form.Label>
              <Form.Select
                size="sm"
                className="bg-dark border-light border-opacity-10 text-white"
                value={local.wedgePlacement || "auto"}
                onChange={(e) => update({ wedgePlacement: e.target.value })}
              >
                <option value="auto">Auto (canvas bounds)</option>
                <option value="right">Prefer right</option>
                <option value="left">Prefer left</option>
                <option value="below">Prefer below</option>
                <option value="above">Prefer above</option>
              </Form.Select>
            </Form.Group>
            <div className="mb-2 fw-semibold">Wedge content</div>
            {WEDGE_FIELD_DEFS.map((f) => {
              const row = (local.wedgeFields || []).find((x) => x.key === f.key);
              const en = row ? row.enabled !== false : true;
              return (
                <Form.Check
                  key={f.key}
                  id={`wf-${f.key}`}
                  className="mb-1"
                  label={f.label}
                  checked={en}
                  onChange={(e) => {
                    const next = [...(local.wedgeFields || createDefaultZoneConfig().wedgeFields)];
                    const ix = next.findIndex((x) => x.key === f.key);
                    if (ix >= 0) next[ix] = { ...next[ix], enabled: e.target.checked };
                    else next.push({ key: f.key, enabled: e.target.checked });
                    update({ wedgeFields: next });
                  }}
                />
              );
            })}
            <Form.Check
              className="mb-2 mt-2"
              label='Show "Open Details" action'
              checked={local.runtimeActions?.allowOpenDetails !== false}
              onChange={(e) =>
                update({
                  runtimeActions: { ...(local.runtimeActions || {}), allowOpenDetails: e.target.checked },
                })
              }
            />
            <div className="mt-3 pt-2 border-top border-light border-opacity-10">
              <div className="text-white-50 mb-1">Wedge presets</div>
              <div className="d-flex flex-wrap gap-1">
                {Object.entries(WEDGE_PRESETS).map(([k, label]) => (
                  <Button key={k} size="sm" variant="outline-secondary" className="text-white-50" onClick={() => applyWedgePresetKey(k)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="bg-primary border-light border-opacity-10">
        <Button variant="outline-light" size="sm" onClick={onHide}>
          Cancel
        </Button>
        <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" onClick={handleSave}>
          Save zone
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
