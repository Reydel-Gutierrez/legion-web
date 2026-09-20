package com.legioncontrols.server.geocode;

import com.legioncontrols.server.common.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

/** Java equivalent of backend/src/modules/geocode/geocode.controller.js + geocode.routes.js. */
@RestController
@RequestMapping("/api/geocode")
public class GeocodeController {

    private final GeocodeService service;

    public GeocodeController(GeocodeService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "suggest", "/api/geocode/suggest?q=…");
    }

    @GetMapping("/suggest")
    public Map<String, List<GeocodeService.AddressSuggestion>> suggest(@RequestParam(required = false) String q,
                                                                        @RequestParam(required = false) Integer limit) {
        if (q == null || q.trim().isEmpty()) {
            throw ApiException.badRequest("Query parameter q is required");
        }
        return Map.of("results", service.suggestAddresses(q, limit));
    }
}
