import React from "react";
import { Card } from "@themesberg/react-bootstrap";

/**
 * Empty state when no site exists.
 * Centered onboarding panel with Create Site CTA.
 */
export default function EmptySiteState({ onCreateSite, onCreateClick }) {
  const handleCreate = onCreateSite || onCreateClick;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof handleCreate === "function") {
      handleCreate();
    }
  };

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm" style={{ position: "relative", zIndex: 10 }}>
      <Card.Body className="text-center py-5 px-4">
        <h5 className="text-white fw-bold mb-3">Create Your First Site</h5>
        <p className="text-white-50 mb-4" style={{ maxWidth: 400, margin: "0 auto 1rem" }}>
          The Site Builder defines the physical structure of your project.
          Start by creating the site and its first building.
        </p>
        <button
          type="button"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          Create Site
        </button>
      </Card.Body>
    </Card>
  );
}
