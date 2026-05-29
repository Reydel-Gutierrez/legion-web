import { APP_LOGS_STORAGE_KEY, MAX_APP_LOGS } from "./types";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** @returns {import("./types").AppLogEntry[]} */
export function loadPersistedLogs() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(APP_LOGS_STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e.id === "string" && typeof e.message === "string")
    .slice(0, MAX_APP_LOGS);
}

/** @param {import("./types").AppLogEntry[]} logs */
export function persistLogs(logs) {
  if (typeof window === "undefined") return;
  const trimmed = logs.slice(0, MAX_APP_LOGS);
  try {
    window.localStorage.setItem(APP_LOGS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded — drop oldest half and retry once */
    try {
      window.localStorage.setItem(APP_LOGS_STORAGE_KEY, JSON.stringify(trimmed.slice(0, Math.floor(MAX_APP_LOGS / 2))));
    } catch {
      /* ignore */
    }
  }
}
