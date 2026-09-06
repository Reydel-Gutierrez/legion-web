import React from "react";

export default function ExpandableWorkspaceCard({
  title,
  cardId,
  expandedId,
  onToggleExpand,
  children,
  className = "",
  headerExtra = null,
  footer = null,
  clipOverflow = false,
}) {
  const expanded = expandedId === cardId;

  return (
    <section
      className={`operator-card ${expanded ? "operator-card--expanded" : ""} ${
        clipOverflow ? "operator-card--clip" : ""
      } ${className}`.trim()}
    >
      <header className="operator-card__header">
        <h2 className="operator-card__title">{title}</h2>
        <div className="operator-card__header-right">
          {headerExtra}
          <button
            type="button"
            className="operator-card__expand"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            aria-pressed={expanded}
            onClick={() => onToggleExpand(expanded ? null : cardId)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {expanded ? (
                <path
                  d="M4 6.5 L8 10.5 L12 6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <path d="M3 3h4v1.4H4.4V7H3V3zm6 0h4v4h-1.4V4.4H9V3zM3 9h1.4v2.6H7V13H3V9zm8.6 0H13v4H9v-1.4h2.6V9z" fill="currentColor" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>
      <div className="operator-card__body">{children}</div>
      {footer ? <div className="operator-card__footer">{footer}</div> : null}
    </section>
  );
}
