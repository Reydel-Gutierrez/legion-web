// Shape of Legion Runtime's own health/status summary (runtimeCore.getStatus() in
// runtime/src/core/runtimeCore.js, served at GET /health and GET /runtime/status, proxied to the
// frontend unchanged). This is the process-level Runtime status — distinct from
// CommDisplayStatus (src/lib/operator/statusUtils.jsx), which is a frontend-computed per-site/
// per-equipment freshness label, and from ControllerRuntimeState.status, which is per-controller.
export interface RuntimeProtocolStatus {
  configured: number;
  online: number;
  offline: number;
  driver?: string;
}

export interface RuntimeStatus {
  initialized: boolean;
  dbReachable: boolean;
  pollLoopRunning: boolean;
  controllerCount: number;
  onlineControllerCount: number;
  offlineControllerCount: number;
  sites: string[];
  protocols: {
    SIM?: RuntimeProtocolStatus;
    BACNET_IP?: RuntimeProtocolStatus;
    [protocol: string]: RuntimeProtocolStatus | undefined;
  };
}
