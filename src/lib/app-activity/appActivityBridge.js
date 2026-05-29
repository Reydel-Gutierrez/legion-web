/** @typedef {import('./types').AppActivityBridge} AppActivityBridge */

/** @type {AppActivityBridge | null} */
let bridge = null;

/** @param {AppActivityBridge | null} next */
export function registerAppActivityBridge(next) {
  bridge = next;
}

/** @returns {AppActivityBridge | null} */
export function getAppActivityBridge() {
  return bridge;
}

/** Run `run(bridge)` when the provider has registered a bridge (avoids optional-call syntax). */
export function withAppActivityBridge(run) {
  const b = getAppActivityBridge();
  if (b) run(b);
}
