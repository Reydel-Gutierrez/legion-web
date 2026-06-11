import React from "react";
import { Form } from "@themesberg/react-bootstrap";

export const NETWORK_FIELD_CLASS = "legion-operator-log-field";

export default function NetworkConfigField({
  label,
  hint,
  htmlFor,
  children,
  className = "",
}) {
  return (
    <Form.Group className={`network-config-field ${className}`.trim()}>
      {label ? (
        <Form.Label htmlFor={htmlFor} className="network-config-field__label">
          {label}
        </Form.Label>
      ) : null}
      {children}
      {hint ? <div className="network-config-field__hint">{hint}</div> : null}
    </Form.Group>
  );
}
