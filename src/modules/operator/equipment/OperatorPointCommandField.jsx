import React from "react";
import { Form } from "@themesberg/react-bootstrap";

function parseNumericForOperator(raw) {
  if (raw === null || raw === undefined || raw === "—") return "";
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const m = String(raw).match(/^-?\d*\.?\d+/);
  return m ? parseFloat(m[0]) : "";
}

function isBooleanActive(raw) {
  return (
    raw === true ||
    raw === "active" ||
    String(raw).toLowerCase() === "on" ||
    raw === 1
  );
}

/**
 * @param {import("../../../lib/data/contracts").WorkspaceRow[]} rows
 * @returns {{ mode: 'empty'|'mixed'|'generic'|'typed', commandType?: string, commandConfig?: object, allOperational?: boolean, types?: string[], hint?: string, readOnlySensorUi?: boolean }}
 */
export function getCommandProfileForRows(rows) {
  if (!rows?.length) return { mode: "empty" };
  const types = rows.map((r) => r.commandType || "none");
  const unique = [...new Set(types)];
  if (unique.length > 1) {
    return { mode: "mixed", types: unique };
  }
  const t = unique[0];
  if (t === "none") {
    return {
      mode: "generic",
      hint: "These points are read-only on the template. Set service state for operations, or restore live values.",
      readOnlySensorUi: true,
    };
  }
  if (rows.some((r) => r.writable === false)) {
    return { mode: "generic", hint: "At least one selected point is not writable." };
  }
  const allOperational = rows.every((r) => {
    const s = r.status;
    return s === "OK" && s !== "Unbound" && s !== "OFFLINE";
  });
  return {
    mode: "typed",
    commandType: t,
    commandConfig: rows[0].commandConfig || {},
    allOperational,
  };
}

/**
 * @param {import("../../../lib/data/contracts").WorkspaceRow[]} rows
 * @param {{ mode: string, commandType?: string, commandConfig?: object }} profile
 */
export function getInitialCommandValue(rows, profile) {
  if (profile.mode !== "typed" || !rows.length) return "";
  const r = rows[0];
  const ct = profile.commandType;
  const cfg = profile.commandConfig || {};
  const raw = r.presentValueRaw;

  if (ct === "boolean") {
    return isBooleanActive(raw);
  }
  if (ct === "numeric" || ct === "percentage") {
    const n = parseNumericForOperator(raw);
    return n === "" ? "" : n;
  }
  if (ct === "enum") {
    const opts = cfg.options || [];
    const strVal = raw != null && raw !== "" ? String(raw) : "";
    const match = opts.some((o) => String(o.value) === strVal);
    if (match) return raw;
    if (opts.length > 0) return opts[0].value;
    return "";
  }
  return "";
}

/** Format command for confirm toast / API payload */
export function formatCommandValueForDisplay(commandType, value, commandConfig) {
  if (value === "" || value === undefined || value === null) return "(empty)";
  if (commandType === "boolean") return value ? "On" : "Off";
  if (commandType === "percentage") return `${value}%`;
  if (commandType === "numeric") {
    const u = commandConfig?.unit;
    return u ? `${value} ${u}` : String(value);
  }
  if (commandType === "enum" && commandConfig?.options) {
    const m = commandConfig.options.find((o) => String(o.value) === String(value));
    return m ? m.label : String(value);
  }
  return String(value);
}

/**
 * Single dynamic control for workspace command modal (and reusable elsewhere).
 */
export function OperatorPointCommandField({
  commandType,
  commandConfig = {},
  value,
  onChange,
  disabled = false,
  idSuffix = "modal",
}) {
  const cfg = commandConfig || {};

  if (commandType === "numeric" || commandType === "percentage") {
    const num =
      value === "" || value === null || value === undefined
        ? ""
        : typeof value === "number"
          ? value
          : parseNumericForOperator(value);
    const inputVal = num === "" ? "" : String(num);
    return (
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <Form.Control
          type="number"
          className="bg-dark border border-light border-opacity-10 text-white"
          style={{ maxWidth: 200 }}
          value={inputVal}
          min={cfg.min != null ? cfg.min : undefined}
          max={cfg.max != null ? cfg.max : undefined}
          step={cfg.step != null ? cfg.step : undefined}
          disabled={disabled}
          onChange={(e) => {
            const t = e.target.value;
            onChange(t === "" ? "" : t);
          }}
        />
        {commandType === "percentage" && <span className="text-white-50 small">%</span>}
        {commandType === "numeric" && cfg.unit && <span className="text-white-50 small">{cfg.unit}</span>}
      </div>
    );
  }

  if (commandType === "boolean") {
    const active = isBooleanActive(value);
    return (
      <Form.Check
        type="switch"
        id={`op-cmd-bool-${idSuffix}`}
        checked={!!active}
        disabled={disabled}
        label={active ? cfg.onLabel || "On" : cfg.offLabel || "Off"}
        className="text-white mb-0"
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (commandType === "enum") {
    const opts = cfg.options || [];
    const strVal = String(value != null && value !== "" ? value : "");
    const match = opts.some((o) => String(o.value) === strVal);
    return (
      <Form.Select
        className="bg-dark border border-light border-opacity-10 text-white"
        style={{ maxWidth: 320 }}
        value={match ? strVal : ""}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          const opt = opts.find((o) => String(o.value) === v);
          onChange(opt ? opt.value : v);
        }}
      >
        {!match && <option value="">—</option>}
        {opts.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </Form.Select>
    );
  }

  return null;
}
