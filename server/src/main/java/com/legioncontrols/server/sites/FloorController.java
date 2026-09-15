package com.legioncontrols.server.sites;

import com.legioncontrols.server.releases.ReleaseService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Java equivalent of backend/src/modules/floors/floor.controller.js. */
@RestController
public class FloorController {

    private final FloorService floorService;
    private final ReleaseService releaseService;

    public FloorController(FloorService floorService, ReleaseService releaseService) {
        this.floorService = floorService;
        this.releaseService = releaseService;
    }

    @GetMapping("/api/buildings/{buildingId}/floors")
    public List<FloorDto> listByBuilding(@PathVariable String buildingId) {
        return floorService.listFloorsByBuilding(buildingId);
    }

    @PostMapping("/api/buildings/{buildingId}/floors")
    public ResponseEntity<FloorDto> createForBuilding(@PathVariable String buildingId, @RequestBody FloorService.CreateFloorRequest request) {
        var created = floorService.createFloor(buildingId, request);
        releaseService.syncWorkingPayloadFromDb(created.siteId());
        return ResponseEntity.status(HttpStatus.CREATED).body(FloorDto.from(created.floor()));
    }

    @PatchMapping("/api/floors/{floorId}")
    public FloorDto updateById(@PathVariable String floorId, @RequestBody FloorService.UpdateFloorRequest request) {
        var updated = floorService.updateFloor(floorId, request);
        releaseService.syncWorkingPayloadFromDb(updated.siteId());
        return FloorDto.from(updated.floor());
    }

    @DeleteMapping("/api/floors/{floorId}")
    public ResponseEntity<Void> deleteById(@PathVariable String floorId) {
        var deleted = floorService.deleteFloor(floorId);
        releaseService.syncWorkingPayloadFromDb(deleted.siteId());
        return ResponseEntity.noContent().build();
    }
}
