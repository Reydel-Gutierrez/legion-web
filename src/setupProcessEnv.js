/* eslint-env browser */
/**
 * Ensure `process` exists before any other app code runs. Some transitive deps
 * reference process.env in the browser; Create React App normally inlines env,
 * but a bare `process` access can still throw if the global is missing.
 *
 * CRA runs in a browser context; attaching to `window` is enough for typical
 * main-thread bundles. (Workers or non-window hosts would need a different shim.)
 */
(function ensureProcessGlobal() {
  if (typeof window === "undefined") return;
  if (typeof window.process === "undefined") {
    window.process = { env: {} };
  }
})();
