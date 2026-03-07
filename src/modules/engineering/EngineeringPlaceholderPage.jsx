import React from "react";
import { Container, Card } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../components/legion/LegionHeroHeader";

/**
 * Placeholder page for engineering routes. Replace with real implementation later.
 */
export default function EngineeringPlaceholderPage({ title }) {
  return (
    <Container className="py-4">
      <LegionHeroHeader />
      <Card className="bg-dark border-secondary p-4 mt-3">
        <h5 className="text-white mb-2">{title}</h5>
        <p className="text-muted mb-0">
          Coming soon. This engineering module is under development.
        </p>
      </Card>
    </Container>
  );
}
