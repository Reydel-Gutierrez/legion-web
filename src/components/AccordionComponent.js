import React, { useMemo, useState } from "react";
import { Card, Accordion } from "@themesberg/react-bootstrap";

export default function MultiAccordion({ defaultKeys = [], data = [], className = "" }) {
  const allKeys = useMemo(() => data.map(d => String(d.eventKey)), [data]);

  // If you pass a single defaultKey somewhere, normalize it to array
  const initial = Array.isArray(defaultKeys)
    ? defaultKeys.map(String)
    : defaultKeys
    ? [String(defaultKeys)]
    : [];

  const [activeKeys, setActiveKeys] = useState(initial);

  const toggle = (k) => {
    k = String(k);
    setActiveKeys(prev => (
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    ));
  };

  return (
    <Accordion className={className} alwaysOpen activeKey={activeKeys}>
      {data.map((item) => {
        const k = String(item.eventKey);
        return (
          <Accordion.Item key={`accordion-${item.id}`} eventKey={k}>
            <Accordion.Header onClick={() => toggle(k)}>
              <span className="h6 mb-0 fw-bold">{item.title}</span>
            </Accordion.Header>

            <Accordion.Body>
              <Card.Body className="py-2 px-0">
                <Card.Text className="mb-0">{item.description}</Card.Text>
              </Card.Body>
            </Accordion.Body>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
