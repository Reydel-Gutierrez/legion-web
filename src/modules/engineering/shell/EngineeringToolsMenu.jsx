import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { accessRepository } from "../../../lib/data";
import { canViewUserManager } from "../../../lib/access/currentUserAccess";
import { getEngineeringMenuBar } from "./engineeringToolsConfig";

function isPathActive(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** A single-destination tab (Templates, Graphics) — a plain link styled like the dropdown toggles, no chevron. */
function MenuLink({ menu }) {
  const { pathname } = useLocation();
  const active = isPathActive(pathname, menu.path);
  return (
    <Link
      to={menu.path}
      title={menu.title}
      className={`engineering-tools-menu__toggle engineering-tools-menu__toggle--link${active ? " is-active" : ""}`}
    >
      <FontAwesomeIcon icon={menu.icon} className="engineering-tools-menu__icon" />
      <span>{menu.title}</span>
    </Link>
  );
}

function MenuGroup({ menu, onAction }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const isActive = menu.items.some((item) => item.path && isPathActive(pathname, item.path));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={`engineering-tools-menu${isActive ? " is-active" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="engineering-tools-menu__toggle"
        title={menu.title}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FontAwesomeIcon icon={menu.icon} className="engineering-tools-menu__icon" />
        <span>{menu.title}</span>
        <FontAwesomeIcon icon={faChevronDown} className="engineering-tools-menu__chevron" />
      </button>
      {open ? (
        <ul className="engineering-tools-menu__dropdown" role="menu">
          {menu.items.map((item, i) =>
            item.divider ? (
              <li key={`divider-${i}`} className="engineering-tools-menu__divider" role="separator" />
            ) : item.path ? (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`engineering-tools-menu__item${isPathActive(pathname, item.path) ? " is-active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <FontAwesomeIcon icon={item.icon} className="engineering-tools-menu__item-icon" />
                  {item.title}
                </Link>
              </li>
            ) : (
              <li key={item.action}>
                <button
                  type="button"
                  className={`engineering-tools-menu__item${item.danger ? " is-danger" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    onAction(item.action);
                  }}
                >
                  <FontAwesomeIcon icon={item.icon} className="engineering-tools-menu__item-icon" />
                  {item.title}
                </button>
              </li>
            )
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default function EngineeringToolsMenu({ onAction }) {
  let currentUser = null;
  try {
    currentUser = accessRepository.getCurrentUserForAccess();
  } catch {
    currentUser = null;
  }
  const menus = getEngineeringMenuBar({ includeAdministration: canViewUserManager(currentUser) });

  return (
    <nav className="engineering-tools-menus" aria-label="Engineering menu">
      {menus.map((menu) =>
        menu.path ? (
          <MenuLink key={menu.title} menu={menu} />
        ) : (
          <MenuGroup key={menu.title} menu={menu} onAction={onAction} />
        )
      )}
    </nav>
  );
}
