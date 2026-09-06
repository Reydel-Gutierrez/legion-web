import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-regular-svg-icons";

export default function EquipmentOccupancyChip({ occupancy, onOpen }) {
  const occupied = Boolean(occupancy?.occupied);
  const label = occupancy?.label || "Unoccupied";
  const interactive = typeof onOpen === "function";
  const className = `occupancy-chip${occupied ? " occupancy-chip--occupied" : " occupancy-chip--unoccupied"}${
    interactive ? " occupancy-chip--button" : ""
  }`;

  const inner = (
    <>
      <span className="occupancy-chip__icon" aria-hidden="true">
        <FontAwesomeIcon icon={faUser} />
      </span>
      <div className="occupancy-chip__copy">
        <span className="occupancy-chip__label">Occupancy</span>
        <strong className="occupancy-chip__value">{label}</strong>
      </div>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onOpen}
        aria-label={`Occupancy ${label}. Open schedule.`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} role="status" aria-label={`Occupancy ${label}`}>
      {inner}
    </div>
  );
}
