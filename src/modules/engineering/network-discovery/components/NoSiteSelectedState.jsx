import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";

/**
 * State when no site is selected (e.g. New Building with no discovery context).
 */
export default function NoSiteSelectedState() {
  return (
    <div className="discovery-empty-state text-center py-5 px-4">
      <div className="discovery-empty-icon mb-3">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="fa-3x text-white-50" />
      </div>
      <h6 className="text-white fw-bold mb-2">Select a site to begin network discovery</h6>
      <p className="text-white-50 small mb-0 mx-auto" style={{ maxWidth: 360 }}>
        Use the site selector in the sidebar to choose a site. Network discovery runs in the context of the selected site.
      </p>
    </div>
  );
}
