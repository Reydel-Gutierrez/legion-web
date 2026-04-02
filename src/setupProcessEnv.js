/**
 * Ensure `process` exists before any other app code runs. Some transitive deps
 * reference process.env in the browser; Create React App normally inlines env,
 * but a bare `process` access can still throw if the global is missing.
 */
if (typeof window !== "undefined" && typeof window.process === "undefined") {
  window.process = { env: {} };
}
