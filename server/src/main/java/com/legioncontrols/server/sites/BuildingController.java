package com.legioncontrols.server.sites;

import com.legioncontrols.server.releases.ReleaseService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Java equivalent of backend/src/modules/buildings/building.controller.js (routes split across
 * building.routes.js at /api/sites/:siteId/buildings and /api/buildings/:id in Express — combined
 * here since Spring's @RequestMapping doesn't need the same file-per-mount-point split).
 */
@RestController
public class BuildingController {

    private final BuildingService buildingService;
    private final ReleaseService releaseService;

    public BuildingController(BuildingService buildingService, ReleaseService releaseService) {
        this.buildingService = buildingService;
        this.releaseService = releaseService;
    }

    @GetMapping("/api/sites/{siteId}/buildings")
    public List<BuildingDto> listBySite(@PathVariable String siteId) {
        return buildingService.listBuildingsBySite(siteId);
    }

    @GetMapping("/api/buildings/{id}")
    public BuildingDto getById(@PathVariable String id) {
        return BuildingDto.from(buildingService.getBuildingRecordById(id));
    }

    @PostMapping("/api/sites/{siteId}/buildings")
    public ResponseEntity<BuildingDto> createForSite(@PathVariable String siteId, @RequestBody BuildingService.CreateBuildingRequest request) {
        var building = buildingService.createBuilding(siteId, request);
        releaseService.syncWorkingPayloadFromDb(siteId);
        return ResponseEntity.status(HttpStatus.CREATED).body(BuildingDto.from(building));
    }

    @PatchMapping("/api/buildings/{id}")
    public BuildingDto update(@PathVariable String id, @RequestBody BuildingService.UpdateBuildingRequest request) {
        var building = buildingService.updateBuilding(id, request);
        releaseService.syncWorkingPayloadFromDb(building.getSiteid());
        return BuildingDto.from(building);
    }

    @DeleteMapping("/api/buildings/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id) {
        var deleted = buildingService.deleteBuilding(id);
        releaseService.syncWorkingPayloadFromDb(deleted.getSiteid());
        return ResponseEntity.noContent().build();
    }
}
