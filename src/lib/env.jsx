/**
 * Central env-var accessor (Phase 3: CRA -> Vite). Vite exposes build-time env vars via
 * `import.meta.env`, not `process.env` — this is the one place that reads it, so the rest of the
 * app never has to know which bundler is in play. `envPrefix: ["VITE_", "REACT_APP_"]` in
 * vite.config.js keeps existing REACT_APP_*-prefixed .env/.env.local values working unchanged.
 * @param {string} name - full var name, e.g. "REACT_APP_API_BASE_URL"
 * @returns {string | undefined}
 */
export function getEnv(name) {
  try {
    const env = import.meta.env;
    return env ? env[name] : undefined;
  } catch (_) {
    return undefined;
  }
}
