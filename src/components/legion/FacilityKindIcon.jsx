import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faGlobeAmericas,
  faLayerGroup,
  faSlidersH,
  faNetworkWired,
  faServer,
} from "@fortawesome/free-solid-svg-icons";
import PlcControllerIcon from "./PlcControllerIcon";

/**
 * Hierarchy glyph for Site / Building / Floor / Equipment, plus the fixed General/Network/System
 * settings leaves under a site. Equipment uses a PLC-style controller mark; the rest are Font Awesome.
 */
export default function FacilityKindIcon({ kind, className = "", style }) {
  if (kind === "site") {
    return <FontAwesomeIcon icon={faGlobeAmericas} className={className} style={style} />;
  }
  if (kind === "building") {
    return <FontAwesomeIcon icon={faBuilding} className={className} style={style} />;
  }
  if (kind === "floor") {
    return <FontAwesomeIcon icon={faLayerGroup} className={className} style={style} />;
  }
  if (kind === "general") {
    return <FontAwesomeIcon icon={faSlidersH} className={className} style={style} />;
  }
  if (kind === "network") {
    return <FontAwesomeIcon icon={faNetworkWired} className={className} style={style} />;
  }
  if (kind === "system") {
    return <FontAwesomeIcon icon={faServer} className={className} style={style} />;
  }
  return <PlcControllerIcon className={className} style={style} />;
}
