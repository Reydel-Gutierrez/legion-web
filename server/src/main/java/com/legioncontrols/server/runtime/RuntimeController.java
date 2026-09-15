package com.legioncontrols.server.runtime;

import tools.jackson.databind.JsonNode;
import com.legioncontrols.server.common.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Java equivalent of backend/src/modules/runtime/runtime.controller.js +
 * runtime.routes.js — same paths, same 404 body shape ({@code {"error": "..."}}), same
 * no-cache headers app.js applies to the whole /api/runtime subtree (live SIM/discovery data must
 * never be revalidated via ETag/304, which has no JSON body and breaks SPA callers).
 */
@RestController
@RequestMapping("/api/runtime")
public class RuntimeController {

    private final RuntimeService runtimeService;

    public RuntimeController(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    private static ResponseEntity.BodyBuilder noCache(ResponseEntity.BodyBuilder builder) {
        return builder
            .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, private")
            .header(HttpHeaders.PRAGMA, "no-cache");
    }

    private static ApiException controllerNotFound() {
        return ApiException.notFound("Controller not found");
    }

    @GetMapping("/controllers")
    public ResponseEntity<JsonNode> listControllers() {
        return noCache(ResponseEntity.ok()).body(runtimeService.listControllers());
    }

    // Registered before /controllers/{code} so it isn't swallowed by that pattern, matching
    // runtime.routes.js's explicit ordering.
    @GetMapping("/controllers/{code}/field-points")
    public ResponseEntity<Map<String, JsonNode>> fieldPoints(@PathVariable String code) {
        JsonNode points = runtimeService.listFieldPointsForController(code);
        if (points == null) {
            throw controllerNotFound();
        }
        Map<String, JsonNode> body = new LinkedHashMap<>();
        body.put("points", points);
        return noCache(ResponseEntity.ok()).body(body);
    }

    @GetMapping("/controllers/{code}")
    public ResponseEntity<JsonNode> getController(@PathVariable String code) {
        JsonNode row = runtimeService.getController(code);
        if (row == null) {
            throw controllerNotFound();
        }
        return noCache(ResponseEntity.ok()).body(row);
    }

    @PostMapping("/controllers/{code}/online")
    public ResponseEntity<JsonNode> setOnline(@PathVariable String code) {
        JsonNode row = runtimeService.setOnline(code, true);
        if (row == null) throw controllerNotFound();
        return noCache(ResponseEntity.ok()).body(row);
    }

    @PostMapping("/controllers/{code}/offline")
    public ResponseEntity<JsonNode> setOffline(@PathVariable String code) {
        JsonNode row = runtimeService.setOnline(code, false);
        if (row == null) throw controllerNotFound();
        return noCache(ResponseEntity.ok()).body(row);
    }

    @PostMapping("/controllers/{code}/start")
    public ResponseEntity<JsonNode> start(@PathVariable String code) {
        JsonNode row = runtimeService.setSimEnabled(code, true);
        if (row == null) throw controllerNotFound();
        return noCache(ResponseEntity.ok()).body(row);
    }

    @PostMapping("/controllers/{code}/stop")
    public ResponseEntity<JsonNode> stop(@PathVariable String code) {
        JsonNode row = runtimeService.setSimEnabled(code, false);
        if (row == null) throw controllerNotFound();
        return noCache(ResponseEntity.ok()).body(row);
    }

    @PostMapping("/controllers/{code}/poll-now")
    public ResponseEntity<JsonNode> pollNow(@PathVariable String code) {
        JsonNode row = runtimeService.pollNow(code);
        if (row == null) throw controllerNotFound();
        return noCache(ResponseEntity.ok()).body(row);
    }

    public record WritePointRequest(String fieldPointKey, Object value, Integer priority) {
    }

    /**
     * LC-ARCH-004: the only path a live field write reaches a device through — this call goes to
     * Runtime's internal API, which dispatches through BacnetDriver.
     */
    @PostMapping("/controllers/{code}/write")
    public ResponseEntity<JsonNode> writePoint(@PathVariable String code, @RequestBody(required = false) WritePointRequest request) {
        WritePointRequest body = request != null ? request : new WritePointRequest(null, null, null);
        JsonNode result = runtimeService.writePoint(code, body.fieldPointKey(), body.value(), body.priority());
        if (result == null) {
            throw ApiException.notFound("Controller or point mapping not found");
        }
        return noCache(ResponseEntity.ok()).body(result);
    }

    @GetMapping("/discovery-devices")
    public ResponseEntity<Map<String, JsonNode>> discoveryDevices(@RequestParam(required = false) String siteId) {
        Map<String, JsonNode> body = new LinkedHashMap<>();
        body.put("devices", runtimeService.listDiscoveryDevices(siteId));
        return noCache(ResponseEntity.ok()).body(body);
    }
}
