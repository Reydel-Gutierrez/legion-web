import React, { useMemo, useState } from "react";
import { useSite } from "../../components/SiteContext";
import { Container, Row, Col, Card, Table, Form, Button, ButtonGroup, Modal } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../components/legion/LegionHeroHeader";
import StatusDotLabel from "../../components/legion/StatusDotLabel";

export default function Schedules() {
  useSite(); // consume context for global site sync
  const [search, setSearch] = useState(""); const [scope, setScope] = useState("All"); const [status, setStatus] = useState("All");
  const [showEditor, setShowEditor] = useState(false); const [editingId, setEditingId] = useState(null);

  const dayKeys = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const emptyEditor = { name: "", equipment: "AHU-1", point: "Occ Mode", action: "Occupied", startTime: "07:00", endTime: "18:30", days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false }, enabled: true, notes: "" };
  const [editor, setEditor] = useState(emptyEditor);

  const [schedules, setSchedules] = useState([
    { id: "SCH-10021", name: "AHU-1 Weekday Occupancy", equipment: "AHU-1", equipType: "AHU", point: "Occ Mode", action: "Occupied", startTime: "07:00", endTime: "18:30", days: ["Mon","Tue","Wed","Thu","Fri"], enabled: true, updatedAt: "2/22/26 13:10", updatedBy: "reydel" },
    { id: "SCH-10018", name: "VAV-2 Afterhours Setback", equipment: "VAV-2", equipType: "VAV", point: "Space Temp SP", action: "Setback 78°F", startTime: "18:30", endTime: "06:30", days: ["Mon","Tue","Wed","Thu","Fri"], enabled: true, updatedAt: "2/21/26 09:22", updatedBy: "tech.jorge" },
    { id: "SCH-09990", name: "OAU-1 Weekend Off", equipment: "OAU-1", equipType: "OAU", point: "Enable", action: "OFF", startTime: "00:00", endTime: "23:59", days: ["Sat","Sun"], enabled: false, updatedAt: "2/20/26 16:44", updatedBy: "admin" },
  ]);

  const counts = useMemo(() => { const total = schedules.length, enabled = schedules.filter((s) => s.enabled).length; return { total, enabled, disabled: total - enabled }; }, [schedules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter((s) => {
      const matchesSearch = !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.equipment.toLowerCase().includes(q) || s.point.toLowerCase().includes(q) || s.action.toLowerCase().includes(q);
      const matchesScope = scope === "All" || s.equipType === scope || (scope === "Other" && !["AHU","VAV","FCU","OAU","Lighting"].includes(s.equipType));
      const matchesStatus = status === "All" || (status === "Enabled" ? s.enabled : !s.enabled);
      return matchesSearch && matchesScope && matchesStatus;
    });
  }, [schedules, search, scope, status]);

  const inferType = (equip) => (equip.startsWith("AHU") ? "AHU" : equip.startsWith("VAV") ? "VAV" : equip.startsWith("FCU") ? "FCU" : equip.startsWith("OAU") ? "OAU" : "Other");
  const nowStamp = () => { const n = new Date(); const m = n.getMonth() + 1, d = n.getDate(), yy = String(n.getFullYear()).slice(-2), hh = String(n.getHours()).padStart(2, "0"), mm = String(n.getMinutes()).padStart(2, "0"); return `${m}/${d}/${yy} ${hh}:${mm}`; };

  const openCreate = () => { setEditingId(null); setEditor(emptyEditor); setShowEditor(true); };
  const openEdit = (s) => { setEditingId(s.id); const dayObj = dayKeys.reduce((acc, d) => ({ ...acc, [d]: s.days.includes(d) }), {}); setEditor({ name: s.name, equipment: s.equipment, point: s.point, action: s.action, startTime: s.startTime, endTime: s.endTime, days: dayObj, enabled: s.enabled, notes: "" }); setShowEditor(true); };

  const saveSchedule = () => {
    const days = dayKeys.filter((d) => editor.days[d]);
    if (!editor.name.trim()) return alert("Name is required.");
    if (days.length === 0) return alert("Pick at least 1 day.");

    const updatedAt = nowStamp(); const updatedBy = "reydel";

    if (editingId) {
      setSchedules((prev) => prev.map((s) => s.id !== editingId ? s : ({ ...s, name: editor.name, equipment: editor.equipment, equipType: inferType(editor.equipment), point: editor.point, action: editor.action, startTime: editor.startTime, endTime: editor.endTime, days, enabled: editor.enabled, updatedAt, updatedBy })));
    } else {
      const newId = `SCH-${String(10000 + schedules.length + 1)}`;
      setSchedules((prev) => [{ id: newId, name: editor.name, equipment: editor.equipment, equipType: inferType(editor.equipment), point: editor.point, action: editor.action, startTime: editor.startTime, endTime: editor.endTime, days, enabled: editor.enabled, updatedAt, updatedBy }, ...prev]);
    }
    setShowEditor(false);
  };

  const toggleEnabled = (id) => setSchedules((prev) => prev.map((s) => s.id === id ? ({ ...s, enabled: !s.enabled, updatedAt: nowStamp(), updatedBy: "reydel" }) : s));
  const deleteSchedule = (id) => window.confirm("Delete this schedule?") && setSchedules((prev) => prev.filter((s) => s.id !== id));

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3"><LegionHeroHeader /><hr className="border-light border-opacity-25 my-3" /></div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div><h5 className="text-white fw-bold mb-1">Schedules</h5><div className="text-white small">Create and manage weekly schedules for equipment commands (occupancy, enable/disable, setpoints, etc.).</div></div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-dark border border-light border-opacity-25 text-white">Total: {counts.total}</span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">Enabled: {counts.enabled}</span>
            <span className="badge bg-dark border border-light border-opacity-25 text-white">Disabled: {counts.disabled}</span>
            <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={openCreate}>+ New Schedule</Button>
          </div>
        </div>

        <Row className="g-3">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div className="text-white fw-semibold">Schedule Log</div><div className="text-white fw-semibold">{filtered.length} records</div></div>

                <Row className="g-2 align-items-end mb-3">
                  <Col xs={12} md={6} lg={6}>
                    <Form.Label className="text-white fw-semibold small mb-1">Search</Form.Label>
                    <Form.Control value={search} onChange={(e) => { const v = e.target.value; setSearch(v); }} placeholder="Search schedule, equipment, point, action, ID…" className="bg-dark text-white border border-light border-opacity-10" />
                  </Col>
                  <Col xs={6} md={3} lg={3}>
                    <Form.Label className="text-white fw-semibold small mb-1">Scope</Form.Label>
                    <Form.Select value={scope} onChange={(e) => { const v = e.target.value; setScope(v); }} className="bg-dark text-white border border-light border-opacity-10">
                      <option>All</option><option>AHU</option><option>VAV</option><option>FCU</option><option>OAU</option><option>Lighting</option><option>Other</option>
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3} lg={2}>
                    <Form.Label className="text-white fw-semibold small mb-1">Status</Form.Label>
                    <Form.Select value={status} onChange={(e) => { const v = e.target.value; setStatus(v); }} className="bg-dark text-white border border-light border-opacity-10">
                      <option>All</option><option>Enabled</option><option>Disabled</option>
                    </Form.Select>
                  </Col>
                  <Col xs={12} md={12} lg={1} className="d-flex justify-content-end"><Button size="sm" variant="outline-light" className="border-opacity-10 w-100" onClick={() => { setSearch(""); setScope("All"); setStatus("All"); }}>Reset</Button></Col>
                </Row>

                <div className="border border-light border-opacity-10 rounded overflow-hidden">
                  <Table responsive hover className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
                    <thead className="small">
                      <tr>
                        <th style={{ width: 260 }} className="text-white">Schedule</th>
                        <th style={{ width: 220 }} className="text-white">Equipment</th>
                        <th style={{ width: 220 }} className="text-white">Point</th>
                        <th style={{ width: 220 }} className="text-white">Action</th>
                        <th style={{ width: 240 }} className="text-white">Days</th>
                        <th style={{ width: 160 }} className="text-white">Time</th>
                        <th style={{ width: 140 }} className="text-white">Status</th>
                        <th style={{ width: 220 }} className="text-white">Updated</th>
                        <th style={{ width: 190 }} className="text-end text-white">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-white py-4">No schedules match your filters.</td></tr>
                      ) : (
                        filtered.map((s) => (
                          <tr key={s.id}>
                            <td><div className="fw-bold text-white">{s.name}</div><div className="text-white">{s.id}</div></td>
                            <td>
                              <div className="fw-bold text-white">{s.equipment}</div>
                              <div className="text-white">{s.equipType}</div>
                            </td>
                            <td className="text-white fw-semibold">{s.point}</td>
                            <td className="text-white fw-semibold">{s.action}</td>
                            <td className="text-white fw-semibold">{s.days.join(" • ")}</td>
                            <td className="text-white fw-semibold">{s.startTime} – {s.endTime}</td>
                            <td><StatusDotLabel value={s.enabled ? "Enabled" : "Disabled"} kind="status" /></td>
                            <td className="text-white fw-semibold">{s.updatedAt} • {s.updatedBy}</td>
                            <td className="text-end">
                              <ButtonGroup>
                                <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={() => openEdit(s)}>Edit</Button>
                                <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={() => toggleEnabled(s.id)}>{s.enabled ? "Disable" : "Enable"}</Button>
                                <Button size="sm" variant="outline-danger" className="border-opacity-10" onClick={() => deleteSchedule(s.id)}>Delete</Button>
                              </ButtonGroup>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                  <div className="text-white small fw-semibold">Tip: Use schedules for occupancy mode and setpoint setbacks. Keep overrides temporary and track them in Events.</div>
          <Button size="sm" variant="outline-light" className="border-opacity-10" onClick={() => {}}>Export (later)</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      <Modal centered show={showEditor} onHide={() => setShowEditor(false)} contentClassName="bg-primary border border-light border-opacity-10 text-white">
        <Modal.Header className="border-light border-opacity-10">
          <Modal.Title className="h6 text-white">{editingId ? "Edit Schedule" : "New Schedule"}</Modal.Title>
          <Button variant="close" aria-label="Close" onClick={() => setShowEditor(false)} />
        </Modal.Header>

        <Modal.Body className="text-white">
          <Row className="g-2">
            <Col xs={12}>
              <Form.Label className="text-white fw-semibold small mb-1">Name</Form.Label>
              <Form.Control value={editor.name} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, name: v })); }} placeholder="e.g. AHU-1 Weekday Occupancy" className="bg-dark text-white border border-light border-opacity-10" />
            </Col>

            <Col xs={12} md={6}>
              <Form.Label className="text-white fw-semibold small mb-1">Equipment</Form.Label>
              <Form.Select value={editor.equipment} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, equipment: v })); }} className="bg-dark text-white border border-light border-opacity-10">
                <option>AHU-1</option><option>AHU-2</option><option>VAV-2</option><option>VAV-7</option><option>FCU-3</option><option>OAU-1</option>
              </Form.Select>
            </Col>

            <Col xs={12} md={6}>
              <Form.Label className="text-white fw-semibold small mb-1">Point</Form.Label>
              <Form.Select value={editor.point} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, point: v })); }} className="bg-dark text-white border border-light border-opacity-10">
                <option>Occ Mode</option><option>Enable</option><option>Supply Fan Cmd</option><option>Space Temp SP</option><option>Cooling SP</option><option>Heating SP</option>
              </Form.Select>
            </Col>

            <Col xs={12}>
              <Form.Label className="text-white fw-semibold small mb-1">Action</Form.Label>
              <Form.Control value={editor.action} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, action: v })); }} placeholder='e.g. "Occupied" or "Setback 78°F" or "ON"' className="bg-dark text-white border border-light border-opacity-10" />
            </Col>

            <Col xs={6}>
              <Form.Label className="text-white fw-semibold small mb-1">Start</Form.Label>
              <Form.Control type="time" value={editor.startTime} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, startTime: v })); }} className="bg-dark text-white border border-light border-opacity-10" />
            </Col>

            <Col xs={6}>
              <Form.Label className="text-white fw-semibold small mb-1">End</Form.Label>
              <Form.Control type="time" value={editor.endTime} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, endTime: v })); }} className="bg-dark text-white border border-light border-opacity-10" />
            </Col>

            <Col xs={12}>
              <Form.Label className="text-white fw-semibold small mb-1">Days</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {dayKeys.map((d) => (
                  <Button key={d} size="sm" variant={editor.days[d] ? "light" : "outline-light"} className="border-opacity-10" onClick={() => setEditor((p) => ({ ...p, days: { ...p.days, [d]: !p.days[d] } }))}>{d}</Button>
                ))}
              </div>
            </Col>

            <Col xs={12} className="mt-2">
              <div className="d-flex justify-content-between align-items-center border border-light border-opacity-10 rounded p-3">
                <div><div className="text-white fw-semibold">Enabled</div><div className="text-white small">Disable to keep it saved but not active.</div></div>
                <Form.Check type="switch" id="sch-enabled" checked={editor.enabled} onChange={(e) => { const v = e.target.checked; setEditor((p) => ({ ...p, enabled: v })); }} />
              </div>
            </Col>

            <Col xs={12}>
              <Form.Label className="text-white fw-semibold small mb-1">Notes (optional)</Form.Label>
              <Form.Control as="textarea" rows={2} value={editor.notes} onChange={(e) => { const v = e.target.value; setEditor((p) => ({ ...p, notes: v })); }} placeholder="Internal notes for your team…" className="bg-dark text-white border border-light border-opacity-10" />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="border-light border-opacity-10">
          <Button variant="outline-light" className="border-opacity-10" onClick={() => setShowEditor(false)}>Cancel</Button>
          <Button variant="light" onClick={saveSchedule}>{editingId ? "Save Changes" : "Create Schedule"}</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}