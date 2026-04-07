/**
 * Ensure `process` exists before any other app code runs. Some transitive deps
 * reference process.env in the browser; Create React App normally inlines env,
 * but a bare `process` access can still throw if the global is missing.
 *
 * Only touches `window` (main-thread CRA app) to satisfy eslint: no-undef on
 * globalThis, no-restricted-globals on self.
 */
if (typeof window !== "undefined" && typeof window.process === "undefined") {
  window.process = { env: {} };
}
