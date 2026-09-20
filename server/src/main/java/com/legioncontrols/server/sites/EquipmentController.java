package com.legioncontrols.server.sites;

import com.legioncontrols.server.releases.ReleaseService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Java equivalent of backend/src/modules/equipment/equipment.controller.js. */
@RestController
public class EquipmentController {

    private final EquipmentService equipmentService;
    private final ReleaseService releaseService;

    public EquipmentController(EquipmentService equipmentService, ReleaseService releaseService) {
        this.equipmentService = equipmentService;
        this.releaseService = releaseService;
    }

    @GetMapping("/api/floors/{floorId}/equipment")
    public List<EquipmentDto> listByFloor(@PathVariable String floorId) {
        return equipmentService.listEquipmentByFloor(floorId);
    }

    @GetMapping("/api/sites/{siteId}/equipment")
    public List<EquipmentDto> listBySite(@PathVariable String siteId) {
        return equipmentService.listEquipmentBySite(siteId);
    }

    @PostMapping("/api/floors/{floorId}/equipment")
    public ResponseEntity<EquipmentDto> createForFloor(@PathVariable String floorId, @RequestBody EquipmentService.CreateEquipmentRequest request) {
        var equipment = equipmentService.createEquipment(floorId, request);
        releaseService.syncWorkingPayloadFromDb(equipment.getSiteid());
        return ResponseEntity.status(HttpStatus.CREATED).body(EquipmentDto.from(equipment));
    }

    @PatchMapping("/api/equipment/{id}")
    public EquipmentDto update(@PathVariable String id, @RequestBody EquipmentService.UpdateEquipmentRequest request) {
        var equipment = equipmentService.updateEquipment(id, request);
        releaseService.syncWorkingPayloadFromDb(equipment.getSiteid());
        return EquipmentDto.from(equipment);
    }

    @DeleteMapping("/api/equipment/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id) {
        var deleted = equipmentService.deleteEquipment(id);
        releaseService.syncWorkingPayloadFromDb(deleted.getSiteid());
        return ResponseEntity.noContent().build();
    }
}
