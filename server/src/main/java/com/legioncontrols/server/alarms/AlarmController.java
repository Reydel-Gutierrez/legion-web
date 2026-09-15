package com.legioncontrols.server.alarms;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/**
 * Java equivalent of backend/src/modules/alarms/alarm.controller.js — routes live under
 * /api/sites/:siteId (mounted in site.routes.js in the Node backend, same here).
 */
@RestController
@RequestMapping("/api/sites/{siteId}")
public class AlarmController {

    private final AlarmDefinitionService definitionService;
    private final AlarmEventService eventService;
    private final AlarmEvaluationService evaluationService;

    public AlarmController(AlarmDefinitionService definitionService, AlarmEventService eventService, AlarmEvaluationService evaluationService) {
        this.definitionService = definitionService;
        this.eventService = eventService;
        this.evaluationService = evaluationService;
    }

    @GetMapping("/alarm-definitions")
    public List<AlarmDefinitionDto> listDefinitions(@PathVariable String siteId,
                                                      @RequestParam(required = false) String equipmentId,
                                                      @RequestParam(required = false) String pointId,
                                                      @RequestParam(required = false) String pointKey) {
        return definitionService.listDefinitions(siteId, new AlarmDefinitionService.ListQuery(equipmentId, pointId, pointKey));
    }

    @PostMapping("/alarm-definitions")
    public ResponseEntity<AlarmDefinitionDto> createDefinition(@PathVariable String siteId, @RequestBody AlarmDefinitionService.CreateDefinitionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(definitionService.createDefinition(siteId, request));
    }

    @PatchMapping("/alarm-definitions/{definitionId}")
    public AlarmDefinitionDto updateDefinition(@PathVariable String siteId, @PathVariable String definitionId, @RequestBody JsonNode body) {
        return definitionService.updateDefinition(siteId, definitionId, body);
    }

    @DeleteMapping("/alarm-definitions/{definitionId}")
    public Map<String, Boolean> deleteDefinition(@PathVariable String siteId, @PathVariable String definitionId) {
        definitionService.deleteDefinition(siteId, definitionId);
        return Map.of("ok", true);
    }

    @GetMapping("/alarm-events")
    public List<AlarmEventDto> listEvents(@PathVariable String siteId, @RequestParam(required = false) String state,
                                           @RequestParam(required = false) String equipmentId) {
        return eventService.listEvents(siteId, new AlarmEventService.ListEventsQuery(state, equipmentId));
    }

    @PatchMapping("/alarm-events/{eventId}/ack")
    public AlarmEventDto acknowledgeEvent(@PathVariable String siteId, @PathVariable String eventId) {
        return eventService.acknowledgeEvent(siteId, eventId);
    }

    public record EvaluateRequest(List<String> pointIds) {
    }

    @PostMapping("/alarm-evaluate")
    public Map<String, Boolean> postEvaluate(@PathVariable String siteId, @RequestBody(required = false) EvaluateRequest request) {
        if (request != null && request.pointIds() != null && !request.pointIds().isEmpty()) {
            evaluationService.evaluateForPointIds(request.pointIds());
        } else {
            evaluationService.evaluateDefinitionsForSite(siteId, List.of());
        }
        return Map.of("ok", true);
    }
}
