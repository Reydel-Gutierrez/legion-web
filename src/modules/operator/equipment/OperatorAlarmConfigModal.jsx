import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Modal, Button, Form } from "@themesberg/react-bootstrap";
import { operatorRepository } from "../../../lib/data";
import { isBackendSiteId } from "../../../lib/data/siteIdUtils";

const CATEGORIES = [
  { value: "BINARY", label: "Binary state" },
  { value: "THRESHOLD", label: "Threshold" },
  { value: "DEVIATION", label: "Deviation from reference" },
  { value: "COMPARISON", label: "Point comparison" },
];

const OPERATORS_BY_CATEGORY = {
  BINARY: [
    { value: "IS_ON", label: "Alarm when ON" },
    { value: "IS_OFF", label: "Alarm when OFF" },
  ],
  THRESHOLD: [
    { value: "GT", label: "Above (greater than)" },
    { value: "GTE", label: "At or above" },
    { value: "LT", label: "Below (less than)" },
    { value: "LTE", label: "At or below" },
    { value: "EQ", label: "Equals" },
    { value: "NEQ", label: "Not equal" },
  ],
  DEVIATION: [
    { value: "DELTA_GT", label: "Source − reference > X" },
    { value: "DELTA_GTE", label: "Source − reference ≥ X" },
    { value: "DELTA_LT", label: "Source − reference < X" },
    { value: "DELTA_LTE", label: "Source − reference ≤ X" },
  ],
  COMPARISON: [
    { value: "NEQ", label: "Source ≠ reference" },
    { value: "EQ", label: "Source = reference" },
    { value: "GT", label: "Source > reference" },
    { value: "GTE", label: "Source ≥ reference" },
    { value: "LT", label: "Source < reference" },
    { value: "LTE", label: "Source ≤ reference" },
  ],
};

const SEVERITIES = [
  { value: "CRITICAL", label: "Critical" },
  { value: "MAJOR", label: "Major" },
  { value: "MINOR", label: "Minor" },
  { value: "WARNING", label: "Warning" },
];

function categoryLabel(value) {
  const u = value != null ? String(value).toUpperCase() : "";
  const c = CATEGORIES.find((x) => x.value === u);
  return c ? c.label : value ? String(value) : "—";
}

function operatorLabel(category, op) {
  const cat = category != null ? String(category).toUpperCase() : "";
  const opU = op != null ? String(op).toUpperCase() : "";
  const opts = OPERATORS_BY_CATEGORY[cat] || [];
  const o = opts.find((x) => x.value === opU);
  return o ? o.label : op ? String(op) : "—";
}

function severityLabel(value) {
  const u = value != null ? String(value).toUpperCase() : "";
  const s = SEVERITIES.find((x) => x.value === u);
  return s ? s.label : value ? String(value) : "—";
}

/**
 * @param {object} props
 * @param {boolean} props.show
 * @param {() => void} props.onHide
 * @param {string} props.siteId
 * @param {string|number} [props.equipmentId] - Used with single `row` when rows omit per-row equipment ids.
 * @param {import("../../../lib/data/contracts").WorkspaceRow | null} [props.row]
 * @param {import("../../../lib/data/contracts").WorkspaceRow[] | null} [props.rows] - One or many; bulk when length > 1.
 * @param {object | null} props.activeReleaseData
 * @param {() => void} [props.onSaved]
 */
export function OperatorAlarmConfigModal({
  show,
  onHide,
  siteId,
  equipmentId,
  row,
  rows: rowsProp,
  activeReleaseData,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("WARNING");
  const [category, setCategory] = useState("THRESHOLD");
  const [operator, setOperator] = useState("GT");
  const [targetValue, setTargetValue] = useState("");
  /** Reference selection: `id:<uuid>` or `key:<logicalPointKey>`. */
  const [targetRef, setTargetRef] = useState("");
  const [deadband, setDeadband] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  /** @type {'loading'|'hub'|'view'|'create'} */
  const [screen, setScreen] = useState("loading");
  const [existingDefinitions, setExistingDefinitions] = useState([]);
  const [loadError, setLoadError] = useState(null);
  /** When set, the form saves via PATCH instead of POST. */
  const [editingDefinitionId, setEditingDefinitionId] = useState(null);
  const [deleteConfirmDef, setDeleteConfirmDef] = useState(null);
  const [deleteActionError, setDeleteActionError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkSaveMessage, setBulkSaveMessage] = useState("");

  const effectiveRows = useMemo(() => {
    if (rowsProp && rowsProp.length > 0) return rowsProp;
    if (row) return [row];
    return [];
  }, [rowsProp, row]);

  const isBulk = effectiveRows.length > 1;
  const primaryRow = effectiveRows[0];
  const resolvedEquipmentId =
    primaryRow?.equipmentId != null ? primaryRow.equipmentId : equipmentId;

  const dbPointId = primaryRow?.databasePointId;
  const logicalKey = useMemo(
    () => (primaryRow ? String(primaryRow.pointKey || primaryRow.pointId || "").trim() : ""),
    [primaryRow]
  );
  const canUseApi = Boolean(
    isBackendSiteId(siteId) &&
      effectiveRows.length > 0 &&
      effectiveRows.every(
        (r) =>
          r &&
          (r.equipmentId != null || equipmentId != null) &&
          String(r.pointKey || r.pointId || "").trim()
      )
  );
  const isBoundToDb = Boolean(dbPointId);
  const anyRowUnbound = isBulk && effectiveRows.some((r) => !r.databasePointId);

  const siblingPoints = useMemo(() => {
    if (!activeReleaseData || !logicalKey || effectiveRows.length === 0) return [];
    const sourceKeys = new Set(
      effectiveRows.map((r) => String(r.pointKey || r.pointId || "").trim()).filter(Boolean)
    );
    const oneEquipment =
      effectiveRows.every(
        (r) => String(r.equipmentId) === String(effectiveRows[0].equipmentId)
      ) && effectiveRows[0].equipmentId != null;

    if (oneEquipment) {
      const eid = String(effectiveRows[0].equipmentId);
      return operatorRepository
        .getWorkspacePointsForEquipment(
          eid,
          effectiveRows[0].equipmentName || "",
          "OK",
          { activeRelease: activeReleaseData }
        )
        .filter((p) => {
          const k = String(p.pointKey || p.pointId || "").trim();
          return k && !sourceKeys.has(k);
        });
    }

    const keySet = new Set();
    for (const r of effectiveRows) {
      if (r.equipmentId == null) continue;
      const pts = operatorRepository.getWorkspacePointsForEquipment(
        String(r.equipmentId),
        r.equipmentName || "",
        "OK",
        { activeRelease: activeReleaseData }
      );
      for (const p of pts) {
        const k = String(p.pointKey || p.pointId || "").trim();
        if (k && !sourceKeys.has(k)) keySet.add(k);
      }
    }
    return Array.from(keySet)
      .sort()
      .map((k) => ({
        pointKey: k,
        pointId: k,
        databasePointId: null,
        pointDescription: "",
        pointName: k,
      }));
  }, [activeReleaseData, effectiveRows, logicalKey]);

  function siblingRefValue(p) {
    if (p.databasePointId) return `id:${p.databasePointId}`;
    const k = String(p.pointKey || p.pointId || "").trim();
    return k ? `key:${k}` : "";
  }

  const operatorOptions = OPERATORS_BY_CATEGORY[category] || OPERATORS_BY_CATEGORY.THRESHOLD;

  const resetCreateForm = useCallback(() => {
    if (!primaryRow) return;
    const pk = primaryRow.pointKey || primaryRow.pointId;
    setName(`Alarm: ${pk}`);
    setSeverity("WARNING");
    setCategory("THRESHOLD");
    setOperator("GT");
    setTargetValue("");
    setTargetRef("");
    setDeadband("");
    setDelaySeconds("");
    setEnabled(true);
    setMessageTemplate("");
  }, [primaryRow]);

  useEffect(() => {
    if (!show || !primaryRow) return;
    setError(null);
    setEditingDefinitionId(null);
    setBulkSaveMessage("");
    resetCreateForm();
  }, [show, primaryRow, resetCreateForm]);

  const refreshDefinitions = useCallback(async () => {
    if (!isBackendSiteId(siteId) || !logicalKey) {
      setExistingDefinitions([]);
      return [];
    }
    const eid = resolvedEquipmentId != null ? String(resolvedEquipmentId) : "";
    if (!eid) {
      setExistingDefinitions([]);
      return [];
    }
    try {
      const list = await operatorRepository.listOperatorAlarmDefinitions(siteId, {
        equipmentId: eid,
        pointKey: logicalKey,
      });
      const next = Array.isArray(list) ? list : [];
      setExistingDefinitions(next);
      setLoadError(null);
      return next;
    } catch (err) {
      setLoadError(err?.message || String(err));
      return [];
    }
  }, [siteId, resolvedEquipmentId, logicalKey]);

  useEffect(() => {
    if (!show || !primaryRow || !canUseApi) {
      setScreen("loading");
      setExistingDefinitions([]);
      setLoadError(null);
      return;
    }
    if (isBulk) {
      setScreen("create");
      setExistingDefinitions([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setScreen("loading");
      setLoadError(null);
      try {
        const list = await operatorRepository.listOperatorAlarmDefinitions(siteId, {
          equipmentId: String(resolvedEquipmentId),
          pointKey: logicalKey,
        });
        if (cancelled) return;
        const defs = Array.isArray(list) ? list : [];
        setExistingDefinitions(defs);
        setScreen(defs.length > 0 ? "hub" : "create");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err?.message || String(err));
        setExistingDefinitions([]);
        setScreen("create");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, primaryRow, canUseApi, isBulk, siteId, resolvedEquipmentId, logicalKey]);

  useEffect(() => {
    const opts = OPERATORS_BY_CATEGORY[category];
    if (opts && opts.length > 0 && !opts.some((o) => o.value === operator)) {
      setOperator(opts[0].value);
    }
  }, [category, operator]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canUseApi || !primaryRow || !logicalKey) return;
      if (editingDefinitionId && isBulk) return;
      setSaving(true);
      setError(null);
      try {
        const needsRef = category === "DEVIATION" || category === "COMPARISON";
        const needsThreshold = category === "THRESHOLD" || category === "DEVIATION";
        const multiEquipmentBulk =
          isBulk && new Set(effectiveRows.map((r) => String(r.equipmentId))).size > 1;

        if (needsRef && !targetRef) {
          setError("Select a reference point for this rule type.");
          setSaving(false);
          return;
        }
        if (needsRef && multiEquipmentBulk && targetRef.startsWith("id:")) {
          setError(
            "For multiple equipment, choose a reference by logical point key so each unit resolves its own BACnet object."
          );
          setSaving(false);
          return;
        }
        if (needsThreshold && (targetValue === "" || targetValue === null)) {
          setError("Enter a threshold or deviation value.");
          setSaving(false);
          return;
        }
        let resolvedTargetPointId = null;
        let resolvedTargetPointKey = null;
        if (needsRef) {
          if (targetRef.startsWith("id:")) {
            resolvedTargetPointId = targetRef.slice(3);
          } else if (targetRef.startsWith("key:")) {
            resolvedTargetPointKey = targetRef.slice(4);
          } else {
            setError("Invalid reference point selection.");
            setSaving(false);
            return;
          }
        }
        const trimmedTemplate = messageTemplate.trim();
        const basePayload = {
          name: name.trim(),
          enabled,
          severity,
          category,
          operator,
          targetValue:
            targetValue === "" || targetValue === null ? null : Number(targetValue),
          targetPointId: resolvedTargetPointId,
          targetPointKey: resolvedTargetPointKey,
          deadband: deadband === "" ? null : Number(deadband),
          delaySeconds: delaySeconds === "" ? null : parseInt(String(delaySeconds), 10),
          messageTemplate: trimmedTemplate.length > 0 ? trimmedTemplate : null,
          autoAcknowledge: false,
        };

        const bodyForRow = (r) => ({
          ...basePayload,
          equipmentId: String(r.equipmentId ?? equipmentId),
          pointKey: String(r.pointKey || r.pointId || "").trim(),
          pointId: r.databasePointId ? String(r.databasePointId) : null,
        });

        if (editingDefinitionId) {
          await operatorRepository.updateOperatorAlarmDefinition(
            siteId,
            editingDefinitionId,
            bodyForRow(primaryRow)
          );
        } else if (isBulk) {
          for (const r of effectiveRows) {
            await operatorRepository.createOperatorAlarmDefinition(siteId, bodyForRow(r));
          }
          setBulkSaveMessage(`Saved alarm rules for ${effectiveRows.length} points.`);
          setEditingDefinitionId(null);
          resetCreateForm();
          if (typeof onSaved === "function") {
            onSaved();
          }
          return;
        } else {
          await operatorRepository.createOperatorAlarmDefinition(siteId, bodyForRow(primaryRow));
        }
        if (typeof onSaved === "function") {
          onSaved();
        }
        setEditingDefinitionId(null);
        await refreshDefinitions();
        setScreen("view");
      } catch (err) {
        setError(err?.message || String(err));
      } finally {
        setSaving(false);
      }
    },
    [
      canUseApi,
      primaryRow,
      isBulk,
      effectiveRows,
      siteId,
      equipmentId,
      logicalKey,
      name,
      enabled,
      severity,
      category,
      operator,
      targetValue,
      targetRef,
      deadband,
      delaySeconds,
      messageTemplate,
      onSaved,
      refreshDefinitions,
      editingDefinitionId,
      resetCreateForm,
    ]
  );

  const populateFormFromDefinition = useCallback((def) => {
    setName(def.name || "");
    setSeverity(String(def.severity || "WARNING").toUpperCase());
    const cat = String(def.category || "THRESHOLD").toUpperCase();
    setCategory(cat);
    setOperator(String(def.operator || "GT").toUpperCase());
    setTargetValue(
      def.targetValue != null && def.targetValue !== "" ? String(def.targetValue) : ""
    );
    if (def.targetPointId) {
      setTargetRef(`id:${def.targetPointId}`);
    } else if (def.targetPointKey) {
      setTargetRef(`key:${def.targetPointKey}`);
    } else {
      setTargetRef("");
    }
    setDeadband(def.deadband != null && def.deadband !== "" ? String(def.deadband) : "");
    setDelaySeconds(
      def.delaySeconds != null && def.delaySeconds !== "" ? String(def.delaySeconds) : ""
    );
    setEnabled(def.enabled !== false);
    setMessageTemplate(def.messageTemplate != null ? String(def.messageTemplate) : "");
  }, []);

  const beginEditDefinition = useCallback(
    (def) => {
      if (!def?.id) return;
      setEditingDefinitionId(def.id);
      populateFormFromDefinition(def);
      setError(null);
      setScreen("create");
    },
    [populateFormFromDefinition]
  );

  const confirmDeleteDefinition = useCallback(async () => {
    if (!deleteConfirmDef?.id || !canUseApi) return;
    setDeleting(true);
    setDeleteActionError(null);
    try {
      await operatorRepository.deleteOperatorAlarmDefinition(siteId, deleteConfirmDef.id);
      if (typeof onSaved === "function") {
        onSaved();
      }
      setDeleteConfirmDef(null);
      const next = await refreshDefinitions();
      setEditingDefinitionId(null);
      resetCreateForm();
      if (next.length === 0) {
        setScreen("create");
      }
    } catch (err) {
      setDeleteActionError(err?.message || String(err));
    } finally {
      setDeleting(false);
    }
  }, [
    deleteConfirmDef,
    canUseApi,
    siteId,
    onSaved,
    refreshDefinitions,
    resetCreateForm,
  ]);

  const openDeleteConfirm = useCallback((def) => {
    setDeleteActionError(null);
    setDeleteConfirmDef(def);
  }, []);

  const pointHeader = primaryRow ? (
    isBulk ? null : (
      <div className="small text-white-50 mb-3">
        <span className="text-white fw-semibold">{primaryRow.equipmentName}</span>
        <span className="mx-1">·</span>
        <span>{primaryRow.pointKey || primaryRow.pointId}</span>
        {(primaryRow.pointDescription || primaryRow.pointName) &&
        (primaryRow.pointKey || primaryRow.pointId) !== (primaryRow.pointDescription || primaryRow.pointName) ? (
          <span> — {primaryRow.pointDescription || primaryRow.pointName}</span>
        ) : null}
      </div>
    )
  ) : null;

  const goToCreate = () => {
    setEditingDefinitionId(null);
    resetCreateForm();
    setError(null);
    setScreen("create");
  };

  const handleCreateCancel = () => {
    if (editingDefinitionId) {
      setEditingDefinitionId(null);
      setError(null);
      resetCreateForm();
      setScreen("view");
      return;
    }
    if (existingDefinitions.length > 0) {
      setError(null);
      setScreen("hub");
    } else {
      onHide();
    }
  };

  return (
    <>
    <Modal
      show={show}
      onHide={onHide}
      centered
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header closeButton closeVariant="white" className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">
          {isBulk ? `Alarm for ${effectiveRows.length} points` : "Alarm"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-white">
        {!primaryRow ? null : !canUseApi ? (
          <p className="small text-white-50 mb-0">
            Select an API-backed site to configure alarms. Engineering alarms are stored on equipment logical
            points in the database.
          </p>
        ) : screen === "loading" ? (
          <>
            {pointHeader}
            <p className="small text-white-50 mb-0">Loading alarm rules…</p>
          </>
        ) : screen === "hub" ? (
          <>
            {pointHeader}
            <p className="small text-white-50 mb-3">
              This point has {existingDefinitions.length} alarm rule
              {existingDefinitions.length !== 1 ? "s" : ""}. View what is configured or add another rule.
            </p>
            <div className="d-grid gap-2">
              <Button variant="light" className="text-dark" onClick={() => setScreen("view")}>
                View alarm rules
              </Button>
              <Button variant="outline-light" className="border-opacity-25" onClick={goToCreate}>
                Create new alarm rule
              </Button>
            </div>
          </>
        ) : screen === "view" ? (
          <>
            {pointHeader}
            {loadError ? (
              <div className="alert alert-warning py-2 small mb-3">{loadError}</div>
            ) : null}
            {existingDefinitions.length === 0 ? (
              <p className="small text-white-50 mb-0">No alarm rules for this point.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {existingDefinitions.map((def, idx) => {
                  const cat = String(def.category || "").toUpperCase();
                  return (
                  <div
                    key={def.id || idx}
                    className="border border-light border-opacity-10 rounded p-3 small"
                  >
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div className="text-white fw-semibold">{def.name || "Alarm rule"}</div>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <Button
                          type="button"
                          variant="outline-light"
                          size="sm"
                          className="py-0 px-2 border-opacity-25"
                          onClick={() => beginEditDefinition(def)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline-danger"
                          size="sm"
                          className="py-0 px-2"
                          onClick={() => openDeleteConfirm(def)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <dl className="row mb-0 gx-2">
                      <dt className="col-5 text-white-50">Enabled</dt>
                      <dd className="col-7 mb-1">{def.enabled !== false ? "Yes" : "No"}</dd>
                      <dt className="col-5 text-white-50">Severity</dt>
                      <dd className="col-7 mb-1">{severityLabel(def.severity)}</dd>
                      <dt className="col-5 text-white-50">Binding</dt>
                      <dd className="col-7 mb-1">
                        {def.sourceBinding === "READY" ? "Bound / ready" : "Pending binding"}
                      </dd>
                      <dt className="col-5 text-white-50">Rule type</dt>
                      <dd className="col-7 mb-1">{categoryLabel(def.category)}</dd>
                      <dt className="col-5 text-white-50">Operator</dt>
                      <dd className="col-7 mb-1">{operatorLabel(cat, def.operator)}</dd>
                      {(cat === "THRESHOLD" || cat === "DEVIATION") && (
                        <>
                          <dt className="col-5 text-white-50">
                            {cat === "DEVIATION" ? "Deviation (X)" : "Threshold"}
                          </dt>
                          <dd className="col-7 mb-1">
                            {def.targetValue != null && def.targetValue !== "" ? String(def.targetValue) : "—"}
                          </dd>
                        </>
                      )}
                      {(cat === "DEVIATION" || cat === "COMPARISON") && (
                        <>
                          <dt className="col-5 text-white-50">Reference</dt>
                          <dd className="col-7 mb-1 font-monospace">
                            {def.targetPoint
                              ? [def.targetPoint.pointCode, def.targetPoint.pointName]
                                  .filter(Boolean)
                                  .join(" — ") || "—"
                              : def.targetPointKey || "—"}
                          </dd>
                        </>
                      )}
                      {cat === "THRESHOLD" && (
                        <>
                          <dt className="col-5 text-white-50">Deadband</dt>
                          <dd className="col-7 mb-1">
                            {def.deadband != null && def.deadband !== "" ? String(def.deadband) : "—"}
                          </dd>
                        </>
                      )}
                      <dt className="col-5 text-white-50">Delay (s)</dt>
                      <dd className="col-7 mb-1">
                        {def.delaySeconds != null && def.delaySeconds !== "" ? String(def.delaySeconds) : "—"}
                      </dd>
                      <dt className="col-5 text-white-50">Message</dt>
                      <dd className="col-7 mb-1 text-break">{def.messageTemplate?.trim() || "—"}</dd>
                    </dl>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Form id="operator-alarm-config-form" onSubmit={handleSubmit}>
            {pointHeader}

            {isBulk ? (
              <p className="small text-white-50 mb-3">
                Applies the same alarm rule to all selected compatible points.
              </p>
            ) : null}

            {bulkSaveMessage ? (
              <div className="alert alert-success py-2 small mb-3">{bulkSaveMessage}</div>
            ) : null}

            {anyRowUnbound || (!isBulk && !isBoundToDb) ? (
              <p className="small text-white-50 border border-light border-opacity-10 rounded p-2 mb-3">
                {anyRowUnbound
                  ? "One or more points are unbound. Each alarm is stored on that equipment's logical point and will evaluate once a live point is mapped to the same key."
                  : "This point is currently unbound. The alarm is saved on the equipment logical point and will begin evaluating automatically once a live point is mapped (matching this point key in the database)."}
              </p>
            ) : null}

            {loadError && existingDefinitions.length === 0 ? (
              <div className="alert alert-warning py-2 small mb-3">{loadError}</div>
            ) : null}
            {error ? <div className="alert alert-danger py-2 small mb-3">{error}</div> : null}

            <Form.Group className="mb-2">
              <Form.Label className="small">Name</Form.Label>
              <Form.Control
                className="bg-dark border border-light border-opacity-10 text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small">Severity</Form.Label>
              <Form.Select
                className="bg-dark border border-light border-opacity-10 text-white"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small">Rule type</Form.Label>
              <Form.Select
                className="bg-dark border border-light border-opacity-10 text-white"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small">Operator</Form.Label>
              <Form.Select
                className="bg-dark border border-light border-opacity-10 text-white"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              >
                {operatorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            {(category === "THRESHOLD" || category === "DEVIATION") && (
              <Form.Group className="mb-2">
                <Form.Label className="small">
                  {category === "DEVIATION" ? "Deviation amount (X)" : "Threshold value"}
                </Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  className="bg-dark border border-light border-opacity-10 text-white"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </Form.Group>
            )}

            {(category === "DEVIATION" || category === "COMPARISON") && (
              <Form.Group className="mb-2">
                <Form.Label className="small">Reference point</Form.Label>
                <Form.Select
                  className="bg-dark border border-light border-opacity-10 text-white"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                >
                  <option value="">— Select point —</option>
                  {siblingPoints.map((p) => {
                    const v = siblingRefValue(p);
                    if (!v) return null;
                    return (
                      <option key={v} value={v}>
                        {p.pointKey || p.pointId} — {p.pointDescription || p.pointName || ""}
                        {!p.databasePointId ? " (unbound)" : ""}
                      </option>
                    );
                  })}
                </Form.Select>
                {siblingPoints.length === 0 ? (
                  <Form.Text className="text-white-50">
                    No other points on this equipment in the current release.
                  </Form.Text>
                ) : null}
              </Form.Group>
            )}

            {category === "THRESHOLD" && (
              <Form.Group className="mb-2">
                <Form.Label className="small">Deadband (optional, clear hysteresis)</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  className="bg-dark border border-light border-opacity-10 text-white"
                  value={deadband}
                  onChange={(e) => setDeadband(e.target.value)}
                  placeholder="0"
                />
              </Form.Group>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small">Delay before alarm (seconds, optional)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                className="bg-dark border border-light border-opacity-10 text-white"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                placeholder="0"
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Check
                type="switch"
                id={editingDefinitionId ? `alarm-enabled-${editingDefinitionId}` : "alarm-enabled"}
                label="Enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="text-white"
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small">Message (optional template)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                className="bg-dark border border-light border-opacity-10 text-white"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Use {value} or {name} placeholders"
              />
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10 d-flex flex-wrap gap-2">
        {!primaryRow || !canUseApi ? (
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        ) : screen === "loading" ? (
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
        ) : screen === "hub" ? (
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        ) : screen === "view" ? (
          <>
            <Button variant="outline-light" className="border-opacity-25" onClick={() => setScreen("hub")}>
              Back
            </Button>
            <Button variant="outline-light" className="border-opacity-25" onClick={goToCreate}>
              Create new rule
            </Button>
            <Button variant="secondary" className="ms-auto" onClick={onHide}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleCreateCancel}>
              {editingDefinitionId ? "Cancel" : existingDefinitions.length > 0 ? "Back" : "Cancel"}
            </Button>
            <Button
              variant="success"
              className="ms-auto"
              type="submit"
              form="operator-alarm-config-form"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingDefinitionId
                  ? "Save changes"
                  : isBulk
                    ? `Save to ${effectiveRows.length} points`
                    : "Save rule"}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>

    <Modal
      show={Boolean(deleteConfirmDef)}
      onHide={() => {
        if (!deleting) {
          setDeleteConfirmDef(null);
          setDeleteActionError(null);
        }
      }}
      centered
      contentClassName="bg-primary border border-light border-opacity-10 text-white"
    >
      <Modal.Header closeButton closeVariant="white" className="border-light border-opacity-10">
        <Modal.Title className="h6 text-white">Delete alarm rule</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-white">
        {deleteConfirmDef ? (
          <p className="small mb-2">
            Delete <span className="text-white fw-semibold">{deleteConfirmDef.name || "this rule"}</span>? This
            cannot be undone.
          </p>
        ) : null}
        {deleteActionError ? (
          <div className="alert alert-danger py-2 small mb-0">{deleteActionError}</div>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="border-light border-opacity-10">
        <Button
          variant="secondary"
          onClick={() => {
            setDeleteConfirmDef(null);
            setDeleteActionError(null);
          }}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button variant="danger" onClick={confirmDeleteDefinition} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
}
