package com.legioncontrols.server.operator;

import java.util.Map;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/**
 * Java equivalent of backend/src/modules/operatorDefinitions/operatorDefinitions.controller.js +
 * operatorDefinitions.routes.js. Every response is wrapped as {@code {"data": ...}}, matching the
 * Node controller's generic {@code handler} exactly.
 */
@RestController
@RequestMapping("/api/operator/{siteId}/{kind}/definitions")
public class OperatorDefinitionsController {

    private final OperatorDefinitionsService service;

    public OperatorDefinitionsController(OperatorDefinitionsService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list(@PathVariable String siteId, @PathVariable String kind,
                                     @RequestParam(required = false) String templates) {
        return Map.of("data", service.list(siteId, OperatorDefinitionsService.parseKind(kind), templates));
    }

    @PostMapping
    public Map<String, Object> create(@PathVariable String siteId, @PathVariable String kind, @RequestBody JsonNode body) {
        return Map.of("data", service.create(siteId, OperatorDefinitionsService.parseKind(kind), body));
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable String siteId, @PathVariable String kind, @PathVariable String id, @RequestBody JsonNode body) {
        return Map.of("data", service.update(siteId, OperatorDefinitionsService.parseKind(kind), id, body));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> remove(@PathVariable String siteId, @PathVariable String kind, @PathVariable String id) {
        service.remove(siteId, OperatorDefinitionsService.parseKind(kind), id);
        return Map.of("data", Map.of("ok", true));
    }

    @PostMapping("/{id}/assign")
    public Map<String, Object> assign(@PathVariable String siteId, @PathVariable String kind, @PathVariable String id,
                                       @RequestBody(required = false) JsonNode body) {
        return Map.of("data", service.assign(siteId, OperatorDefinitionsService.parseKind(kind), id, body));
    }

    @DeleteMapping("/{id}/assign/{equipmentId}")
    public Map<String, Object> unassign(@PathVariable String siteId, @PathVariable String kind, @PathVariable String id, @PathVariable String equipmentId) {
        service.unassign(siteId, OperatorDefinitionsService.parseKind(kind), id, equipmentId);
        return Map.of("data", Map.of("ok", true));
    }
}
