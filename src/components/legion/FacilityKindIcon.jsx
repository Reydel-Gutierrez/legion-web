import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faGlobeAmericas, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import PlcControllerIcon from "./PlcControllerIcon";

/**
 * Hierarchy glyph for Site / Building / Floor / Equipment.
 * Equipment uses a PLC-style controller mark; the rest are Font Awesome.
 */
export default function FacilityKindIcon({ kind, className = "" }) {
  if (kind === "site") {
    return <FontAwesomeIcon icon={faGlobeAmericas} className={className} />;
  }
  if (kind === "building") {
    return <FontAwesomeIcon icon={faBuilding} className={className} />;
  }
  if (kind === "floor") {
    return <FontAwesomeIcon icon={faLayerGroup} className={className} />;
  }
  return <PlcControllerIcon className={className} />;
}
