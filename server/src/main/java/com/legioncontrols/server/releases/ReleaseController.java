package com.legioncontrols.server.releases;

import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

/**
 * Java equivalent of the release/deploy/rollback/history routes in
 * backend/src/modules/siteVersions/siteVersion.controller.js + siteVersion.routes.js. Response
 * envelope shapes match exactly ({@code {"release": ...}}, {@code {"activeRelease": ...}},
 * {@code {"versions": [...]}}, {@code {"events": [...]}}) so the frontend needs no changes.
 */
@RestController
@RequestMapping("/api/sites/{siteId}")
public class ReleaseController {

    private final ReleaseService releaseService;

    public ReleaseController(ReleaseService releaseService) {
        this.releaseService = releaseService;
    }

    private static String trimmedOrNull(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    public record DeployBody(String deployedBy, String notes) {
    }

    /** Legacy combined build+deploy — matches the existing single-button Engineering UX. */
    @PostMapping("/deploy")
    public Map<String, SiteVersionDto> postDeploy(@PathVariable String siteId, @RequestBody(required = false) DeployBody body) {
        DeployBody b = body != null ? body : new DeployBody(null, null);
        SiteversionRecord released = releaseService.deployWorkingVersion(siteId, trimmedOrNull(b.deployedBy()), trimmedOrNull(b.notes()));
        return Map.of("activeRelease", SiteVersionDto.from(released, releaseService.payloadFor(released)));
    }

    public record BuildReleaseBody(String builtBy, String notes) {
    }

    /** BUILD RELEASE only — does not activate it. */
    @PostMapping("/build-release")
    public Map<String, SiteVersionDto> postBuildRelease(@PathVariable String siteId, @RequestBody(required = false) BuildReleaseBody body) {
        BuildReleaseBody b = body != null ? body : new BuildReleaseBody(null, null);
        SiteversionRecord release = releaseService.buildRelease(siteId, trimmedOrNull(b.builtBy()), trimmedOrNull(b.notes()));
        return Map.of("release", SiteVersionDto.from(release, releaseService.payloadFor(release)));
    }

    public record DeployVersionBody(String deployedBy) {
    }

    /** DEPLOY a specific, already-built RELEASED version. */
    @PostMapping("/versions/{versionId}/deploy")
    public Map<String, SiteVersionDto> postDeployVersion(@PathVariable String siteId, @PathVariable String versionId,
                                                           @RequestBody(required = false) DeployVersionBody body) {
        String deployedBy = body != null ? trimmedOrNull(body.deployedBy()) : null;
        SiteversionRecord activated = releaseService.deployRelease(siteId, versionId, deployedBy, "DEPLOY");
        return Map.of("activeRelease", SiteVersionDto.from(activated, releaseService.payloadFor(activated)));
    }

    public record RollbackBody(String actor, String toVersionId) {
    }

    /** ROLLBACK to the previously active RELEASED version (or an explicit toVersionId). */
    @PostMapping("/rollback")
    public Map<String, SiteVersionDto> postRollback(@PathVariable String siteId, @RequestBody(required = false) RollbackBody body) {
        RollbackBody b = body != null ? body : new RollbackBody(null, null);
        String actor = trimmedOrNull(b.actor());
        SiteversionRecord activated = b.toVersionId() != null
            ? releaseService.rollbackToVersion(siteId, b.toVersionId(), actor)
            : releaseService.rollbackToPreviousRelease(siteId, actor);
        return Map.of("activeRelease", SiteVersionDto.from(activated, releaseService.payloadFor(activated)));
    }

    @GetMapping("/versions")
    public Map<String, List<SiteVersionDto>> listVersions(@PathVariable String siteId) {
        List<SiteVersionDto> versions = releaseService.listVersionHistory(siteId).stream()
            .map(SiteVersionDto::withoutPayload)
            .toList();
        return Map.of("versions", versions);
    }

    /** Append-only DEPLOY/ROLLBACK activation ledger (newest first) — history/troubleshooting only. */
    @GetMapping("/deployment-events")
    public Map<String, List<DeploymentEventDto>> listDeploymentEvents(@PathVariable String siteId) {
        List<DeploymentEventDto> events = releaseService.listDeploymentEvents(siteId).stream()
            .map(DeploymentEventDto::from)
            .toList();
        return Map.of("events", events);
    }
}
