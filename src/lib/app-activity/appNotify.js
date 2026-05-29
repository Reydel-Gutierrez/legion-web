import { withAppActivityBridge } from "./appActivityBridge";

/**
 * Temporary app-level feedback (not BAS alarms).
 */
export const appNotify = {
  success(message, options) {
    withAppActivityBridge((b) => b.notify("success", message, options));
  },
  info(message, options) {
    withAppActivityBridge((b) => b.notify("info", message, options));
  },
  error(message, options) {
    withAppActivityBridge((b) => b.notify("error", message, options));
  },
  dismiss(id) {
    withAppActivityBridge((b) => {
      if (b.dismissToast) b.dismissToast(id);
    });
  },
};
