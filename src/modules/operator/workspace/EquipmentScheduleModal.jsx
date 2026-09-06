import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import { operatorRepository } from "../../../lib/data";
import { canEditSchedules } from "../../../lib/access/operatorPermissions";
import {
  DAY_KEYS,
  formatNextOccupancyChange,
  getNextOccupancyChange,
  getTodayScheduleWindows,
  getWeeklySchedule,
  scheduleMatchesEquipment,
} from "../../../lib/operator/equipmentOccupancy";

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyEditor(equipmentName) {
  return {
    name: `${equipmentName} Occupancy`,
    equipment: equipmentName,
    point: "Occ Mode",
    action: "Occupied",
    startTime: "07:00",
    endTime: "18:30",
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
    enabled: true,
  };
}

function formatWindow(w) {
  const action = w.action || "Occupied";
  return `${w.startTime}–${w.endTime} ${action}`;
}

export default function EquipmentScheduleModal({
  show,
  onHide,
  siteKey,
  equipment,
  occupancy,
  schedules,
  onSchedulesChange,
  currentUser,
  now,
}) {
  const canEdit = canEditSchedules(currentUser);
  const [mode, setMode] = useState("view");
  const [editor, setEditor] = useState(() => emptyEditor(equipment?.displayLabel || equipment?.name || "Equipment"));
  const [editingId, setEditingId] = useState(null);
  const equipmentId = equipment?.id;
  useEffect(() => { setMode("view"); }, [equipmentId, show]);

  const equipmentName = equipment?.displayLabel || equipment?.name || "Equipment";
  const matching = useMemo(
    () => (schedules || []).filter((s) => scheduleMatchesEquipment(s, equipment)),
    [schedules, equipment]
  );

  const todayWindows = useMemo(
    () => getTodayScheduleWindows(schedules, equipment, now),
    [schedules, equipment, now]
  );
  const nextChange = useMemo(
    () => getNextOccupancyChange(schedules, equipment, now,
      occupancy?.source === "override" ? occupancy : null),
    [schedules, equipment, now, occupancy]
  );
  const weekly = useMemo(() => getWeeklySchedule(schedules, equipment), [schedules, equipment]);

  const openEditor = (schedule) => {
    if (!canEdit) return;
    if (schedule) {
      const dayObj = DAY_KEYS.reduce((acc, d) => ({ ...acc, [d]: Array.isArray(schedule.days)
        ? schedule.days.includes(d) : Boolean(schedule.days?.[d]) }), {});
      setEditingId(schedule.id);
      setEditor({
        name: schedule.name || `${equipmentName} Occupancy`,
        equipment: schedule.equipment || equipmentName,
        point: schedule.point || "Occ Mode",
        action: schedule.action || "Occupied",
        startTime: schedule.startTime || "07:00",
        endTime: schedule.endTime || "18:30",
        days: dayObj,
        enabled: schedule.enabled !== false,
      });
    } else {
      setEditingId(null);
      setEditor(emptyEditor(equipmentName));
    }
    setMode("edit");
  };

  const saveEditor = () => {
    if (!canEdit) return;
    const days = DAY_KEYS.filter((d) => editor.days[d]);
    if (!editor.name.trim() || days.length === 0 || !editor.startTime || !editor.endTime) return;
    const nowStamp = new Date().toLocaleString();
    const row = {
      id: editingId || `SCH-${Date.now()}`,
      name: editor.name,
      equipment: equipmentName,
      equipmentId: equipment?.id,
      equipType: equipment?.type || equipment?.equipmentType || "Other",
      point: editor.point,
      action: editor.action,
      startTime: editor.startTime,
      endTime: editor.endTime,
      days,
      enabled: editor.enabled,
      updatedAt: nowStamp,
      updatedBy: currentUser?.username || "operator",
    };
    const next = operatorRepository.upsertScheduleForSite(siteKey, row);
    if (onSchedulesChange) onSchedulesChange(next);
    setMode("view");
  };

  const applyOverride = (occupied, hours) => {
    if (!canEdit) return;
    let until;
    if (hours === "next" && nextChange?.at) {
      until = nextChange.at.toISOString();
    } else {
      const ms = (hours === "next" ? 1 : Number(hours) || 1) * 60 * 60 * 1000;
      until = new Date(Date.now() + ms).toISOString();
    }
    operatorRepository.setOccupancyOverride(siteKey, equipment?.id, { occupied, until });
    if (onSchedulesChange) onSchedulesChange(operatorRepository.getSchedules(siteKey));
  };

  const clearOverride = () => {
    if (!canEdit) return;
    operatorRepository.clearEquipmentOccupancyOverride(siteKey, equipment?.id);
    if (onSchedulesChange) onSchedulesChange(operatorRepository.getSchedules(siteKey));
  };

  const handleHide = () => {
    setMode("view");
    onHide();
  };

  return (
    <Modal centered show={show} onHide={handleHide} contentClassName="operator-bootstrap-modal">
      <Modal.Header closeButton>
        <Modal.Title className="h6">{equipmentName} schedule</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === "edit" ? (
          <div className="equip-schedule">
            <Form.Group className="mb-2">
              <Form.Label className="small">Name</Form.Label>
              <Form.Control
                size="sm"
                value={editor.name}
                onChange={(e) => setEditor((p) => ({ ...p, name: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small">Action</Form.Label>
              <Form.Control
                size="sm"
                value={editor.action}
                onChange={(e) => setEditor((p) => ({ ...p, action: e.target.value }))}
              />
            </Form.Group>
            <div className="equip-schedule__times">
              <Form.Group>
                <Form.Label className="small">Start</Form.Label>
                <Form.Control
                  size="sm"
                  type="time"
                  value={editor.startTime}
                  onChange={(e) => setEditor((p) => ({ ...p, startTime: e.target.value }))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="small">End</Form.Label>
                <Form.Control
                  size="sm"
                  type="time"
                  value={editor.endTime}
                  onChange={(e) => setEditor((p) => ({ ...p, endTime: e.target.value }))}
                />
              </Form.Group>
            </div>
            <div className="equip-schedule__days">
              {WEEKDAY_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`equip-schedule__day${editor.days[d] ? " is-on" : ""}`}
                  onClick={() => setEditor((p) => ({ ...p, days: { ...p.days, [d]: !p.days[d] } }))}
                >
                  {d}
                </button>
              ))}
            </div>
            <Form.Check
              className="mt-2"
              type="switch"
              id="equip-sch-enabled"
              label="Enabled"
              checked={editor.enabled}
              onChange={(e) => setEditor((p) => ({ ...p, enabled: e.target.checked }))}
            />
          </div>
        ) : (
          <div className="equip-schedule">
            <dl className="equip-schedule__facts">
              <div>
                <dt>Current occupancy</dt>
                <dd>
                  {occupancy?.label || "Unoccupied"}
                  {occupancy?.source === "override" ? " (override)" : ""}
                </dd>
              </div>
              <div>
                <dt>Today’s schedule</dt>
                <dd>
                  {todayWindows.length
                    ? todayWindows.map((w) => formatWindow(w)).join("; ")
                    : matching.length
                      ? "Unoccupied all day"
                      : "No schedule configured"}
                </dd>
              </div>
              <div>
                <dt>Next occupancy change</dt>
                <dd>{formatNextOccupancyChange(nextChange)}</dd>
              </div>
            </dl>
            <h3 className="equip-schedule__heading">Weekly schedule</h3>
            <table className="equip-schedule__week">
              <tbody>
                {WEEKDAY_ORDER.map((d) => (
                  <tr key={d}>
                    <th>{d}</th>
                    <td>
                      {(weekly.byDay[d] || []).length
                        ? weekly.byDay[d].map((w) => formatWindow(w)).join("; ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canEdit ? (
              <div className="equip-schedule__override">
                <h3 className="equip-schedule__heading">Temporary override</h3>
                <p className="small text-muted">Applies to this browser’s occupancy schedule. It does not command the controller.</p>
                <div className="equip-schedule__override-row">
                  <Button size="sm" variant="outline-secondary" onClick={() => applyOverride(true, 1)}>
                    Occupied 1h
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => applyOverride(false, 1)}>
                    Unoccupied 1h
                  </Button>
                  <Button size="sm" variant="outline-secondary" disabled={!nextChange} onClick={() => applyOverride(occupancy?.occupied, "next")}>
                    Hold until next change
                  </Button>
                  {occupancy?.source === "override" ? (
                    <Button size="sm" variant="link" onClick={clearOverride}>
                      Clear override
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {mode === "edit" ? (
          <>
            <Button variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button variant="success" onClick={saveEditor}>
              Save schedule
            </Button>
          </>
        ) : (
          <>
            {canEdit ? (
              <>
                {matching.length > 1 ? (
                  <Form.Control as="select" size="sm" aria-label="Schedule to edit" value={editingId || matching[0].id}
                    onChange={(e) => setEditingId(e.target.value)}>
                    {matching.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Form.Control>
                ) : null}
                <Button variant="outline-secondary" onClick={() => openEditor(matching.find((s) => s.id === editingId) || matching[0] || null)}>
                  Edit Schedule
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={handleHide}>
              Close
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
