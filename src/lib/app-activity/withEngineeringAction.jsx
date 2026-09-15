import { appNotify } from "./appNotify";
import { appLogger } from "./appLogger";

/**
 * Wrap an async engineering action with info/success/error toasts and logs.
 * @param {{
 *   area: string,
 *   action: string,
 *   infoMessage?: string,
 *   successMessage: string,
 *   errorMessage?: string,
 *   run: () => Promise<void>,
 *   toastOnStart?: boolean,
 * }} config
 */
export async function withEngineeringAction({
  area,
  action,
  infoMessage,
  successMessage,
  errorMessage = "Operation failed",
  run,
  toastOnStart = true,
}) {
  const meta = { area, action };
  if (infoMessage && toastOnStart) {
    appNotify.info(infoMessage, { log: false });
    appLogger.info(infoMessage, meta);
  } else if (infoMessage) {
    appLogger.info(infoMessage, meta);
  }
  try {
    await run();
    appNotify.success(successMessage, { log: false });
    appLogger.success(successMessage, meta);
  } catch (err) {
    const detail = err && err.message ? String(err.message) : undefined;
    appNotify.error(errorMessage, { log: false });
    appLogger.error(errorMessage, { ...meta, details: detail });
    throw err;
  }
}
