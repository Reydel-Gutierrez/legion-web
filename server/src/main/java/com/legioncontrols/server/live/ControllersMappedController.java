package com.legioncontrols.server.live;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** Java equivalent of backend/src/modules/equipmentControllers/equipmentControllers.controller.js. */
@RestController
@RequestMapping("/api/equipment-controllers")
public class ControllersMappedController {

    private final ControllersMappedService service;
    private final JsonUtil json;

    public ControllersMappedController(ControllersMappedService service, JsonUtil json) {
        this.service = service;
        this.json = json;
    }

    @PostMapping("/assign")
    public ResponseEntity<ControllersMappedDto> assign(@RequestBody ControllersMappedService.AssignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ControllersMappedDto.from(service.assign(request), json));
    }

    @GetMapping
    public List<ControllersMappedDto> list() {
        return service.list().stream().map(r -> ControllersMappedDto.from(r, json)).toList();
    }

    @GetMapping("/by-equipment/{equipmentId}")
    public ControllersMappedDto getByEquipment(@PathVariable String equipmentId) {
        var row = service.getByEquipmentId(equipmentId);
        if (row == null) {
            throw ApiException.notFound("No controller assigned to this equipment");
        }
        return ControllersMappedDto.from(row, json);
    }

    @PatchMapping("/{id}")
    public ControllersMappedDto update(@PathVariable String id, @RequestBody JsonNode body) {
        return ControllersMappedDto.from(service.update(id, body), json);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id) {
        service.remove(id);
        return ResponseEntity.noContent().build();
    }
}
