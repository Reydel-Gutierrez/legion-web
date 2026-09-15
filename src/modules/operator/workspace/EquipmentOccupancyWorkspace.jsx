import React, { useMemo, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";
import { canEditSchedules } from "../../../lib/access/operatorPermissions";
import {
  DAY_KEYS,
  formatNextOccupancyChange,
  getNextOccupancyChange,
  getTodayScheduleWindows,
  getWeeklySchedule,
  scheduleMatchesEquipment,
} from "../../../lib/operator/equipmentOccupancy";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blankWindow = () => ({ startTime: "07:00", endTime: "18:00", action: "Occupied" });

function initialSchedule(equipment) {
  return {
    id: null,
    name: `${equipment?.displayLabel || equipment?.name || "Equipment"} Occupancy`,
    days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
    windows: [blankWindow()],
    enabled: true,
  };
}

export default function EquipmentOccupancyWorkspace({ equipment, schedules, occupancy, currentUser, now, onBack, onSchedulesChange, siteKey }) {
  const canEdit = canEditSchedules(currentUser);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [overrideHours, setOverrideHours] = useState("1");
  const matching = useMemo(() => (schedules || []).filter((s) => scheduleMatchesEquipment(s, equipment)), [schedules, equipment]);
  const today = useMemo(() => getTodayScheduleWindows(schedules, equipment, now), [schedules, equipment, now]);
  const next = useMemo(() => getNextOccupancyChange(schedules, equipment, now, occupancy?.source === "override" ? occupancy : null), [schedules, equipment, now, occupancy]);
  const weekly = useMemo(() => getWeeklySchedule(schedules, equipment), [schedules, equipment]);

  const notify = (nextSchedules) => onSchedulesChange?.(nextSchedules);
  const persist = async (operation) => {
    if (!canEdit || busy.current) return;
    busy.current = true;
    try {
      await operation();
      notify(await operatorDefinitionsRepository.fetchSchedules(siteKey));
      setError(""); setEditing(null);
    } catch (err) { setError(err.message); }
    finally { busy.current = false; }
  };
  const openNew = () => setEditing(initialSchedule(equipment));
  const openExisting = (schedule) => setEditing({
    id: schedule.definitionId,
    originalDays: schedule.days,
    name: schedule.name || `${equipment.name} Occupancy`,
    days: DAYS.reduce((out, day) => ({ ...out, [day]: Array.isArray(schedule.days) ? schedule.days.includes(day) : Boolean(schedule.days?.[day]) }), {}),
    windows: matching.filter((item) => item.definitionId === schedule.definitionId).map((item) => ({ startTime: item.startTime, endTime: item.endTime, action: item.action, days: item.days })),
    enabled: schedule.enabled !== false,
  });
  const save = () => {
    if (!canEdit || !editing || !editing.name.trim()) return;
    const days = DAYS.filter((d) => editing.days[d]);
    const windows = editing.windows.filter((w) => w.startTime && w.endTime);
    if (!days.length || !windows.length) return;
    persist(() => operatorDefinitionsRepository.saveDefinition(siteKey, "schedule", {
      id: editing.id || undefined, name: editing.name.trim(), enabled: editing.enabled,
      weeklyWindows: windows.map((window) => ({ ...window, days: editing.originalDays && days.length === editing.originalDays.length && days.every((day) => editing.originalDays.includes(day)) ? (window.days || days) : days })), equipmentIds: [String(equipment.id)],
    }));
  };
  const deleteSchedule = (schedule) => {
    if (!canEdit || !window.confirm(`Delete ${schedule.name || "this schedule"}?`)) return;
    persist(() => operatorDefinitionsRepository.deleteDefinition(siteKey, "schedule", schedule.definitionId));
  };
  const copyDay = (from, to) => {
    if (!canEdit || from === to) return;
    const definitions = [...new Set(matching.map((schedule) => schedule.definitionId))];
    persist(async () => {
      for (const id of definitions) {
        const windows = matching.filter((schedule) => schedule.definitionId === id).map((schedule) => ({
          days: [...schedule.days.filter((day) => day !== to), ...(schedule.days.includes(from) ? [to] : [])],
          startTime: schedule.startTime, endTime: schedule.endTime, action: schedule.action,
        })).filter((window) => window.days.length);
        await operatorDefinitionsRepository.saveDefinition(siteKey, "schedule", { id, weeklyWindows: windows });
      }
    });
  };
  const applyOverride = (occupied) => {
    if (!canEdit) return;
    const until = new Date(Date.now() + Math.max(1, Number(overrideHours) || 1) * 3600000).toISOString();
    operatorRepository.setOccupancyOverride(siteKey, equipment.id, { occupied, until });
    notify(schedules);
  };

  return (
    <section className="operator-full-workspace occupancy-workspace" aria-label="Occupancy schedule workspace">
      {error ? <div role="alert" className="alert alert-warning">{error}</div> : null}
      <div className="operator-full-workspace__topbar"><Button variant="link" className="operator-back-link" onClick={onBack}>← Back to Equipment</Button><span className="operator-eyebrow">BAS SCHEDULE</span></div>
      <div className="operator-full-workspace__heading"><div><h1>Schedule</h1><p>{equipment?.displayLabel || equipment?.name} · <strong>{occupancy?.label || "Unoccupied"}</strong></p></div><div className="occupancy-workspace__next"><span>Next change</span><strong>{formatNextOccupancyChange(next)}</strong></div></div>
      <div className="occupancy-workspace__facts"><div><span>Current Occupancy</span><strong>{occupancy?.label || "Unoccupied"}</strong></div><div><span>Today’s Schedule</span><strong>{today.length ? today.map((w) => `${w.startTime}–${w.endTime} ${w.action}`).join(" · ") : "No schedule configured"}</strong></div><div><span>Configured Windows</span><strong>{matching.length}</strong></div></div>
      {editing ? (
        <div className="operator-editor-panel"><div className="operator-editor-panel__header"><h2>{editing.id ? "Edit schedule" : "New schedule"}</h2><Button variant="link" onClick={() => setEditing(null)}>Cancel</Button></div><Form.Group><Form.Label>Schedule name</Form.Label><Form.Control value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Form.Group><div className="occupancy-workspace__day-tabs">{DAYS.map((day) => <button type="button" className={editing.days[day] ? "is-on" : ""} key={day} onClick={() => setEditing({ ...editing, days: { ...editing.days, [day]: !editing.days[day] } })}>{day}</button>)}</div>{editing.windows.map((window, index) => <div className="occupancy-workspace__window" key={index}><Form.Control type="time" value={window.startTime} onChange={(e) => setEditing({ ...editing, windows: editing.windows.map((w, i) => i === index ? { ...w, startTime: e.target.value } : w) })} /><span>to</span><Form.Control type="time" value={window.endTime} onChange={(e) => setEditing({ ...editing, windows: editing.windows.map((w, i) => i === index ? { ...w, endTime: e.target.value } : w) })} /><Form.Control as="select" value={window.action} onChange={(e) => setEditing({ ...editing, windows: editing.windows.map((w, i) => i === index ? { ...w, action: e.target.value } : w) })}><option>Occupied</option><option>Unoccupied</option></Form.Control>{editing.windows.length > 1 ? <Button variant="link" onClick={() => setEditing({ ...editing, windows: editing.windows.filter((_, i) => i !== index) })}>Remove</Button> : null}</div>)}<Button size="sm" variant="outline-secondary" onClick={() => setEditing({ ...editing, windows: [...editing.windows, blankWindow()] })}>+ Add window</Button><div className="mt-3"><Form.Check type="switch" label="Enabled" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /></div><Button className="mt-3" variant="primary" onClick={save}>Save schedule</Button></div>
      ) : (
        <><div className="operator-editor-panel"><div className="operator-editor-panel__header"><h2>Weekly schedule</h2>{canEdit ? <Button variant="primary" size="sm" onClick={openNew}>Add schedule</Button> : null}</div><table className="occupancy-workspace__table"><tbody>{DAYS.map((day) => <tr key={day}><th>{day}</th><td>{(weekly.byDay[day] || []).map((w, i) => <span className="occupancy-workspace__window-chip" key={i}>{w.startTime}–{w.endTime} {w.action}</span>)}{!(weekly.byDay[day] || []).length ? "—" : null}</td><td>{canEdit ? <Button variant="link" size="sm" onClick={() => copyDay("Mon", day)}>Copy Mon</Button> : null}</td></tr>)}</tbody></table>{matching.map((schedule) => <div className="occupancy-workspace__rule" key={schedule.id}><strong>{schedule.name}</strong><span>{schedule.startTime}–{schedule.endTime} · {schedule.enabled === false ? "Disabled" : "Enabled"}</span>{canEdit ? <><Button variant="link" size="sm" onClick={() => openExisting(schedule)}>Edit</Button><Button variant="link" size="sm" className="text-danger" onClick={() => deleteSchedule(schedule)}>Delete</Button></> : null}</div>)}</div><div className="operator-editor-panel occupancy-workspace__override"><div className="operator-editor-panel__header"><h2>Temporary override</h2><span className="text-muted small">{occupancy?.source === "override" ? `Until ${new Date(occupancy.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No active override"}</span></div>{canEdit ? <><div className="d-flex align-items-center gap-2"><Form.Label className="mb-0">Duration (hours)</Form.Label><Form.Control type="number" min="1" value={overrideHours} onChange={(e) => setOverrideHours(e.target.value)} style={{ maxWidth: 100 }} /></div><div className="mt-3 d-flex gap-2"><Button variant="outline-primary" onClick={() => applyOverride(true)}>Set Occupied</Button><Button variant="outline-secondary" onClick={() => applyOverride(false)}>Set Unoccupied</Button>{occupancy?.source === "override" ? <Button variant="link" onClick={() => { operatorRepository.clearEquipmentOccupancyOverride(siteKey, equipment.id); notify(schedules); }}>Cancel override</Button> : null}</div></> : <p className="text-muted mb-0">You do not have permission to edit schedules.</p>}</div></>
      )}
    </section>
  );
}
