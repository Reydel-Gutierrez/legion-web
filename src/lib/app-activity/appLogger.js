import { withAppActivityBridge } from "./appActivityBridge";
import { LOG_CATEGORY } from "./types";

/**
 * Persistent app activity log (session + localStorage).
 */
export const appLogger = {
  success(message, meta) {
    withAppActivityBridge((b) => b.log(LOG_CATEGORY.SUCCESS, message, meta));
  },
  info(message, meta) {
    withAppActivityBridge((b) => b.log(LOG_CATEGORY.INFO, message, meta));
  },
  error(message, meta) {
    withAppActivityBridge((b) => b.log(LOG_CATEGORY.ERROR, message, meta));
  },
  api(payload, meta) {
    withAppActivityBridge((b) => b.logApi(payload, meta));
  },
  open() {
    withAppActivityBridge((b) => {
      if (b.openLogs) b.openLogs();
    });
  },
};
