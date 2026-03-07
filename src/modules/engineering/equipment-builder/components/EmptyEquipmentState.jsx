import React from "react";
import { Card } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog } from "@fortawesome/free-solid-svg-icons";

/**
 * Empty state when no equipment exists.
 * Centered onboarding panel with Add Equipment CTA.
 */
export default function EmptyEquipmentState({ onAddEquipment }) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onAddEquipment === "function") {
      onAddEquipment();
    }
  };

  return (
    <Card
      className="bg-primary border border-light border-opacity-10 shadow-sm"
      style={{ position: "relative", zIndex: 10 }}
    >
      <Card.Body className="text-center py-5 px-4">
        <FontAwesomeIcon icon={faCog} className="text-white-50 mb-3" style={{ fontSize: "2.5rem" }} />
        <h5 className="text-white fw-bold mb-3">No equipment defined yet</h5>
        <p
          className="text-white-50 mb-4"
          style={{ maxWidth: 400, margin: "0 auto 1rem" }}
        >
          Define and organize equipment for the selected site. Add equipment to get started.
        </p>
        <button
          type="button"
          className="legion-hero-btn legion-hero-btn--primary"
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          Add Equipment
        </button>
      </Card.Body>
    </Card>
  );
}
