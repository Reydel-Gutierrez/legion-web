package com.legioncontrols.server.engineering;

import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import com.legioncontrols.server.releases.ReleaseService;
import com.legioncontrols.server.releases.SiteVersionDto;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/**
 * Java equivalent of the working-version + active-release routes in
 * backend/src/modules/siteVersions/siteVersion.controller.js / siteVersion.routes.js (mounted
 * under /api/sites in the Node app). Response envelopes match exactly:
 * {@code {"workingVersion": ...}} / {@code {"activeRelease": ...}}.
 */
@RestController
@RequestMapping("/api/sites/{siteId}")
public class EngineeringController {

    private final ReleaseService releaseService;

    public EngineeringController(ReleaseService releaseService) {
        this.releaseService = releaseService;
    }

    @GetMapping("/working-version")
    public Map<String, SiteVersionDto> getWorking(@PathVariable String siteId) {
        releaseService.getOrCreateWorkingVersion(siteId);
        SiteversionRecord version = releaseService.syncWorkingPayloadFromDb(siteId);
        return Map.of("workingVersion", SiteVersionDto.from(version, releaseService.payloadFor(version)));
    }

    public record PutWorkingVersionBody(JsonNode payload, String notes) {
    }

    @PutMapping("/working-version")
    public Map<String, SiteVersionDto> putWorking(@PathVariable String siteId, @RequestBody PutWorkingVersionBody body) {
        SiteversionRecord version = releaseService.putWorkingVersion(
            siteId,
            new ReleaseService.PutWorkingVersionRequest(body.payload(), body.notes())
        );
        return Map.of("workingVersion", SiteVersionDto.from(version, releaseService.payloadFor(version)));
    }

    @GetMapping("/active-release")
    public Map<String, SiteVersionDto> getActiveRelease(@PathVariable String siteId) {
        ReleaseService.ActiveRelease active = releaseService.getActiveRelease(siteId);
        if (active == null) {
            Map<String, SiteVersionDto> body = new java.util.HashMap<>();
            body.put("activeRelease", null);
            return body;
        }
        return Map.of("activeRelease", SiteVersionDto.from(active.version(), active.payload()));
    }
}
