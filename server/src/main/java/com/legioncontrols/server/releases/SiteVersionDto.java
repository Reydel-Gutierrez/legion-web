package com.legioncontrols.server.releases;

import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

/** Matches serializeVersionRow() in backend/src/modules/siteVersions/siteVersion.service.js exactly. */
public record SiteVersionDto(
    String id,
    String siteId,
    int versionNumber,
    String status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    String createdBy,
    LocalDateTime deployedAt,
    String deployedBy,
    String parentVersionId,
    String sourceWorkingVersionId,
    String notes,
    JsonNode payload
) {
    public static SiteVersionDto from(SiteversionRecord r, JsonNode payload) {
        return new SiteVersionDto(
            r.getId(),
            r.getSiteid(),
            r.getVersionnumber(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getCreatedat(),
            r.getUpdatedat(),
            r.getCreatedby(),
            r.getDeployedat(),
            r.getDeployedby(),
            r.getParentversionid(),
            r.getSourceworkingversionid(),
            r.getNotes(),
            payload
        );
    }

    public static SiteVersionDto withoutPayload(SiteversionRecord r) {
        return from(r, null);
    }
}
