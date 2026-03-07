import React from "react";
import { Container } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";

/**
 * Basic Engineering Dashboard (LCC Dashboard).
 * Minimal placeholder for testing Engineering Mode.
 */
export default function EngineeringDashboardPage() {
  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h5 className="text-white fw-bold mb-1">LCC Dashboard</h5>
            <div className="text-white small">
              Engineering mode dashboard. Configuration tools and deployment status.
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
