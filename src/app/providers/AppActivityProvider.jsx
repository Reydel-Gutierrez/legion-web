import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerAppActivityBridge } from "../../lib/app-activity/appActivityBridge";
import { loadPersistedLogs, persistLogs } from "../../lib/app-activity/logStorage";
import {
  DEFAULT_TOAST_MS,
  LOG_CATEGORY,
  MAX_APP_LOGS,
  TOAST_VARIANT,
} from "../../lib/app-activity/types";
import { formatApiLogMessage } from "../../lib/app-activity/apiActivity";
import AppActivityToasts from "../../components/app-activity/AppActivityToasts";
import AppLogsDrawer from "../../components/app-activity/AppLogsDrawer";

const AppActivityContext = createContext(null);

function createLogId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AppActivityProvider({ children }) {
  const [logs, setLogs] = useState(() => loadPersistedLogs());
  const [toasts, setToasts] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const toastTimersRef = useRef(new Map());

  const appendLog = useCallback((entry) => {
    setLogs((prev) => {
      const next = [{ ...entry, id: entry.id || createLogId() }, ...prev].slice(0, MAX_APP_LOGS);
      persistLogs(next);
      return next;
    });
  }, []);

  const log = useCallback(
    (category, message, meta, api) => {
      appendLog({
        id: createLogId(),
        timestamp: Date.now(),
        category,
        message,
        meta: meta && Object.keys(meta).length ? meta : undefined,
        api,
      });
    },
    [appendLog]
  );

  const logApi = useCallback(
    (payload, meta) => {
      const ok = payload.ok !== false && (payload.status == null || payload.status < 400);
      const message = formatApiLogMessage(payload.method, payload.endpoint, payload.status ?? 0, ok);
      log(LOG_CATEGORY.API, message, meta, {
        method: payload.method,
        endpoint: payload.endpoint,
        status: payload.status,
        durationMs: payload.durationMs,
        ok,
        error: payload.error,
      });
    },
    [log]
  );

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (variant, message, options = {}) => {
      const id = createToastId();
      const durationMs = options.durationMs ?? DEFAULT_TOAST_MS;
      setToasts((prev) => [...prev, { id, variant, message }].slice(-6));
      if (options.log !== false) {
        const category =
          variant === TOAST_VARIANT.ERROR
            ? LOG_CATEGORY.ERROR
            : variant === TOAST_VARIANT.INFO
              ? LOG_CATEGORY.INFO
              : LOG_CATEGORY.SUCCESS;
        log(category, message, options.meta);
      }
      const timer = setTimeout(() => dismissToast(id), durationMs);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast, log]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    persistLogs([]);
  }, []);

  const openLogs = useCallback(() => setLogsOpen(true), []);
  const closeLogs = useCallback(() => setLogsOpen(false), []);

  useEffect(() => {
    const bridge = {
      notify,
      log,
      logApi,
      openLogs,
      dismissToast,
    };
    registerAppActivityBridge(bridge);
    return () => registerAppActivityBridge(null);
  }, [notify, log, logApi, openLogs, dismissToast]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => clearTimeout(t));
      toastTimersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      logs,
      toasts,
      logsOpen,
      notify,
      log,
      logApi,
      clearLogs,
      openLogs,
      closeLogs,
      dismissToast,
    }),
    [logs, toasts, logsOpen, notify, log, logApi, clearLogs, openLogs, closeLogs, dismissToast]
  );

  const portal =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <AppActivityToasts toasts={toasts} onDismiss={dismissToast} />
            <AppLogsDrawer open={logsOpen} onClose={closeLogs} logs={logs} onClear={clearLogs} />
          </>,
          document.body
        )
      : null;

  return (
    <AppActivityContext.Provider value={value}>
      {children}
      {portal}
    </AppActivityContext.Provider>
  );
}

export function useAppActivity() {
  const ctx = useContext(AppActivityContext);
  if (!ctx) {
    throw new Error("useAppActivity must be used within AppActivityProvider");
  }
  return ctx;
}
