import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faInfoCircle, faTimes, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { TOAST_VARIANT } from "../../lib/app-activity/types";

const ICON_BY_VARIANT = {
  [TOAST_VARIANT.SUCCESS]: faCheckCircle,
  [TOAST_VARIANT.INFO]: faInfoCircle,
  [TOAST_VARIANT.ERROR]: faExclamationTriangle,
};

/**
 * @param {{ toasts: { id: string, variant: string, message: string }[], onDismiss: (id: string) => void }} props
 */
export default function AppActivityToasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="legion-app-toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`legion-app-toast legion-app-toast--${toast.variant || TOAST_VARIANT.INFO}`}
        >
          <FontAwesomeIcon icon={ICON_BY_VARIANT[toast.variant] || faInfoCircle} className="legion-app-toast-icon" />
          <span className="legion-app-toast-message">{toast.message}</span>
          <button
            type="button"
            className="legion-app-toast-close"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ))}
    </div>
  );
}
