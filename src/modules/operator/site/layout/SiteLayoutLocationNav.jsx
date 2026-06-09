import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

function SiteLayoutNavArrows({ layoutNav }) {
  if (!layoutNav) return null;
  const { canGoBack, canGoForward, onBack, onForward } = layoutNav;
  return (
    <div className="site-layout-location-nav__history" aria-label="Layout navigation">
      <button
        type="button"
        className="site-layout-location-nav__history-btn"
        disabled={!canGoBack}
        onClick={onBack}
        aria-label="Go back"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <button
        type="button"
        className="site-layout-location-nav__history-btn"
        disabled={!canGoForward}
        onClick={onForward}
        aria-label="Go forward"
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
}

/**
 * Shared location bar for all Site Layout views — history arrows + breadcrumb trail.
 */
export default function SiteLayoutLocationNav({ layoutNav, breadcrumb, onSelectLevel }) {
  return (
    <nav
      aria-label="Site location"
      className="site-layout-location-nav d-flex align-items-center flex-wrap gap-2 text-white-50 small mb-3"
    >
      <SiteLayoutNavArrows layoutNav={layoutNav} />
      <div className="site-layout-location-nav__trail d-flex align-items-center flex-wrap gap-1">
        <span className="text-white-50">Site Layout</span>
        {breadcrumb.map((seg, i) => (
          <span key={seg.id} className="d-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faChevronRight} className="fa-xs opacity-50" />
            {i < breadcrumb.length - 1 ? (
              <button
                type="button"
                className="btn btn-link p-0 text-white-50 small text-decoration-none"
                onClick={() => onSelectLevel(seg.id)}
              >
                {seg.label}
              </button>
            ) : (
              <span className="text-white">{seg.label}</span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
