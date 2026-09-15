package com.legioncontrols.server.health;

import com.legioncontrols.server.runtime.RuntimeClient;
import com.legioncontrols.server.runtime.RuntimeService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Java equivalent of the three health routes defined directly in backend/src/app.js. Distinct
 * meanings preserved exactly (LC-ARCH-004):
 *
 * <ul>
 *   <li>{@code /live} — this process is running. Never depends on the database or Runtime.
 *   <li>{@code /ready} — this process can perform its role (serve API requests backed by the DB).
 *   <li>{@code /health} — detailed dependency status; Runtime unreachable is reported here, never
 *       thrown — this Server stays healthy/available even when Runtime is down.
 * </ul>
 */
@RestController
public class HealthController {

    private final DSLContext dsl;
    private final RuntimeService runtimeService;

    public HealthController(DSLContext dsl, RuntimeService runtimeService) {
        this.dsl = dsl;
        this.runtimeService = runtimeService;
    }

    @GetMapping("/live")
    public Map<String, Object> live() {
        return Map.of("ok", true);
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        Map<String, Object> body = new LinkedHashMap<>();
        try {
            dsl.selectOne().fetch();
            body.put("ok", true);
            body.put("dbReachable", true);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            body.put("ok", false);
            body.put("dbReachable", false);
            body.put("error", e.getMessage());
            return ResponseEntity.status(503).body(body);
        }
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        boolean dbReachable = true;
        try {
            dsl.selectOne().fetch();
        } catch (Exception e) {
            dbReachable = false;
        }

        RuntimeClient.RuntimeProbe runtime = runtimeService.getRuntimeHealth();
        Map<String, Object> runtimeBlock = new LinkedHashMap<>();
        runtimeBlock.put("reachable", runtime.reachable());
        runtimeBlock.put("status", runtime.reachable() ? runtime.status() : null);
        runtimeBlock.put("detail", runtime.reachable() ? runtime.body() : null);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("dbReachable", dbReachable);
        body.put("runtime", runtimeBlock);
        return body;
    }
}
