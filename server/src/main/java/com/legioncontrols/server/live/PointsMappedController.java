package com.legioncontrols.server.live;

import com.legioncontrols.server.common.JsonUtil;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** Java equivalent of backend/src/modules/pointMappings/pointMappings.controller.js. */
@RestController
@RequestMapping("/api/point-mappings")
public class PointsMappedController {

    private final PointsMappedService service;
    private final JsonUtil json;

    public PointsMappedController(PointsMappedService service, JsonUtil json) {
        this.service = service;
        this.json = json;
    }

    @PostMapping("/bind")
    public ResponseEntity<PointsMappedDto> bind(@RequestBody PointsMappedService.BindRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(PointsMappedDto.from(service.bind(request), json));
    }

    @GetMapping("/by-controller/{equipmentControllerId}")
    public List<PointsMappedDto> listByController(@PathVariable String equipmentControllerId) {
        return service.listByController(equipmentControllerId).stream().map(r -> PointsMappedDto.from(r, json)).toList();
    }

    @GetMapping("/by-equipment/{equipmentId}")
    public List<PointsMappedDto> listByEquipment(@PathVariable String equipmentId) {
        return service.listByEquipment(equipmentId).stream().map(r -> PointsMappedDto.from(r, json)).toList();
    }

    @PatchMapping("/{id}")
    public PointsMappedDto update(@PathVariable String id, @RequestBody JsonNode body) {
        return PointsMappedDto.from(service.update(id, body), json);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id) {
        service.remove(id);
        return ResponseEntity.noContent().build();
    }
}
