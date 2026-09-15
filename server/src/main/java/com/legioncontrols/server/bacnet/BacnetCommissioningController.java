package com.legioncontrols.server.bacnet;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/**
 * Java equivalent of the {@code /api/runtime/bacnet/*} route surface previously served directly by
 * the Express Legion Server (backend/src/modules/bacnet/bacnet.routes.js, mounted inside
 * runtime.routes.js). Every request is forwarded verbatim — method, path, query string, and JSON
 * body — to the isolated Node BACnet commissioning process via {@link BacnetCommissioningClient},
 * and the upstream status/body are returned unchanged (a reverse proxy, not a reimplementation),
 * so the frontend needs no changes and this controller never drifts out of sync with the
 * commissioning service's own route list.
 *
 * Same no-cache headers app.js applies to the whole {@code /api/runtime} subtree (live SIM/BACnet
 * discovery data must never be revalidated via ETag/304, which has no JSON body and breaks SPA
 * callers).
 */
@RestController
@RequestMapping("/api/runtime/bacnet")
public class BacnetCommissioningController {

    private static final String PREFIX = "/api/runtime/bacnet";

    private final BacnetCommissioningClient client;

    public BacnetCommissioningController(BacnetCommissioningClient client) {
        this.client = client;
    }

    @RequestMapping(value = "/**", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<JsonNode> proxy(HttpServletRequest request, @RequestBody(required = false) JsonNode body) {
        String fullPath = request.getRequestURI();
        int idx = fullPath.indexOf(PREFIX);
        String subPath = idx >= 0 ? fullPath.substring(idx + PREFIX.length()) : "";
        if (subPath.isEmpty()) subPath = "/";
        String query = request.getQueryString();
        String pathWithQuery = query != null && !query.isBlank() ? subPath + "?" + query : subPath;

        BacnetCommissioningClient.ProxiedResponse response = client.forward(request.getMethod(), pathWithQuery, body);
        return ResponseEntity.status(response.status())
            .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, private")
            .header(HttpHeaders.PRAGMA, "no-cache")
            .body(response.body());
    }
}
