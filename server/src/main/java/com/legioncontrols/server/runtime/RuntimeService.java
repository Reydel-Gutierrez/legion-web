package com.legioncontrols.server.runtime;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.JsonNodeFactory;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Java equivalent of backend/src/modules/runtime/runtime.service.ts — a thin HTTP CLIENT to the
 * standalone Legion Runtime process. Every method keeps the same shape/behavior as its Node
 * counterpart (LC-ARCH-004 Phase 2): Runtime owns polling/BACnet/SIM entirely, this Server never
 * regains a direct/in-process implementation.
 */
@Service
public class RuntimeService {

    private static final Logger log = LoggerFactory.getLogger(RuntimeService.class);

    private final RuntimeClient client;

    public RuntimeService(RuntimeClient client) {
        this.client = client;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public JsonNode listControllers() {
        JsonNode result = client.get("/runtime/controllers");
        return result != null ? result : JsonNodeFactory.instance.arrayNode();
    }

    public JsonNode getController(String code) {
        return client.get("/runtime/controllers/" + encode(code), null);
    }

    public JsonNode listFieldPointsForController(String code) {
        JsonNode body = client.get("/runtime/controllers/" + encode(code) + "/field-points", null);
        return body != null ? body.get("points") : null;
    }

    public JsonNode setOnline(String code, boolean online) {
        String path = "/runtime/controllers/" + encode(code) + "/" + (online ? "online" : "offline");
        return client.post(path, Map.of(), null);
    }

    public JsonNode setSimEnabled(String code, boolean enabled) {
        String path = "/runtime/controllers/" + encode(code) + "/" + (enabled ? "start" : "stop");
        return client.post(path, Map.of(), null);
    }

    public JsonNode pollNow(String code) {
        return client.post("/runtime/controllers/" + encode(code) + "/poll-now", Map.of(), null);
    }

    /**
     * WRITE: the only path a live field write reaches a real device through — this Server -> Runtime
     * internal API -> BacnetDriver -> device. Mirrors runtime.service.ts#writePoint exactly.
     */
    public JsonNode writePoint(String code, String fieldPointKey, Object value, Integer priority) {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("fieldPointKey", fieldPointKey);
        payload.putPOJO("value", value);
        if (priority != null) {
            payload.put("priority", priority);
        }
        return client.post("/runtime/controllers/" + encode(code) + "/write", payload, null);
    }

    public JsonNode listDiscoveryDevices(String siteId) {
        String qs = (siteId != null && !siteId.isBlank()) ? "?siteId=" + encode(siteId) : "";
        JsonNode body = client.get("/runtime/discovery-devices" + qs);
        JsonNode devices = body != null ? body.get("devices") : null;
        return devices != null ? devices : JsonNodeFactory.instance.arrayNode();
    }

    /**
     * RELOAD: tells Runtime to re-resolve its controller store against freshly materialized
     * LiveControllerBinding rows. Deliberately never throws — a reload failure must never roll back
     * the DB activation that already committed (see releases.DeploymentService).
     */
    public JsonNode resyncLiveSimBindings() {
        try {
            return client.post("/runtime/reload", Map.of());
        } catch (Exception e) {
            log.warn("[runtime-client] reload failed — Runtime is unreachable or degraded: {}", e.getMessage());
            ObjectNode degraded = JsonNodeFactory.instance.objectNode();
            degraded.put("ok", false);
            degraded.put("reachable", false);
            return degraded;
        }
    }

    /** Non-throwing status probe for Server health endpoints. */
    public RuntimeClient.RuntimeProbe getRuntimeHealth() {
        return client.probe("/health");
    }
}
