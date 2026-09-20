package com.legioncontrols.server.releases;

import com.legioncontrols.server.jooq.generated.tables.records.SitedeploymenteventRecord;
import java.time.LocalDateTime;

/**
 * Matches listDeploymentEvents()'s raw-row shape in siteVersion.service.js — returned as-is by the
 * Node backend (no normalization layer exists for this one), so this DTO is a direct field mirror.
 */
public record DeploymentEventDto(
    String id,
    int sequence,
    String siteId,
    String releaseVersionId,
    String previousReleaseVersionId,
    String action,
    LocalDateTime activatedAt,
    String activatedBy
) {
    public static DeploymentEventDto from(SitedeploymenteventRecord r) {
        return new DeploymentEventDto(
            r.getId(),
            r.getSequence(),
            r.getSiteid(),
            r.getReleaseversionid(),
            r.getPreviousreleaseversionid(),
            r.getAction() != null ? r.getAction().getLiteral() : null,
            r.getActivatedat(),
            r.getActivatedby()
        );
    }
}
