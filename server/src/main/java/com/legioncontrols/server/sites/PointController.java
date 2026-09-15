package com.legioncontrols.server.sites;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** Java equivalent of backend/src/modules/points/point.controller.js. */
@RestController
public class PointController {

    private final PointService pointService;

    public PointController(PointService pointService) {
        this.pointService = pointService;
    }

    @GetMapping("/api/equipment/{equipmentId}/points")
    public List<PointDto> listByEquipment(@PathVariable String equipmentId) {
        return pointService.listPointsByEquipment(equipmentId);
    }

    @PostMapping("/api/equipment/{equipmentId}/points")
    public ResponseEntity<PointDto> createForEquipment(@PathVariable String equipmentId, @RequestBody PointService.CreatePointRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(PointDto.from(pointService.createPoint(equipmentId, request)));
    }

    @PatchMapping("/api/points/{id}")
    public PointDto update(@PathVariable String id, @RequestBody JsonNode body) {
        return PointDto.from(pointService.updatePoint(id, body));
    }

    /**
     * GET /api/points/history?ids=<id1,id2,...>&range=1h|24h|7d|30d
     * Registered as its own path (not /api/points/{id}) so it is never swallowed by the PATCH
     * mapping above — matches point.routes.js registering this before the /:id route.
     */
    @GetMapping("/api/points/history")
    public PointService.HistoryResult history(@RequestParam(required = false) String ids, @RequestParam(required = false) String range) {
        List<String> pointIds = ids != null && !ids.isBlank()
            ? List.of(ids.split(",")).stream().map(String::trim).filter(s -> !s.isEmpty()).toList()
            : List.of();
        return pointService.getHistoryForPointIds(pointIds, range);
    }
}
