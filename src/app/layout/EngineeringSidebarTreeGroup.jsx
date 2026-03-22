import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Nav } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";

function pathMatchesSection(pathname, sectionPaths) {
  if (!pathname || !sectionPaths?.length) return false;
  return sectionPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Expandable engineering sidebar group with tree branch lines (same pattern as former Network-only nav).
 *
 * @param {object} props
 * @param {string} props.title — Section label (parent row)
 * @param {object} props.parentIcon — Font Awesome icon definition
 * @param {string} props.parentPath — Primary route when clicking the parent label
 * @param {string[]} props.sectionPaths — Paths that keep the group expanded / "within section" styling
 * @param {{ path: string, title: string, icon: object }[]} props.children — Leaf routes
 * @param {() => void} [props.onNavigate] — e.g. close mobile drawer
 */
export default function EngineeringSidebarTreeGroup({
  title,
  parentIcon,
  parentPath,
  sectionPaths,
  children = [],
  onNavigate,
}) {
  const { pathname } = useLocation();
  const withinSection = useMemo(
    () => pathMatchesSection(pathname, sectionPaths),
    [pathname, sectionPaths]
  );
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (withinSection) setExpanded(true);
  }, [withinSection]);

  const closeMobile = () => onNavigate?.();

  return (
    <div className="legion-sidebar-tree">
      <div
        className={[
          "legion-sidebar-tree__parent",
          expanded ? "legion-sidebar-tree__parent--expanded" : "",
          withinSection ? "legion-sidebar-tree__parent--within" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="legion-sidebar-tree__parent-shell">
          <Link to={parentPath} className="legion-sidebar-tree__parent-link" onClick={closeMobile}>
            <span className="sidebar-icon legion-sidebar-tree__parent-icon">
              <FontAwesomeIcon icon={parentIcon} />
            </span>
            <span className="sidebar-text legion-sidebar-tree__parent-title">{title}</span>
          </Link>
          <button
            type="button"
            className="legion-sidebar-tree__expand-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onClick={(e) => {
              e.preventDefault();
              setExpanded((v) => !v);
            }}
          >
            <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} className="legion-sidebar-tree__expand-icon" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="legion-sidebar-tree__branch">
          <ul className="legion-sidebar-tree__leaves list-unstyled mb-0">
            {children.map((child, index) => {
              const isActive = pathname === child.path || pathname.startsWith(`${child.path}/`);
              const isLast = index === children.length - 1;
              return (
                <li
                  key={child.path}
                  className={["legion-sidebar-tree__leaf", isLast ? "legion-sidebar-tree__leaf--last" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Nav.Item className={`legion-sidebar-tree__nav-item${isActive ? " active" : ""}`}>
                    <Nav.Link
                      as={Link}
                      to={child.path}
                      className="legion-sidebar-tree__leaf-link"
                      onClick={closeMobile}
                    >
                      <span className="sidebar-icon legion-sidebar-tree__leaf-icon">
                        <FontAwesomeIcon icon={child.icon} />
                      </span>
                      <span className="sidebar-text legion-sidebar-tree__leaf-label">{child.title}</span>
                    </Nav.Link>
                  </Nav.Item>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
