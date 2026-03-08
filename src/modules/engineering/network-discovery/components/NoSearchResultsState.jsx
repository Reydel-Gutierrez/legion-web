import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

/**
 * State when search/filter returns no results.
 */
export default function NoSearchResultsState() {
  return (
    <div className="discovery-no-results text-center py-4 px-4">
      <FontAwesomeIcon icon={faSearch} className="fa-2x text-white-50 mb-2" />
      <div className="text-white-50 small">No devices match your search or filters.</div>
    </div>
  );
}
