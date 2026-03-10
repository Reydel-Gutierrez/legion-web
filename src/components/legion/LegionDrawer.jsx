import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Reusable right-side drawer that slides in from the right.
 * Does not cover the topbar or footer: uses --legion-topbar-h and --legion-footer-h
 * so the overlay and panel are inset between them.
 *
 * Use for equipment template editor, graphic editor, or any slide-out workspace.
 *
 * @param {boolean} open - Whether the drawer is visible
 * @param {function} onClose - Called when overlay is clicked or Escape is pressed
 * @param {React.ReactNode} children - Content of the drawer panel
 * @param {string|number} maxWidth - Max width of the panel (e.g. "960px" or 960). Default 720px.
 * @param {string} panelClassName - Optional extra class for the panel (e.g. "bg-primary border-start ...")
 * @param {string} ariaLabel - Accessibility label for the panel (default "Drawer")
 */
export default function LegionDrawer({
  open,
  onClose,
  children,
  maxWidth = "720px",
  panelClassName = "",
  ariaLabel = "Drawer",
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const panelWidth = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  const content = (
    <>
      <div
        className="legion-drawer-overlay"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close"
      />
      <div
        className={`legion-drawer-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-label={ariaLabel}
        style={{ "--legion-drawer-max-width": panelWidth }}
      >
        {children}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
